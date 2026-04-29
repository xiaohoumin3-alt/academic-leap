// lib/rl/monitor/ability-drift.test.ts

import {
  calculateStats,
  ksTest,
  detectAbilityDrift
} from './ability-drift';
import type { AbilityDrift } from './ability-drift';

describe('ability-drift', () => {
  describe('calculateStats', () => {
    it('should calculate mean and std for stable distribution', () => {
      const values = [0, 0, 0, 0, 0];
      const stats = calculateStats(values);

      expect(stats.mean).toBeCloseTo(0, 5);
      expect(stats.std).toBeCloseTo(0, 5);
    });

    it('should calculate mean and std for normal distribution', () => {
      const values = [-1, 0, 0, 0, 1];
      const stats = calculateStats(values);

      expect(stats.mean).toBeCloseTo(0, 5);
      expect(stats.std).toBeCloseTo(0.632, 2);
    });

    it('should calculate mean and std for shifted distribution', () => {
      const values = [0.9, 1, 1, 1, 1.1];
      const stats = calculateStats(values);

      expect(stats.mean).toBeCloseTo(1, 5);
      expect(stats.std).toBeCloseTo(0.063, 2);
    });

    it('should handle empty array', () => {
      const stats = calculateStats([]);

      expect(stats.mean).toBe(0);
      expect(stats.std).toBe(0);
    });

    it('should handle single value', () => {
      const stats = calculateStats([5]);

      expect(stats.mean).toBe(5);
      expect(stats.std).toBe(0);
    });
  });

  describe('ksTest', () => {
    it('should return high p-value for identical distributions', () => {
      const sample1 = [0, 0, 0, 0, 0];
      const sample2 = [0, 0, 0, 0, 0];

      const pValue = ksTest(sample1, sample2);

      // Identical distributions should have p-value close to 1
      expect(pValue).toBeGreaterThan(0.9);
    });

    it('should return low p-value for different distributions', () => {
      const sample1 = [0, 0, 0, 0, 0];
      const sample2 = [1, 1, 1, 1, 1];

      const pValue = ksTest(sample1, sample2);

      // Completely different distributions should have p-value < 0.05
      expect(pValue).toBeLessThan(0.05);
    });

    it('should return high p-value for similar distributions', () => {
      const sample1 = [0, 0.1, -0.1, 0, 0];
      const sample2 = [0.1, 0, 0, -0.1, 0];

      const pValue = ksTest(sample1, sample2);

      // Similar distributions should have p-value > 0.05
      expect(pValue).toBeGreaterThan(0.05);
    });

    it('should handle different sized samples', () => {
      const sample1 = [0, 0, 0];
      const sample2 = [0, 0, 0, 0, 0];

      const pValue = ksTest(sample1, sample2);

      expect(pValue).toBeGreaterThan(0.5);
    });

    it('should handle empty samples', () => {
      const pValue = ksTest([], []);

      // Empty samples should return p-value of 1 (no difference)
      expect(pValue).toBe(1);
    });
  });

  describe('detectAbilityDrift', () => {
    it('should return null when no significant drift', () => {
      const thetaHistory = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      expect(drift).toBeNull();
    });

    it('should detect drift when mean shifts from 0 to 1', () => {
      const thetaHistory = [
        // Old half: mean = 0
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        // New half: mean = 1
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0, 1);
      expect(drift!.newMean).toBeCloseTo(1, 1);
      expect(drift!.ksTestPValue).toBeLessThan(0.05);
    });

    it('should detect drift when mean shifts from 0 to -1', () => {
      const thetaHistory = [
        // Old half: mean = 0
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        // New half: mean = -1
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0, 1);
      expect(drift!.newMean).toBeCloseTo(-1, 1);
      expect(drift!.ksTestPValue).toBeLessThan(0.05);
    });

    it('should use default window size of 20', () => {
      const thetaHistory = [
        // Old data (should be excluded)
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        // Within window: shift from 0 to 1
        0, 0, 0, 0, 0, 1, 1, 1, 1, 1,
      ];

      const drift = detectAbilityDrift(thetaHistory, 10);

      expect(drift).not.toBeNull();
    });

    it('should handle insufficient data for comparison', () => {
      const thetaHistory = [0];

      const drift = detectAbilityDrift(thetaHistory);

      // Not enough data to split into halves
      expect(drift).toBeNull();
    });

    it('should calculate correct statistics for detected drift', () => {
      const thetaHistory = [
        // Old half: mean = 0, std = 0
        0, 0, 0, 0, 0,
        // New half: mean = 1, std > 0
        0.9, 1, 1, 1, 1.1,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0, 1);
      expect(drift!.newMean).toBeCloseTo(1, 1);
      expect(drift!.oldStd).toBeCloseTo(0, 1);
      expect(drift!.newStd).toBeGreaterThan(0);
      expect(drift!.timestamp).toBeInstanceOf(Date);
    });

    it('should return null for p-value >= 0.05', () => {
      const thetaHistory = [
        // Both halves have similar distributions
        0, 0.1, -0.1, 0, 0.1,
        0, -0.1, 0.1, 0, 0,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      // Similar distributions should not trigger drift detection
      expect(drift).toBeNull();
    });

    it('should handle custom window size', () => {
      const thetaHistory = [
        // Old data
        0, 0, 0, 0, 0,
        // Within window of 8: shift from 0 to 1
        0, 0, 1, 1, 1, 1,
      ];

      const drift = detectAbilityDrift(thetaHistory, 8);

      expect(drift).not.toBeNull();
    });

    it('should detect drift with gradual change', () => {
      const thetaHistory = [
        // Old half: values around 0
        0, 0.1, -0.1, 0, 0.1, -0.1, 0, 0, 0.1, -0.1,
        // New half: values around 0.5
        0.4, 0.5, 0.6, 0.5, 0.4, 0.6, 0.5, 0.5, 0.4, 0.6,
      ];

      const drift = detectAbilityDrift(thetaHistory);

      // Should detect the shift
      expect(drift).not.toBeNull();
      expect(drift!.newMean).toBeGreaterThan(drift!.oldMean);
    });
  });
});
