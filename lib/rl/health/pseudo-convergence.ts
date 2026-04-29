import type { HealthMetrics } from './types';

export interface PseudoConvergenceResult {
  isPseudoConverged: boolean;
  reason?: string;
}

export function detectPseudoConvergence(metrics: HealthMetrics): PseudoConvergenceResult {
  // 条件1: CS高但LE接近0
  if (metrics.cs > 0.8 && Math.abs(metrics.le) < 0.01) {
    return {
      isPseudoConverged: true,
      reason: `CS高但LE接近0`,
    };
  }

  // 条件2: LE为负（学生在退步）
  if (metrics.le < 0) {
    return {
      isPseudoConverged: true,
      reason: `LE为负(${metrics.le.toFixed(3)})，学生在退步`,
    };
  }

  // 条件3: Reward方差高但CS看起来正常
  if (metrics.rewardLossRate > 0.5 && metrics.cs > 0.7) {
    return {
      isPseudoConverged: true,
      reason: `Reward方差高(${metrics.rewardLossRate.toFixed(2)})但CS看起来正常`,
    };
  }

  return {
    isPseudoConverged: false,
  };
}
