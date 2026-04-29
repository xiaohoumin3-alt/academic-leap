// lib/rl/health/metrics.ts

import type { ResponseRecord, RecommendationRecord } from './types';

/**
 * 计算学习有效性 (LE - Learning Effectiveness)
 */
export function calculateLE(responses: ResponseRecord[], windowSize: number = 100): number {
  if (responses.length < 2) return 0;

  const window = responses.slice(-windowSize);
  const initialTheta = window[0].theta;
  const finalTheta = window[window.length - 1].theta;

  return finalTheta - initialTheta;
}

/**
 * 计算收敛稳定性 (CS - Convergence Stability)
 */
export function calculateCS(recommendations: RecommendationRecord[], windowSize: number = 50): number {
  if (recommendations.length === 0) return 0;

  const window = recommendations.slice(-windowSize);

  if (window.length === 1) return 1;

  const deltaCs = window.map(r => r.deltaC);
  const mean = deltaCs.reduce((sum, d) => sum + d, 0) / deltaCs.length;
  const variance = deltaCs.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / deltaCs.length;

  const maxVariance = Math.pow(5 - 1, 2) / 4;
  const cs = 1 - variance / maxVariance;

  return Math.max(0, Math.min(1, cs));
}

/**
 * 计算标签噪声率
 * 噪声定义：标签与模型期望不一致的情况（可能是标注错误）
 */
export function calculateLabelNoiseRate(responses: ResponseRecord[], windowSize: number = 20): number {
  if (responses.length === 0) return 0;

  const window = responses.slice(-windowSize);

  let noiseCount = 0;

  for (const response of window) {
    const { theta, deltaC, correct } = response;

    // 模型期望：theta > deltaC - 1.5 时应该答对
    const expectedCorrect = theta > deltaC - 1.5;

    // 噪声：标签与模型期望不一致
    if (expectedCorrect !== correct) {
      noiseCount++;
    }
  }

  return noiseCount / window.length;
}

/**
 * 计算数据链完整度 (DFI - Data Flow Integrity)
 */
export function calculateDFI(totalEvents: number, completeEvents: number): number {
  if (totalEvents === 0) return 1;
  return completeEvents / totalEvents;
}
