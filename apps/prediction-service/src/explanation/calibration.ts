/**
 * Calibration Module for Brier Score Optimization
 *
 * Implements Temperature Scaling - the simplest and most effective
 * method for calibrating probabilistic predictions.
 *
 * Brier Score = mean((prediction - actual)^2)
 * Lower is better. Target: < 0.2
 */

export interface CalibrationConfig {
  temperature: number;  // > 1 = less confident, < 1 = more confident
}

export interface CalibrationResult {
  calibratedProbability: number;
  originalProbability: number;
}

/**
 * Default calibration config
 * Temperature = 1.2 means slightly less confident predictions
 * This helps reduce overconfidence which increases Brier Score
 */
export const DEFAULT_CALIBRATION: CalibrationConfig = {
  temperature: 1.2
};

/**
 * Convert probability to logit
 */
export function probabilityToLogit(p: number): number {
  const clipped = Math.max(0.001, Math.min(0.999, p));
  return Math.log(clipped / (1 - clipped));
}

/**
 * Convert logit back to probability
 */
export function logitToProbability(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}

/**
 * Apply temperature scaling to a probability
 *
 * Higher temperature = less confident (predictions pushed toward 0.5)
 * Lower temperature = more confident (predictions pushed toward 0/1)
 *
 * For Brier Score optimization, we typically want higher temperature
 * to reduce overconfidence.
 */
export function calibrateProbability(
  probability: number,
  config: CalibrationConfig = DEFAULT_CALIBRATION
): CalibrationResult {
  const originalProbability = probability;

  // Convert to logit
  const logit = probabilityToLogit(probability);

  // Apply temperature scaling
  const scaledLogit = logit / config.temperature;

  // Convert back to probability
  const calibratedProbability = logitToProbability(scaledLogit);

  return {
    calibratedProbability,
    originalProbability
  };
}

/**
 * Find optimal temperature using cross-validation
 *
 * @param predictions - Array of raw predictions
 * @param actuals - Array of actual outcomes (0 or 1)
 * @returns Optimal temperature value
 */
export function findOptimalTemperature(
  predictions: number[],
  actuals: number[]
): number {
  const temperatures = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0];
  let bestTemp = 1.0;
  let bestBrier = Infinity;

  for (const temp of temperatures) {
    const brierScore = calculateBrierScoreWithTemperature(predictions, actuals, temp);
    if (brierScore < bestBrier) {
      bestBrier = brierScore;
      bestTemp = temp;
    }
  }

  return bestTemp;
}

/**
 * Calculate Brier Score with temperature scaling applied
 */
export function calculateBrierScoreWithTemperature(
  predictions: number[],
  actuals: number[],
  temperature: number
): number {
  let totalBrier = 0;

  for (let i = 0; i < predictions.length; i++) {
    const calibrated = calibrateProbability(predictions[i], { temperature });
    const actual = actuals[i];
    totalBrier += Math.pow(calibrated.calibratedProbability - actual, 2);
  }

  return totalBrier / predictions.length;
}

/**
 * Calculate Brier Score for raw predictions
 */
export function calculateBrierScore(
  predictions: number[],
  actuals: number[]
): number {
  return calculateBrierScoreWithTemperature(predictions, actuals, 1.0);
}

/**
 * Check if predictions are well-calibrated
 * Returns calibration error (lower is better)
 */
export function calculateCalibrationError(
  predictions: number[],
  actuals: number[],
  numBins: number = 10
): number {
  const bins: Map<number, { sumPred: number; sumActual: number; count: number }> = new Map();

  // Initialize bins
  for (let i = 0; i < numBins; i++) {
    bins.set(i, { sumPred: 0, sumActual: 0, count: 0 });
  }

  // Fill bins
  for (let i = 0; i < predictions.length; i++) {
    const binIndex = Math.min(numBins - 1, Math.floor(predictions[i] * numBins));
    const bin = bins.get(binIndex)!;
    bin.sumPred += predictions[i];
    bin.sumActual += actuals[i];
    bin.count++;
  }

  // Calculate expected calibration error (ECE)
  let ece = 0;
  for (const bin of bins.values()) {
    if (bin.count > 0) {
      const avgPred = bin.sumPred / bin.count;
      const avgActual = bin.sumActual / bin.count;
      ece += (bin.count / predictions.length) * Math.abs(avgPred - avgActual);
    }
  }

  return ece;
}
