// lib/rl/monitor/ability-drift.ts

export interface AbilityDrift {
  timestamp: Date;
  oldMean: number;
  newMean: number;
  oldStd: number;
  newStd: number;
  ksTestPValue: number;
}

/**
 * Calculate mean and standard deviation of a sample
 *
 * Uses Welford's algorithm for numerical stability
 *
 * @param values - Array of numeric values
 * @returns Object containing mean and standard deviation
 */
export function calculateStats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) {
    return { mean: 0, std: 0 };
  }

  if (values.length === 1) {
    return { mean: values[0], std: 0 };
  }

  // Welford's algorithm for numerical stability
  let mean = values[0];
  let m2 = 0;

  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - mean;
    mean += delta / (i + 1);
    const delta2 = values[i] - mean;
    m2 += delta * delta2;
  }

  const variance = m2 / values.length;
  const std = Math.sqrt(variance);

  return { mean, std };
}

/**
 * Compute empirical CDF value for a given sample
 *
 * @param sample - Sorted array of values
 * @param x - Value to evaluate CDF at
 * @returns Proportion of sample values <= x
 */
function empiricalCdf(sample: number[], x: number): number {
  if (sample.length === 0) {
    return 0;
  }

  // Count values <= x
  let count = 0;
  for (const value of sample) {
    if (value <= x) {
      count++;
    }
  }

  return count / sample.length;
}

/**
 * Kolmogorov-Smirnov test for comparing two samples
 *
 * Tests the null hypothesis that both samples come from the same distribution.
 *
 * Returns the p-value using the approximation:
 * p-value ≈ 2 * exp(-2 * ksStatistic^2)
 *
 * @param sample1 - First sample
 * @param sample2 - Second sample
 * @returns p-value (smaller values indicate more significant difference)
 */
export function ksTest(sample1: number[], sample2: number[]): number {
  if (sample1.length === 0 && sample2.length === 0) {
    return 1; // No difference between empty samples
  }

  if (sample1.length === 0 || sample2.length === 0) {
    return 1; // Treat empty sample as having no difference
  }

  // Sort both samples
  const sorted1 = [...sample1].sort((a, b) => a - b);
  const sorted2 = [...sample2].sort((a, b) => a - b);

  // Get all unique points where CDF might change
  const allPoints = new Set([...sorted1, ...sorted2]);

  // Find maximum difference in CDFs
  let maxDiff = 0;
  for (const point of allPoints) {
    const cdf1 = empiricalCdf(sorted1, point);
    const cdf2 = empiricalCdf(sorted2, point);
    const diff = Math.abs(cdf1 - cdf2);
    maxDiff = Math.max(maxDiff, diff);
  }

  // Calculate effective sample size for KS test
  const n1 = sample1.length;
  const n2 = sample2.length;
  const effectiveN = (n1 * n2) / (n1 + n2);

  // KS statistic scaled by sample size
  const ksStatistic = maxDiff * Math.sqrt(effectiveN);

  // P-value approximation (Kolmogorov distribution)
  // This is a simplified approximation suitable for most practical purposes
  const pValue = 2 * Math.exp(-2 * ksStatistic * ksStatistic);

  return Math.min(pValue, 1); // Clamp to [0, 1]
}

/**
 * Detect ability drift in student theta values over time
 *
 * Uses Kolmogorov-Smirnov test to compare the distribution of
 * theta values in the first half vs the second half of the history.
 *
 * Significance threshold: p < 0.05 indicates significant drift
 *
 * @param thetaHistory - Array of theta values in chronological order
 * @param windowSize - Optional sliding window size (default: 20)
 * @returns AbilityDrift object if significant drift detected, null otherwise
 */
export function detectAbilityDrift(
  thetaHistory: number[],
  windowSize: number = 20
): AbilityDrift | null {
  if (thetaHistory.length < 4) {
    // Not enough data to split into two halves
    return null;
  }

  // Apply sliding window
  const window = thetaHistory.slice(-windowSize);

  if (window.length < 4) {
    return null;
  }

  // Split into older/recent halves
  const midPoint = Math.floor(window.length / 2);
  const olderHalf = window.slice(0, midPoint);
  const recentHalf = window.slice(midPoint);

  // Calculate statistics for both halves
  const oldStats = calculateStats(olderHalf);
  const newStats = calculateStats(recentHalf);

  // Perform KS test
  const pValue = ksTest(olderHalf, recentHalf);

  // Check for significant drift
  if (pValue >= 0.05) {
    return null;
  }

  return {
    timestamp: new Date(),
    oldMean: oldStats.mean,
    newMean: newStats.mean,
    oldStd: oldStats.std,
    newStd: newStats.std,
    ksTestPValue: pValue,
  };
}
