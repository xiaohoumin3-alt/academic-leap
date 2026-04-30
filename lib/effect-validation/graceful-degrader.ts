import type { Severity, DegradationStatus, DegradationRule } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Degradation rules for LE (Learning Effectiveness) metrics.
 * Each rule defines the severity and corresponding action when triggered.
 */
export const DEGRADATION_RULES: Record<string, DegradationRule> = {
  le_drop_10_percent: {
    severity: 'warning',
    action: 'increase_exploration',
    description: 'LE 下降 10%，增加探索比例',
  },
  le_drop_20_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: 'LE 下降 20%，降级到规则引擎',
  },
  le_drop_30_percent: {
    severity: 'critical',
    action: 'immediate_rollback',
    description: 'LE 下降 30%，立即回滚',
  },
  accuracy_drop_15_percent: {
    severity: 'danger',
    action: 'switch_to_rule_engine',
    description: '正确率下降 15%，降级到规则引擎',
  },
};

/**
 * GracefulDegrader handles graceful degradation when metrics degrade.
 *
 * Degradation levels:
 * - warning: LE drop 10% → increase exploration
 * - danger: LE drop 20% → switch to rule engine
 * - critical: LE drop 30% → immediate rollback
 */
export class GracefulDegrader {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Main degradation handler. Logs the degradation and takes action based on severity.
   */
  async degrade(templateId: string, reason: string, severity: Severity): Promise<void> {
    // Log the degradation
    await this.prisma.auditLog.create({
      data: {
        action: 'degrade',
        entity: 'template',
        entityId: templateId,
        changes: { reason, severity },
      },
    });

    // Update canary health status
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        healthStatus: severity === 'danger' ? 'danger' : severity === 'warning' ? 'warning' : undefined,
        lastHealthCheck: new Date(),
      },
    });

    // Execute degradation action based on severity
    switch (severity) {
      case 'warning':
        // Just log and continue with increased monitoring
        break;
      case 'danger':
        await this.switchToRuleEngine(templateId);
        break;
      case 'critical':
        await this.immediateRollback(templateId);
        break;
    }
  }

  /**
   * Switch template to use rule engine instead of RL.
   *
   * Effects:
   * 1. Audit log is created
   * 2. Canary is paused
   *
   * Note: When Template model has a strategy field, update it here.
   */
  async switchToRuleEngine(templateId: string): Promise<void> {
    // Log the switch
    await this.prisma.auditLog.create({
      data: {
        action: 'switch_to_rule_engine',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Pause canary (this is the primary signal that rule engine is active)
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'paused' },
    });
  }

  /**
   * Immediately rollback canary release to 0 traffic.
   */
  async immediateRollback(templateId: string): Promise<void> {
    // Log the rollback
    await this.prisma.auditLog.create({
      data: {
        action: 'immediate_rollback',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Rollback canary
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'rolled_back',
        trafficPercent: 0,
      },
    });
  }

  /**
   * Recover template from degraded state.
   * Resumes canary with healthy status.
   */
  async recover(templateId: string): Promise<void> {
    // Log recovery
    await this.prisma.auditLog.create({
      data: {
        action: 'recover',
        entity: 'template',
        entityId: templateId,
      },
    });

    // Resume canary from paused state
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'running',
        healthStatus: 'healthy',
      },
    });
  }

  /**
   * Get current degradation status for a template.
   */
  async getDegradationStatus(templateId: string): Promise<DegradationStatus> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });

    if (!canary) {
      return {
        templateId,
        status: 'healthy',
        currentStrategy: 'rl',
      };
    }

    // Determine current strategy based on canary status
    const currentStrategy = canary.status === 'paused' ? 'rule_engine' : 'rl';

    return {
      templateId,
      status: (canary.healthStatus as DegradationStatus['status']) ?? 'healthy',
      currentStrategy,
      degradedAt: canary.lastHealthCheck ?? undefined,
    };
  }

  /**
   * Get degradation action for a given severity level.
   */
  getDegradationAction(severity: Severity): string {
    switch (severity) {
      case 'warning':
        return DEGRADATION_RULES.le_drop_10_percent.action;
      case 'danger':
        return DEGRADATION_RULES.le_drop_20_percent.action;
      case 'critical':
        return DEGRADATION_RULES.le_drop_30_percent.action;
    }
  }
}
