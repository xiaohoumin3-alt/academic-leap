import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GracefulDegrader, DEGRADATION_RULES } from '../graceful-degrader';

jest.mock('@prisma/client');

describe('GracefulDegrader', () => {
  let degrader: GracefulDegrader;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = {
      template: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      canaryRelease: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    degrader = new GracefulDegrader(mockPrisma);
  });

  describe('DEGRADATION_RULES', () => {
    it('should have rules for LE drop thresholds', () => {
      expect(DEGRADATION_RULES.le_drop_10_percent).toBeDefined();
      expect(DEGRADATION_RULES.le_drop_20_percent).toBeDefined();
      expect(DEGRADATION_RULES.le_drop_30_percent).toBeDefined();
    });

    it('should have correct severity levels for each rule', () => {
      expect(DEGRADATION_RULES.le_drop_10_percent.severity).toBe('warning');
      expect(DEGRADATION_RULES.le_drop_20_percent.severity).toBe('danger');
      expect(DEGRADATION_RULES.le_drop_30_percent.severity).toBe('critical');
    });

    it('should have correct actions for each severity', () => {
      expect(DEGRADATION_RULES.le_drop_10_percent.action).toBe('increase_exploration');
      expect(DEGRADATION_RULES.le_drop_20_percent.action).toBe('switch_to_rule_engine');
      expect(DEGRADATION_RULES.le_drop_30_percent.action).toBe('immediate_rollback');
    });
  });

  describe('degrade()', () => {
    it('should log degradation with warning severity', async () => {
      await degrader.degrade('t-1', 'LE dropped 10%', 'warning');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'degrade',
            entity: 'template',
            entityId: 't-1',
          }),
        })
      );
    });

    it('should update canary health status on degradation', async () => {
      await degrader.degrade('t-1', 'LE dropped 10%', 'warning');

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            healthStatus: 'warning',
          }),
        })
      );
    });

    it('should switch to rule engine on danger severity', async () => {
      await degrader.degrade('t-1', 'LE dropped 20%', 'danger');

      expect(mockPrisma.template.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-1' },
        })
      );

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );
    });

    it('should rollback on critical severity', async () => {
      await degrader.degrade('t-1', 'LE dropped 30%', 'critical');

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            status: 'rolled_back',
            trafficPercent: 0,
          }),
        })
      );
    });
  });

  describe('switchToRuleEngine()', () => {
    it('should log the switch action', async () => {
      await degrader.switchToRuleEngine('t-1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'switch_to_rule_engine',
            entity: 'template',
            entityId: 't-1',
          }),
        })
      );
    });

    it('should pause the canary', async () => {
      await degrader.switchToRuleEngine('t-1');

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );
    });
  });

  describe('immediateRollback()', () => {
    it('should log the rollback action', async () => {
      await degrader.immediateRollback('t-1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'immediate_rollback',
            entity: 'template',
            entityId: 't-1',
          }),
        })
      );
    });

    it('should rollback canary with 0 traffic', async () => {
      await degrader.immediateRollback('t-1');

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            status: 'rolled_back',
            trafficPercent: 0,
          }),
        })
      );
    });
  });

  describe('recover()', () => {
    it('should log the recovery action', async () => {
      await degrader.recover('t-1');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'recover',
            entity: 'template',
            entityId: 't-1',
          }),
        })
      );
    });

    it('should resume canary with healthy status', async () => {
      await degrader.recover('t-1');

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId: 't-1' },
          data: expect.objectContaining({
            status: 'running',
            healthStatus: 'healthy',
          }),
        })
      );
    });
  });

  describe('getDegradationStatus()', () => {
    it('should return healthy status when canary not found', async () => {
      mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce(null);

      const status = await degrader.getDegradationStatus('t-1');

      expect(status).toEqual({
        templateId: 't-1',
        status: 'healthy',
        currentStrategy: 'rl',
      });
    });

    it('should return correct status from canary data', async () => {
      mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        templateId: 't-1',
        status: 'paused',
        healthStatus: 'warning',
        lastHealthCheck: new Date('2024-01-01'),
      });

      const status = await degrader.getDegradationStatus('t-1');

      expect(status.templateId).toBe('t-1');
      expect(status.status).toBe('warning');
      expect(status.currentStrategy).toBe('rule_engine');
      expect(status.degradedAt).toBeDefined();
    });

    it('should return rl strategy when canary is running', async () => {
      mockPrisma.canaryRelease.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        templateId: 't-1',
        status: 'running',
        healthStatus: 'healthy',
      });

      const status = await degrader.getDegradationStatus('t-1');

      expect(status.currentStrategy).toBe('rl');
    });
  });

  describe('getDegradationAction()', () => {
    it('should return increase_exploration for warning', () => {
      const action = degrader.getDegradationAction('warning');
      expect(action).toBe('increase_exploration');
    });

    it('should return switch_to_rule_engine for danger', () => {
      const action = degrader.getDegradationAction('danger');
      expect(action).toBe('switch_to_rule_engine');
    });

    it('should return immediate_rollback for critical', () => {
      const action = degrader.getDegradationAction('critical');
      expect(action).toBe('immediate_rollback');
    });
  });
});
