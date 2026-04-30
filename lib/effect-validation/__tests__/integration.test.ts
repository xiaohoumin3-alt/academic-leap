import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ShadowCollector } from '../shadow-collector';
import { ExperimentManager } from '../experiment-manager';
import { CanaryController } from '../canary-controller';
import { LEAnalyzer } from '../le-analyzer';
import { GracefulDegrader, DEGRADATION_RULES } from '../graceful-degrader';

jest.mock('@prisma/client');

describe('Effect Validation Integration', () => {
  let mockPrisma: any;
  let shadowCollector: ShadowCollector;
  let experimentManager: ExperimentManager;
  let canaryController: CanaryController;
  let leAnalyzer: LEAnalyzer;
  let gracefulDegrader: GracefulDegrader;

  const TEST_TEMPLATE_ID = 'test-template-001';
  const TEST_USER_ID = 'user-001';
  const TEST_EXPERIMENT_ID = 'exp-001';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Prisma client with all required methods
    mockPrisma = {
      canaryRelease: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      shadowAttempt: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      effectExperiment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      effectAssignment: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      effectObservation: {
        create: jest.fn(),
        groupBy: jest.fn(),
      },
      canaryStageHistory: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      rLTrainingLog: {
        groupBy: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    // Initialize all components with mocked Prisma
    shadowCollector = new ShadowCollector(mockPrisma);
    experimentManager = new ExperimentManager(mockPrisma);
    canaryController = new CanaryController(mockPrisma);
    leAnalyzer = new LEAnalyzer(mockPrisma);
    gracefulDegrader = new GracefulDegrader(mockPrisma);
  });

  describe('Test 1: Shadow to Experiment Pipeline', () => {
    it('should transition from shadow mode to experiment when sample threshold met', async () => {
      // Setup: Shadow collector collects 50+ samples
      mockPrisma.shadowAttempt.count.mockResolvedValue(50);
      mockPrisma.shadowAttempt.findMany.mockResolvedValue(
        Array(50)
          .fill(null)
          .map((_, i) => ({
            id: `shadow-${i}`,
            templateId: TEST_TEMPLATE_ID,
            userId: `${TEST_USER_ID}-${i}`,
            knowledgePoint: 'kp-1',
            isCorrect: i % 10 < 7, // 70% correct rate
            duration: 30000 + i * 400,
            leDelta: 0.12 + (i % 10) * 0.006,
            recordedAt: new Date(),
          }))
      );

      // Verify shadow collector is ready for analysis
      const sampleCount = await shadowCollector.getSampleCount(TEST_TEMPLATE_ID);
      expect(sampleCount).toBe(50);

      const isReady = await shadowCollector.isReadyForAnalysis(TEST_TEMPLATE_ID);
      expect(isReady).toBe(true);

      // Create experiment with shadow data insights
      mockPrisma.effectExperiment.create.mockResolvedValue({
        id: TEST_EXPERIMENT_ID,
        name: 'Shadow to Experiment Transition',
        controlTemplateId: TEST_TEMPLATE_ID,
        treatmentTemplateId: 'treatment-template-001',
        targetMetric: 'le',
        minSampleSize: 100,
        status: 'draft',
      });

      const experimentId = await experimentManager.createExperiment({
        name: 'Shadow to Experiment Transition',
        controlTemplateId: TEST_TEMPLATE_ID,
        treatmentTemplateId: 'treatment-template-001',
        targetMetric: 'le',
        minSampleSize: 100,
      });

      expect(experimentId).toBe(TEST_EXPERIMENT_ID);
      expect(mockPrisma.effectExperiment.create).toHaveBeenCalledTimes(1);

      // Start experiment
      mockPrisma.effectExperiment.update.mockResolvedValue({
        id: TEST_EXPERIMENT_ID,
        status: 'running',
        startedAt: new Date(),
      });

      await experimentManager.startExperiment(experimentId);
      expect(mockPrisma.effectExperiment.update).toHaveBeenCalledWith({
        where: { id: TEST_EXPERIMENT_ID },
        data: expect.objectContaining({ status: 'running' }),
      });

      // User assignment to experiment (deterministic based on userId hash)
      mockPrisma.effectAssignment.findUnique.mockResolvedValue(null);
      mockPrisma.effectAssignment.create.mockResolvedValue({
        experimentId: TEST_EXPERIMENT_ID,
        userId: TEST_USER_ID,
        variant: 'control',
      });

      const variant = await experimentManager.assignVariant(TEST_USER_ID, TEST_EXPERIMENT_ID);
      expect(['control', 'treatment']).toContain(variant);
    });

    it('should record observation when user completes task in experiment', async () => {
      mockPrisma.effectObservation.create.mockResolvedValue({
        id: 'obs-1',
        experimentId: TEST_EXPERIMENT_ID,
        userId: TEST_USER_ID,
        variant: 'control',
        metricName: 'le',
        value: 0.15,
      });

      await experimentManager.recordObservation({
        experimentId: TEST_EXPERIMENT_ID,
        userId: TEST_USER_ID,
        variant: 'control',
        metricName: 'le',
        value: 0.15,
      });

      expect(mockPrisma.effectObservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          experimentId: TEST_EXPERIMENT_ID,
          userId: TEST_USER_ID,
          variant: 'control',
          metricName: 'le',
          value: 0.15,
        }),
      });
    });
  });

  describe('Test 2: LE Analysis with Anomaly Detection', () => {
    it('should detect LE drop anomaly when metrics degrade', async () => {
      // Mock RL training logs with low LE values
      mockPrisma.rLTrainingLog.groupBy.mockResolvedValue([
        { knowledgePointId: 'kp-1', _avg: { leDelta: 0.08 }, _count: 50 },
        { knowledgePointId: 'kp-2', _avg: { leDelta: 0.05 }, _count: 30 },
        { knowledgePointId: 'kp-3', _avg: { leDelta: 0.16 }, _count: 40 },
      ]);

      // Calculate global LE
      const globalLE = await leAnalyzer.calculateGlobalLE();

      expect(globalLE.le).toBeCloseTo((0.08 + 0.05 + 0.16) / 3, 2);
      expect(globalLE.byKnowledgePoint).toHaveLength(3);

      // Detect anomalies
      const anomalies = await leAnalyzer.detectAnomalies();

      // Should detect warning for low global LE (below 0.135 = 0.15 * 0.9)
      expect(anomalies.length).toBeGreaterThan(0);

      const warningAnomaly = anomalies.find((a) => a.details.metric === 'global_le');
      expect(warningAnomaly).toBeDefined();
      expect(warningAnomaly?.severity).toBe('warning');

      // Should detect danger for very low KP LE (below 0.075 = 0.15 * 0.5)
      const dangerAnomaly = anomalies.find((a) =>
        a.details.metric.startsWith('kp_') && a.severity === 'danger'
      );
      expect(dangerAnomaly).toBeDefined();
    });

    it('should calculate knowledge point LE with trend detection', async () => {
      mockPrisma.rLTrainingLog.groupBy.mockResolvedValue([
        { knowledgePointId: 'kp-1', _avg: { leDelta: 0.18 }, _count: 100 },
      ]);

      const result = await leAnalyzer.calculateLE('kp-1');

      expect(result.knowledgePointId).toBe('kp-1');
      expect(result.le).toBeCloseTo(0.18);
      expect(result.confidence).toBeCloseTo(1.0); // 100/100 = 1
      expect(result.sampleSize).toBe(100);
      expect(result.trend).toBe('improving'); // 0.18 >= 0.15 (LE_TARGET)
    });
  });

  describe('Test 3: Canary Rollout with Health Checks', () => {
    it('should control canary traffic based on stages', async () => {
      const canaryData = {
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        currentStage: 0,
        trafficPercent: 5,
        status: 'running',
        startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        history: [
          {
            id: 'history-1',
            enteredAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            exitedAt: null,
          },
        ],
      };

      mockPrisma.canaryRelease.findUnique.mockResolvedValue(canaryData);

      // Get current traffic
      const traffic = await canaryController.getCurrentTraffic(TEST_TEMPLATE_ID);
      expect(traffic).toBe(5);

      // Check health - should be healthy after 24 hours
      const health = await canaryController.checkHealth(TEST_TEMPLATE_ID);
      expect(health.status).toBe('healthy');

      // Increase traffic to next stage
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        ...canaryData,
        currentStage: 0,
        trafficPercent: 5,
      });

      mockPrisma.canaryRelease.update.mockResolvedValue({
        ...canaryData,
        currentStage: 1,
        trafficPercent: 10,
        status: 'running',
      });

      mockPrisma.canaryStageHistory.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.canaryStageHistory.create.mockResolvedValue({
        id: 'history-2',
        stage: 1,
        trafficPercent: 10,
      });

      await canaryController.increaseTraffic(TEST_TEMPLATE_ID);

      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith({
        where: { templateId: TEST_TEMPLATE_ID },
        data: expect.objectContaining({
          currentStage: 1,
          trafficPercent: 10,
        }),
      });
    });

    it('should handle canary status correctly', async () => {
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        currentStage: 2,
        trafficPercent: 25,
        status: 'running',
        startedAt: new Date(),
        lastHealthCheck: new Date(),
        healthStatus: 'healthy',
      });

      const status = await canaryController.getCanaryStatus(TEST_TEMPLATE_ID);

      expect(status).toBeDefined();
      expect(status?.templateId).toBe(TEST_TEMPLATE_ID);
      expect(status?.currentStage).toBe(2);
      expect(status?.trafficPercent).toBe(25);
    });

    it('should get active canaries', async () => {
      mockPrisma.canaryRelease.findMany.mockResolvedValue([
        { id: 'c1', templateId: 't1', currentStage: 1, trafficPercent: 10, status: 'running' },
        { id: 'c2', templateId: 't2', currentStage: 0, trafficPercent: 5, status: 'paused' },
      ]);

      const activeCanaries = await canaryController.getActiveCanaries();

      expect(activeCanaries).toHaveLength(2);
      expect(mockPrisma.canaryRelease.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['running', 'paused'] } },
      });
    });
  });

  describe('Test 4: Graceful Degradation Actions', () => {
    it('should execute correct degradation action for each severity', () => {
      // Verify DEGRADATION_RULES map to correct actions
      expect(DEGRADATION_RULES.le_drop_10_percent.severity).toBe('warning');
      expect(DEGRADATION_RULES.le_drop_10_percent.action).toBe('increase_exploration');

      expect(DEGRADATION_RULES.le_drop_20_percent.severity).toBe('danger');
      expect(DEGRADATION_RULES.le_drop_20_percent.action).toBe('switch_to_rule_engine');

      expect(DEGRADATION_RULES.le_drop_30_percent.severity).toBe('critical');
      expect(DEGRADATION_RULES.le_drop_30_percent.action).toBe('immediate_rollback');

      expect(DEGRADATION_RULES.accuracy_drop_15_percent.severity).toBe('danger');
      expect(DEGRADATION_RULES.accuracy_drop_15_percent.action).toBe('switch_to_rule_engine');
    });

    it('should handle warning severity with logging only', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'running',
        lastHealthCheck: null,
        healthStatus: null,
      });
      mockPrisma.canaryRelease.update.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'running',
        healthStatus: 'warning',
        lastHealthCheck: new Date(),
      });

      await gracefulDegrader.degrade(TEST_TEMPLATE_ID, 'LE dropped 10%', 'warning');

      // Warning only logs, does not change canary status
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'degrade',
          entity: 'template',
          entityId: TEST_TEMPLATE_ID,
          changes: { reason: 'LE dropped 10%', severity: 'warning' },
        }),
      });
    });

    it('should switch to rule engine on danger severity', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'running',
        healthStatus: null,
        lastHealthCheck: null,
      });
      mockPrisma.canaryRelease.update.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'paused',
        healthStatus: 'danger',
        lastHealthCheck: new Date(),
      });

      await gracefulDegrader.degrade(TEST_TEMPLATE_ID, 'LE dropped 20%', 'danger');

      // First verify audit log was called twice (degrade + switch_to_rule_engine)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2);

      // Then verify canary status update for danger
      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith({
        where: { templateId: TEST_TEMPLATE_ID },
        data: expect.objectContaining({ status: 'paused' }),
      });
    });

    it('should immediate rollback on critical severity', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'running',
        healthStatus: null,
        lastHealthCheck: null,
      });
      mockPrisma.canaryRelease.update.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'rolled_back',
        trafficPercent: 0,
        healthStatus: 'danger',
        lastHealthCheck: new Date(),
      });

      await gracefulDegrader.degrade(TEST_TEMPLATE_ID, 'LE dropped 30%', 'critical');

      // Critical should rollback canary
      expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2); // degrade + immediate_rollback
      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith({
        where: { templateId: TEST_TEMPLATE_ID },
        data: expect.objectContaining({
          status: 'rolled_back',
          trafficPercent: 0,
        }),
      });
    });

    it('should get degradation status', async () => {
      mockPrisma.canaryRelease.findUnique.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'paused',
        healthStatus: 'danger',
        lastHealthCheck: new Date(),
      });

      const status = await gracefulDegrader.getDegradationStatus(TEST_TEMPLATE_ID);

      expect(status.templateId).toBe(TEST_TEMPLATE_ID);
      expect(status.status).toBe('danger');
      expect(status.currentStrategy).toBe('rule_engine'); // paused = rule_engine
    });

    it('should recover from degraded state', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.canaryRelease.update.mockResolvedValue({
        id: 'canary-1',
        templateId: TEST_TEMPLATE_ID,
        status: 'running',
        healthStatus: 'healthy',
      });

      await gracefulDegrader.recover(TEST_TEMPLATE_ID);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'recover',
          entity: 'template',
          entityId: TEST_TEMPLATE_ID,
        }),
      });
      expect(mockPrisma.canaryRelease.update).toHaveBeenCalledWith({
        where: { templateId: TEST_TEMPLATE_ID },
        data: expect.objectContaining({
          status: 'running',
          healthStatus: 'healthy',
        }),
      });
    });

    it('should return correct degradation action for severity', () => {
      expect(gracefulDegrader.getDegradationAction('warning')).toBe('increase_exploration');
      expect(gracefulDegrader.getDegradationAction('danger')).toBe('switch_to_rule_engine');
      expect(gracefulDegrader.getDegradationAction('critical')).toBe('immediate_rollback');
    });
  });

  describe('Test 5: Full Pipeline Validation', () => {
    it('should calculate LE correctly', async () => {
      // Mock RL training logs with known values
      mockPrisma.rLTrainingLog.groupBy.mockResolvedValue([
        { knowledgePointId: 'kp-1', _avg: { leDelta: 0.20 }, _count: 50 },
        { knowledgePointId: 'kp-2', _avg: { leDelta: 0.10 }, _count: 80 },
        { knowledgePointId: 'kp-3', _avg: { leDelta: 0.15 }, _count: 60 },
      ]);

      const globalLE = await leAnalyzer.calculateGlobalLE();

      // Average of (0.20 + 0.10 + 0.15) / 3 = 0.15
      expect(globalLE.le).toBeCloseTo(0.15, 2);

      // Confidence: min(1, totalSample / 100) = min(1, 190/100) = 1
      expect(globalLE.confidence).toBeCloseTo(1.0, 1);

      // Total sample size
      const totalSample = globalLE.byKnowledgePoint.reduce((sum, kp) => sum + kp.sampleSize, 0);
      expect(totalSample).toBe(190);
    });

    it('should calculate uplift in experiment correctly', async () => {
      // Use larger effect size to ensure statistical significance
      // diff = 0.1, n = 200 per group gives z = 1.98, p < 0.05
      mockPrisma.effectObservation.groupBy.mockResolvedValue([
        { variant: 'control', _avg: { value: 0.10 }, _count: 200 },
        { variant: 'treatment', _avg: { value: 0.20 }, _count: 200 },
      ]);

      const result = await leAnalyzer.calculateUplift(TEST_EXPERIMENT_ID);

      // Uplift: ((0.20 - 0.10) / 0.10) * 100 = 100%
      expect(result.uplift).toBeCloseTo(100, 0);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it('should analyze experiment and provide recommendation', async () => {
      mockPrisma.effectExperiment.findUnique.mockResolvedValue({
        id: TEST_EXPERIMENT_ID,
        name: 'Test Experiment',
        minSampleSize: 50,
      });

      // Use large effect size: 0.10 -> 0.20 = 100% uplift for reliable significance
      mockPrisma.effectObservation.groupBy.mockResolvedValue([
        { variant: 'control', _avg: { value: 0.10 }, _count: 200 },
        { variant: 'treatment', _avg: { value: 0.20 }, _count: 200 },
      ]);

      const result = await experimentManager.analyzeExperiment(TEST_EXPERIMENT_ID);

      expect(result.controlMean).toBeCloseTo(0.10);
      expect(result.treatmentMean).toBeCloseTo(0.20);
      expect(result.controlSample).toBe(200);
      expect(result.treatmentSample).toBe(200);

      // Uplift: ((0.20 - 0.10) / 0.10) * 100 = 100%
      expect(result.uplift).toBeCloseTo(100, 0);

      // With large effect size and adequate sample, should be significant
      expect(result.significant).toBe(true);
      expect(result.recommendation).toBe('promote');
    });

    it('should handle insufficient samples in experiment', async () => {
      mockPrisma.effectExperiment.findUnique.mockResolvedValue({
        id: TEST_EXPERIMENT_ID,
        name: 'Test Experiment',
        minSampleSize: 100, // Requires 100 samples
      });

      mockPrisma.effectObservation.groupBy.mockResolvedValue([
        { variant: 'control', _avg: { value: 0.10 }, _count: 30 },
        { variant: 'treatment', _avg: { value: 0.12 }, _count: 25 },
      ]);

      const result = await experimentManager.analyzeExperiment(TEST_EXPERIMENT_ID);

      expect(result.recommendation).toBe('need_more_data');
    });

    it('should calculate shadow mode accuracy correctly', async () => {
      mockPrisma.shadowAttempt.findMany.mockResolvedValue([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
      ]);

      const result = await shadowCollector.calculateAccuracy(TEST_TEMPLATE_ID);

      expect(result.accuracy).toBeCloseTo(0.8); // 4/5 = 0.8
      expect(result.sample).toBe(5);
    });

    it('should handle empty shadow data', async () => {
      mockPrisma.shadowAttempt.findMany.mockResolvedValue([]);

      const result = await shadowCollector.calculateAccuracy(TEST_TEMPLATE_ID);

      expect(result.accuracy).toBe(0);
      expect(result.sample).toBe(0);
    });
  });
});