/**
 * Calibration Tests - TDD for Brier Score Optimization
 *
 * RED Phase: These tests define expected behavior
 * GREEN Phase: Implement code to make tests pass
 */

import { describe, it, expect } from 'vitest';
import {
  calibrateProbability,
  probabilityToLogit,
  logitToProbability,
  findOptimalTemperature,
  calculateBrierScoreWithTemperature,
  calculateBrierScore,
  calculateCalibrationError,
  DEFAULT_CALIBRATION
} from './calibration';

describe('Calibration Module', () => {

  describe('probabilityToLogit', () => {
    it('converts 0.5 to 0', () => {
      expect(probabilityToLogit(0.5)).toBeCloseTo(0, 5);
    });

    it('converts 0.73 to positive value', () => {
      const logit = probabilityToLogit(0.73);
      expect(logit).toBeGreaterThan(0);
    });

    it('converts 0.27 to negative value', () => {
      const logit = probabilityToLogit(0.27);
      expect(logit).toBeLessThan(0);
    });

    it('handles boundary values', () => {
      // Should not return Infinity
      expect(probabilityToLogit(0.001)).toBeLessThan(Infinity);
      expect(probabilityToLogit(0.999)).toBeLessThan(Infinity);
    });
  });

  describe('logitToProbability', () => {
    it('converts 0 back to 0.5', () => {
      expect(logitToProbability(0)).toBeCloseTo(0.5, 5);
    });

    it('is inverse of probabilityToLogit', () => {
      const original = 0.73;
      const logit = probabilityToLogit(original);
      const back = logitToProbability(logit);
      expect(back).toBeCloseTo(original, 5);
    });
  });

  describe('calibrateProbability', () => {
    it('pushes high probability toward 0.5 with temp > 1', () => {
      const result = calibrateProbability(0.9, { temperature: 1.5 });
      expect(result.calibratedProbability).toBeLessThan(0.9);
      expect(result.calibratedProbability).toBeGreaterThan(0.5);
    });

    it('pushes low probability toward 0.5 with temp > 1', () => {
      const result = calibrateProbability(0.1, { temperature: 1.5 });
      expect(result.calibratedProbability).toBeGreaterThan(0.1);
      expect(result.calibratedProbability).toBeLessThan(0.5);
    });

    it('preserves probability at temp = 1', () => {
      const result = calibrateProbability(0.7, { temperature: 1.0 });
      expect(result.calibratedProbability).toBeCloseTo(0.7, 5);
    });

    it('increases confidence with temp < 1', () => {
      const result = calibrateProbability(0.6, { temperature: 0.8 });
      // 0.6 should move away from 0.5
      expect(result.calibratedProbability).not.toBeCloseTo(0.6, 2);
    });

    it('returns original probability in result', () => {
      const result = calibrateProbability(0.75);
      expect(result.originalProbability).toBe(0.75);
    });

    it('handles extreme predictions', () => {
      // Very confident predictions should still be valid
      const result = calibrateProbability(0.99, { temperature: 1.2 });
      expect(result.calibratedProbability).toBeGreaterThan(0.5);
      expect(result.calibratedProbability).toBeLessThan(1);
    });
  });

  describe('calculateBrierScore', () => {
    it('returns 0 for perfect predictions', () => {
      const predictions = [1, 0, 1, 1, 0];
      const actuals = [1, 0, 1, 1, 0];
      expect(calculateBrierScore(predictions, actuals)).toBeCloseTo(0, 5);
    });

    it('returns 0.25 for always predicting 0.5', () => {
      const predictions = [0.5, 0.5, 0.5, 0.5, 0.5];
      const actuals = [1, 0, 1, 0, 1];
      expect(calculateBrierScore(predictions, actuals)).toBeCloseTo(0.25, 2);
    });

    it('returns high score for completely wrong predictions', () => {
      const predictions = [0, 1, 0, 1, 0];
      const actuals = [1, 0, 1, 0, 1];
      // Brier = mean((pred - actual)^2) = mean(1 + 1 + 1 + 1 + 1) / 5 = 1
      // With 0 and 1, logit conversion clips to 0.001 and 0.999
      const brier = calculateBrierScore(predictions, actuals);
      expect(brier).toBeGreaterThan(0.99);
      expect(brier).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateBrierScoreWithTemperature', () => {
    it('reduces Brier Score for overconfident predictions', () => {
      // Simulate overconfident predictions
      const predictions = [0.95, 0.95, 0.05, 0.05]; // Very confident
      const actuals = [1, 0.8, 0.2, 0]; // Reality is less certain

      const rawBrier = calculateBrierScore(predictions, actuals);
      const calibratedBrier = calculateBrierScoreWithTemperature(
        predictions, actuals, 1.3
      );

      // Calibrated should be lower or equal
      expect(calibratedBrier).toBeLessThanOrEqual(rawBrier);
    });

    it('temperature = 1.0 gives same result as raw', () => {
      const predictions = [0.7, 0.3, 0.8, 0.2];
      const actuals = [1, 0, 1, 0];

      const rawBrier = calculateBrierScore(predictions, actuals);
      const tempBrier = calculateBrierScoreWithTemperature(
        predictions, actuals, 1.0
      );

      expect(tempBrier).toBeCloseTo(rawBrier, 5);
    });
  });

  describe('findOptimalTemperature', () => {
    it('finds temperature that minimizes Brier Score', () => {
      // Create realistic scenario: slightly overconfident predictions
      const predictions = [
        0.85, 0.82, 0.78, 0.75, 0.72,  // High predictions
        0.28, 0.25, 0.22, 0.18, 0.15  // Low predictions
      ];
      const actuals = [
        0.8, 0.75, 0.7, 0.7, 0.65,  // Reality slightly less extreme
        0.3, 0.28, 0.25, 0.22, 0.2
      ];

      const optimalTemp = findOptimalTemperature(predictions, actuals);

      // Optimal temperature should be > 1 for overconfident predictions
      expect(optimalTemp).toBeGreaterThan(1.0);
      expect(optimalTemp).toBeLessThanOrEqual(2.0);

      // Brier score with optimal temp should be better than temp = 1
      const rawBrier = calculateBrierScore(predictions, actuals);
      const optimalBrier = calculateBrierScoreWithTemperature(
        predictions, actuals, optimalTemp
      );

      expect(optimalBrier).toBeLessThan(rawBrier);
    });

    it('handles perfectly calibrated predictions', () => {
      const predictions = [0.8, 0.6, 0.4, 0.2];
      const actuals = [0.8, 0.6, 0.4, 0.2];

      const optimalTemp = findOptimalTemperature(predictions, actuals);
      const optimalBrier = calculateBrierScoreWithTemperature(
        predictions, actuals, optimalTemp
      );

      // Already well-calibrated, Brier should still be low
      expect(optimalBrier).toBeLessThan(0.1);
    });
  });

  describe('calculateCalibrationError', () => {
    it('returns 0 for perfectly calibrated predictions', () => {
      // Perfect calibration: prediction == actual
      const predictions = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
      const actuals = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];

      const ece = calculateCalibrationError(predictions, actuals);
      expect(ece).toBeCloseTo(0, 3);
    });

    it('returns higher error for miscalibrated predictions', () => {
      // Overconfident: always predicting near 0 or 1
      const predictions = [0.95, 0.92, 0.88, 0.12, 0.08, 0.05];
      const actuals = [0.7, 0.6, 0.5, 0.4, 0.3, 0.2]; // Reality is more moderate

      const ece = calculateCalibrationError(predictions, actuals);
      expect(ece).toBeGreaterThan(0.1); // Should have significant calibration error
    });

    it('handles empty arrays', () => {
      expect(() => calculateCalibrationError([], [])).not.toThrow();
    });
  });

  describe('Brier Score Target', () => {
    it('demonstrates calibration improves overconfident predictions', () => {
      // Create overconfident predictions (too far from 0.5)
      const predictions = [
        0.95, 0.92, 0.90, 0.88, 0.85,  // Very high
        0.15, 0.12, 0.10, 0.08, 0.05   // Very low
      ];
      const actuals = [
        0.75, 0.72, 0.70, 0.68, 0.65,  // Reality is less extreme
        0.35, 0.32, 0.30, 0.28, 0.25
      ];

      // Without calibration
      const rawBrier = calculateBrierScore(predictions, actuals);

      // Find optimal temperature
      const optimalTemp = findOptimalTemperature(predictions, actuals);
      const calibratedBrier = calculateBrierScoreWithTemperature(
        predictions, actuals, optimalTemp
      );

      // Calibration should improve (lower) Brier Score
      expect(calibratedBrier).toBeLessThan(rawBrier);

      // With proper calibration, should be able to get below 0.2
      // This validates the calibration mechanism achieves the target
      expect(calibratedBrier).toBeLessThan(0.2);
    });
  });
});
