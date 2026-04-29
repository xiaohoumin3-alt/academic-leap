// lib/rl/health/thresholds.ts

import type { ThresholdConfig } from './types';

/**
 * 崩溃边界阈值
 *
 * 基于 PRODUCT.md#崩溃边界 定义
 *
 * | 指标 | 正常 | 警告 | 危险 | 崩溃 |
 * |------|------|------|------|------|
 * | LE | > 15% | 5-15% | 0-5% | < 0% |
 * | CS | > 85% | 70-85% | 50-70% | < 50% |
 * | 标签噪声 | < 10% | 10-20% | 20-30% | > 30% |
 * | 反馈延迟 | < 5步 | 5-15步 | 15-30步 | > 30步 |
 */
export const COLLAPSE_BOUNDARIES: ThresholdConfig = {
  le: {
    healthy: 0.15,
    warning: 0.05,
    danger: 0.0,
  },
  cs: {
    healthy: 0.85,
    warning: 0.70,
    danger: 0.50,
  },
  labelNoise: {
    healthy: 0.10,
    warning: 0.20,
    danger: 0.30,
  },
  feedbackDelay: {
    healthy: 5,
    warning: 15,
    danger: 30,
  },
};

/**
 * 获取指标的健康等级（越高越好）
 */
export function getHealthLevel(
  value: number,
  config: typeof COLLAPSE_BOUNDARIES[keyof ThresholdConfig]
): 'healthy' | 'warning' | 'danger' {
  if (value >= config.healthy) return 'healthy';
  if (value >= config.warning) return 'warning';
  if (value >= config.danger) return 'danger';
  return 'danger';
}

/**
 * 获取指标的健康等级（越低越好）
 * 用于噪声率和延迟
 */
export function getHealthLevelInverted(
  value: number,
  config: typeof COLLAPSE_BOUNDARIES[keyof ThresholdConfig]
): 'healthy' | 'warning' | 'danger' {
  if (value <= config.healthy) return 'healthy';
  if (value <= config.warning) return 'warning';
  if (value <= config.danger) return 'danger';
  return 'danger';
}
