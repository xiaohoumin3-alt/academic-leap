/**
 * Feature Normalizer
 *
 * Rolling window z-score normalization for Thompson Sampling distribution alignment.
 * Solves the training/inference distribution mismatch problem.
 */

import type { NormalizerConfig } from '../config/phase3-features';

/**
 * Statistics for a normalized feature
 */
export interface NormalizationStats {
  mean: number;
  std: number;
  count: number;
}

/**
 * Default configuration values
 */
const DEFAULT_WINDOW_SIZE = 1000;

/**
 * Rolling window z-score normalizer for RL features.
 *
 * Tracks running statistics using a fixed-size rolling window to normalize
 * values before feeding them to Thompson Sampling, ensuring distribution
 * consistency between training and inference.
 */
export class FeatureNormalizer {
  private windows: Map<string, number[]>;
  private windowSize: number;

  constructor(config?: NormalizerConfig) {
    this.windows = new Map();
    this.windowSize = config?.windowSize ?? DEFAULT_WINDOW_SIZE;
  }

  /**
   * Normalize a value using z-score: (value - mean) / std
   *
   * @param value - Raw value to normalize
   * @param feature - Feature name (e.g., 'reward', 'theta')
   * @returns Normalized value, or 0 if insufficient data or std is 0
   */
  normalize(value: number, feature: string): number {
    const stats = this.getStats(feature);

    // Return 0 when count < 2 (need at least 2 samples for meaningful std)
    if (stats.count < 2) {
      return 0;
    }

    // Return 0 when std is 0 (all values identical)
    if (stats.std === 0) {
      return 0;
    }

    return (value - stats.mean) / stats.std;
  }

  /**
   * Denormalize a z-score back to original scale: mean + (z * std)
   *
   * @param normalized - Normalized (z-score) value
   * @param feature - Feature name
   * @returns Denormalized value, or 0 if insufficient data
   */
  denormalize(normalized: number, feature: string): number {
    const stats = this.getStats(feature);

    // Return 0 when count < 2
    if (stats.count < 2) {
      return 0;
    }

    return stats.mean + normalized * stats.std;
  }

  /**
   * Add a new value to the rolling window for a feature.
   * Maintains window size by evicting oldest values when full.
   *
   * @param value - New value to add
   * @param feature - Feature name
   */
  update(value: number, feature: string): void {
    let window = this.windows.get(feature);

    if (!window) {
      window = [];
      this.windows.set(feature, window);
    }

    window.push(value);

    // Evict oldest values if window exceeds size limit
    while (window.length > this.windowSize) {
      window.shift();
    }
  }

  /**
   * Get current statistics for a feature.
   *
   * @param feature - Feature name
   * @returns Statistics object with mean, std, and count
   */
  getStats(feature: string): NormalizationStats {
    const window = this.windows.get(feature);

    if (!window || window.length === 0) {
      return { mean: 0, std: 0, count: 0 };
    }

    const count = window.length;
    const mean = window.reduce((sum, v) => sum + v, 0) / count;

    // Compute sample standard deviation (Bessel's correction)
    // std = sqrt(sum((x - mean)^2) / (n - 1))
    // For n=1, this returns 0 (handled by count < 2 check above)
    let sumSquaredDiff = 0;
    for (const v of window) {
      const diff = v - mean;
      sumSquaredDiff += diff * diff;
    }
    const variance = count > 1 ? sumSquaredDiff / (count - 1) : 0;
    const std = Math.sqrt(variance);

    return { mean, std, count };
  }
}
