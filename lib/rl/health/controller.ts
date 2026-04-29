import type { HealthStatus, DegradationAction } from './types';

export function decideDegradation(status: HealthStatus): DegradationAction {
  // 特殊处理：伪收敛直接切换到规则引擎
  if (status.metrics.isPseudoConverged) {
    return {
      type: 'switch_to_rule',
      reason: `伪收敛检测到: ${status.metrics.pseudoConvergenceReason || '未知原因'}，切换到规则引擎`,
    };
  }

  switch (status.level) {
    case 'healthy':
      return {
        type: 'continue',
        reason: 'System normal',
      };

    case 'warning':
      return {
        type: 'increase_exploration',
        reason: `检测到异常: ${status.alerts.join(', ')}，增大exploration帮助恢复`,
      };

    case 'danger':
      return {
        type: 'switch_to_rule',
        reason: `系统降级: ${status.alerts.join(', ')}，切换到规则引擎兜底`,
      };

    case 'collapsed':
      return {
        type: 'stop',
        reason: `系统崩溃: ${status.alerts.join(', ')}，需要人工介入`,
      };

    default:
      const _exhaustive: never = status.level;
      return {
        type: 'stop',
        reason: 'Unknown state',
      };
  }
}
