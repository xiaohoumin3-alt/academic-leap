// lib/rl/monitor/reward-drift.ts

export interface RewardDrift {
  timestamp: Date;
  oldMean: number;
  newMean: number;
  changePercent: number;
  isSignificant: boolean;
}

/**
 * Calculate mean of reward values
 *
 * @param values - Array of reward values
 * @returns Mean of the values, or 0 if array is empty
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Detect reward drift in RL reward history
 *
 * Splits history into older/recent halves and compares means.
 *
 * Significance threshold: |changePercent| > 0.2 (20%)
 *
 * changePercent = (newMean - oldMean) / oldMean
 *
 * @param rewardHistory - Array of reward values in chronological order
 * @param windowSize - Optional sliding window size (default: all history)
 * @returns RewardDrift object if significant drift detected, null otherwise
 */
export function detectRewardDrift(
  rewardHistory: number[],
  windowSize?: number
): RewardDrift | null {
  // Need at least 2 values to split into halves
  if (rewardHistory.length < 2) {
    return null;
  }

  // Apply sliding window if specified
  const window = windowSize
    ? rewardHistory.slice(-windowSize)
    : rewardHistory;

  if (window.length < 2) {
    return null;
  }

  // Split into older/recent halves
  const midPoint = Math.floor(window.length / 2);
  const olderHalf = window.slice(0, midPoint);
  const recentHalf = window.slice(midPoint);

  // Calculate means for each half
  const oldMean = calculateMean(olderHalf);
  const newMean = calculateMean(recentHalf);

  // Avoid division by zero
  if (oldMean === 0) {
    return null;
  }

  // Calculate percentage change
  const changePercent = (newMean - oldMean) / oldMean;

  // Check for significant drift (> 20% absolute change)
  const isSignificant = Math.abs(changePercent) > 0.2;

  if (!isSignificant) {
    return null;
  }

  return {
    timestamp: new Date(),
    oldMean,
    newMean,
    changePercent,
    isSignificant,
  };
}
