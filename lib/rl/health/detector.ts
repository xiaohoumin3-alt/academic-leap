import type { HealthMetrics, HealthStatus, HealthLevel } from './types';
import { COLLAPSE_BOUNDARIES, getHealthLevel, getHealthLevelInverted } from './thresholds';

export function detectFailure(metrics: HealthMetrics): HealthStatus {
  const alerts: string[] = [];
  let worstLevel: HealthLevel = 'healthy';

  // Check LE
  const leLevel = getHealthLevel(metrics.le, COLLAPSE_BOUNDARIES.le);
  worstLevel = getWorseLevel(worstLevel, capAtDanger(leLevel));
  if (leLevel !== 'healthy') {
    alerts.push(`LE=${metrics.le.toFixed(3)} (${leLevel})`);
  }

  // Check CS
  const csLevel = getHealthLevel(metrics.cs, COLLAPSE_BOUNDARIES.cs);
  worstLevel = getWorseLevel(worstLevel, capAtDanger(csLevel));
  if (csLevel !== 'healthy') {
    alerts.push(`CS=${metrics.cs.toFixed(2)} (${csLevel})`);
  }

  // Check label noise (capped at danger, collapsed only from explicit condition)
  const noiseLevel = getHealthLevelInverted(metrics.labelNoiseRate, COLLAPSE_BOUNDARIES.labelNoise);
  worstLevel = getWorseLevel(worstLevel, capAtDanger(noiseLevel));
  if (noiseLevel !== 'healthy') {
    alerts.push(`标签噪声=${(metrics.labelNoiseRate * 100).toFixed(1)}% (${noiseLevel})`);
  }

  // Check feedback delay (capped at danger)
  const delayLevel = getHealthLevelInverted(metrics.feedbackDelaySteps, COLLAPSE_BOUNDARIES.feedbackDelay);
  worstLevel = getWorseLevel(worstLevel, capAtDanger(delayLevel));
  if (delayLevel !== 'healthy') {
    alerts.push(`反馈延迟=${metrics.feedbackDelaySteps}步 (${delayLevel})`);
  }

  // Check pseudo-convergence
  if (metrics.isPseudoConverged) {
    alerts.push(`伪收敛: ${metrics.pseudoConvergenceReason || '未知原因'}`);
    worstLevel = getWorseLevel(worstLevel, 'warning');
  }

  // Check collapsed (only this specific condition sets collapsed state)
  if (metrics.le < 0 && metrics.cs < 0.5) {
    worstLevel = 'collapsed';
    alerts.push('系统崩溃：LE为负且CS过低');
  }

  // Check DFI
  if (metrics.dfi < 0.99) {
    alerts.push(`DFI=${(metrics.dfi * 100).toFixed(1)}% 低于99%`);
  }

  return {
    level: worstLevel,
    metrics,
    alerts,
    timestamp: new Date(),
  };
}

/**
 * Cap health level at 'danger' - 'collapsed' is only set by explicit conditions
 */
function capAtDanger(level: HealthLevel): HealthLevel {
  return level === 'collapsed' ? 'danger' : level;
}

function getWorseLevel(current: HealthLevel, candidate: HealthLevel): HealthLevel {
  const levels: HealthLevel[] = ['healthy', 'warning', 'danger', 'collapsed'];
  const currentIndex = levels.indexOf(current);
  const candidateIndex = levels.indexOf(candidate);

  return levels[Math.max(currentIndex, candidateIndex)];
}
