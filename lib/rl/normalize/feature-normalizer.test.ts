/**
 * Feature Normalizer Tests
 * TDD: Tests written before implementation
 */

import { FeatureNormalizer } from './feature-normalizer';
import type { NormalizerConfig } from '../config/phase3-features';

describe('FeatureNormalizer', () => {
  let normalizer: FeatureNormalizer;

  describe('initialization', () => {
    it('should initialize with default config', () => {
      normalizer = new FeatureNormalizer();
      expect(normalizer).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const config: NormalizerConfig = { windowSize: 100 };
      normalizer = new FeatureNormalizer(config);
      expect(normalizer).toBeDefined();
    });
  });

  describe('normalize', () => {
    beforeEach(() => {
      normalizer = new FeatureNormalizer();
    });

    it('should return 0 for first value (insufficient data)', () => {
      const result = normalizer.normalize(5.0, 'reward');
      expect(result).toBe(0);
    });

    it('should return 0 when only one sample exists', () => {
      normalizer.update(10.0, 'reward');
      const result = normalizer.normalize(10.0, 'reward');
      expect(result).toBe(0);
    });

    it('should return 0 when std is 0', () => {
      // All same values -> std = 0
      normalizer.update(5.0, 'reward');
      normalizer.update(5.0, 'reward');
      normalizer.update(5.0, 'reward');

      const result = normalizer.normalize(5.0, 'reward');
      expect(result).toBe(0);
    });

    it('should compute correct z-score for known distribution', () => {
      // Values: 2, 4, 4, 4, 5, 5, 7, 9
      // mean = 40/8 = 5
      // sample std = sqrt(sum((x-mean)^2)/(n-1)) = sqrt(32/7) ≈ 2.138
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      values.forEach(v => normalizer.update(v, 'reward'));

      // z-score of 9: (9 - 5) / 2.138 ≈ 1.87
      const result = normalizer.normalize(9, 'reward');
      expect(result).toBeCloseTo(1.87, 1);
    });

    it('should handle negative z-scores', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      values.forEach(v => normalizer.update(v, 'reward'));

      // z-score of 2: (2 - 5) / 2.138 ≈ -1.40
      const result = normalizer.normalize(2, 'reward');
      expect(result).toBeCloseTo(-1.40, 1);
    });

    it('should normalize different features independently', () => {
      // Add values to 'reward' feature
      normalizer.update(1.0, 'reward');
      normalizer.update(2.0, 'reward');
      normalizer.update(3.0, 'reward');

      // Add different values to 'theta' feature
      normalizer.update(100.0, 'theta');
      normalizer.update(200.0, 'theta');
      normalizer.update(300.0, 'theta');

      // Get stats for each
      const rewardStats = normalizer.getStats('reward');
      const thetaStats = normalizer.getStats('theta');

      expect(rewardStats.mean).toBeCloseTo(2.0, 5);
      expect(thetaStats.mean).toBeCloseTo(200.0, 5);
    });
  });

  describe('denormalize', () => {
    beforeEach(() => {
      normalizer = new FeatureNormalizer();
    });

    it('should return 0 for first value', () => {
      const result = normalizer.denormalize(1.0, 'reward');
      expect(result).toBe(0);
    });

    it('should return original value after single sample', () => {
      normalizer.update(10.0, 'reward');
      const result = normalizer.denormalize(1.0, 'reward');
      expect(result).toBe(0); // Returns 0 when count < 2
    });

    it('should correctly denormalize z-scores', () => {
      // Add values: mean = 4, std = 2
      normalizer.update(2.0, 'reward');
      normalizer.update(4.0, 'reward');
      normalizer.update(6.0, 'reward');

      // z-score of 1 means: x = mean + z * std = 4 + 1 * 2 = 6
      const result = normalizer.denormalize(1.0, 'reward');
      expect(result).toBeCloseTo(6.0, 5);
    });

    it('should handle negative z-scores', () => {
      normalizer.update(2.0, 'reward');
      normalizer.update(4.0, 'reward');
      normalizer.update(6.0, 'reward');

      // z-score of -1 means: x = mean + z * std = 4 + (-1) * 2 = 2
      const result = normalizer.denormalize(-1.0, 'reward');
      expect(result).toBeCloseTo(2.0, 5);
    });

    it('should be inverse of normalize', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      values.forEach(v => normalizer.update(v, 'reward'));

      const original = 7;
      const normalized = normalizer.normalize(original, 'reward');
      const denormalized = normalizer.denormalize(normalized, 'reward');

      expect(denormalized).toBeCloseTo(original, 5);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      normalizer = new FeatureNormalizer();
    });

    it('should add value to window', () => {
      normalizer.update(5.0, 'reward');
      const stats = normalizer.getStats('reward');
      expect(stats.count).toBe(1);
    });

    it('should maintain rolling window size', () => {
      const smallWindowNormalizer = new FeatureNormalizer({ windowSize: 3 });

      smallWindowNormalizer.update(1.0, 'reward');
      smallWindowNormalizer.update(2.0, 'reward');
      smallWindowNormalizer.update(3.0, 'reward');
      smallWindowNormalizer.update(4.0, 'reward'); // Should evict 1.0

      const stats = smallWindowNormalizer.getStats('reward');
      // Window should contain 2.0, 3.0, 4.0
      expect(stats.count).toBe(3);
      expect(stats.mean).toBeCloseTo(3.0, 5);
    });

    it('should track multiple features independently', () => {
      normalizer.update(1.0, 'featureA');
      normalizer.update(2.0, 'featureB');
      normalizer.update(3.0, 'featureA');

      const statsA = normalizer.getStats('featureA');
      const statsB = normalizer.getStats('featureB');

      expect(statsA.count).toBe(2);
      expect(statsB.count).toBe(1);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      normalizer = new FeatureNormalizer();
    });

    it('should return empty stats for unknown feature', () => {
      const stats = normalizer.getStats('unknown');
      expect(stats.mean).toBe(0);
      expect(stats.std).toBe(0);
      expect(stats.count).toBe(0);
    });

    it('should compute correct mean', () => {
      normalizer.update(2.0, 'reward');
      normalizer.update(4.0, 'reward');
      normalizer.update(6.0, 'reward');

      const stats = normalizer.getStats('reward');
      expect(stats.mean).toBeCloseTo(4.0, 5);
    });

    it('should compute correct std', () => {
      // Values with known std (sample std)
      normalizer.update(2.0, 'reward');
      normalizer.update(4.0, 'reward');
      normalizer.update(6.0, 'reward');

      const stats = normalizer.getStats('reward');
      // sample std = sqrt(((2-4)^2 + (4-4)^2 + (6-4)^2) / (n-1)) = sqrt(8/2) = 2
      expect(stats.std).toBeCloseTo(2.0, 2);
    });

    it('should return std of 0 for single value', () => {
      normalizer.update(5.0, 'reward');
      const stats = normalizer.getStats('reward');
      expect(stats.std).toBe(0);
    });

    it('should return correct count', () => {
      normalizer.update(1.0, 'reward');
      normalizer.update(2.0, 'reward');
      normalizer.update(3.0, 'reward');

      const stats = normalizer.getStats('reward');
      expect(stats.count).toBe(3);
    });

    it('should reflect rolling window in stats', () => {
      const smallWindowNormalizer = new FeatureNormalizer({ windowSize: 2 });

      smallWindowNormalizer.update(1.0, 'reward');
      smallWindowNormalizer.update(2.0, 'reward');
      smallWindowNormalizer.update(3.0, 'reward'); // Evicts 1.0

      const stats = smallWindowNormalizer.getStats('reward');
      // Should only contain 2.0 and 3.0
      expect(stats.count).toBe(2);
      expect(stats.mean).toBeCloseTo(2.5, 5);
    });
  });

  describe('edge cases', () => {
    it('should handle very small std values', () => {
      normalizer = new FeatureNormalizer();

      // Values with very small variance
      normalizer.update(1.0, 'reward');
      normalizer.update(1.0000001, 'reward');
      normalizer.update(1.0000002, 'reward');

      const normalized = normalizer.normalize(1.00000015, 'reward');
      // Should be bounded despite small std
      expect(isFinite(normalized)).toBe(true);
    });

    it('should handle large values', () => {
      normalizer = new FeatureNormalizer();

      normalizer.update(1e10, 'reward');
      normalizer.update(1e10, 'reward');
      normalizer.update(1e10, 'reward');

      const normalized = normalizer.normalize(1e10, 'reward');
      expect(normalized).toBe(0); // All values same
    });

    it('should handle mixed positive and negative values', () => {
      normalizer = new FeatureNormalizer();

      normalizer.update(-5.0, 'reward');
      normalizer.update(0.0, 'reward');
      normalizer.update(5.0, 'reward');

      const stats = normalizer.getStats('reward');
      expect(stats.mean).toBeCloseTo(0.0, 5);
      // sample std = sqrt(50/2) = sqrt(25) = 5
      expect(stats.std).toBeCloseTo(5.0, 2);
    });
  });
});
