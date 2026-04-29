// lib/rl/monitor/reward-drift.test.ts

import {
  detectRewardDrift,
  calculateMean
} from './reward-drift';
import type { RewardDrift } from './reward-drift';

describe('reward-drift', () => {
  describe('calculateMean', () => {
    it('should calculate mean of stable rewards', () => {
      const rewards = [0.5, 0.5, 0.5, 0.5, 0.5];
      const mean = calculateMean(rewards);

      expect(mean).toBeCloseTo(0.5, 5);
    });

    it('should calculate mean of varying rewards', () => {
      const rewards = [0.1, 0.5, 0.9];
      const mean = calculateMean(rewards);

      expect(mean).toBeCloseTo(0.5, 5);
    });

    it('should handle empty array', () => {
      const mean = calculateMean([]);

      expect(mean).toBe(0);
    });

    it('should handle single value', () => {
      const mean = calculateMean([0.7]);

      expect(mean).toBe(0.7);
    });
  });

  describe('detectRewardDrift', () => {
    it('should return null when no drift with stable rewards', () => {
      const rewardHistory = [
        // Old half: mean ~0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
        // Recent half: mean ~0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
      ];

      const drift = detectRewardDrift(rewardHistory);

      // Less than 20% change should return null
      expect(drift).toBeNull();
    });

    it('should detect significant drop (0.7 -> 0.4)', () => {
      const rewardHistory = [
        // Old half: mean = 0.7
        0.7, 0.7, 0.7, 0.7, 0.7,
        // Recent half: mean = 0.4
        0.4, 0.4, 0.4, 0.4, 0.4,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0.7, 1);
      expect(drift!.newMean).toBeCloseTo(0.4, 1);
      // changePercent = (0.4 - 0.7) / 0.7 = -0.428... (~-43%)
      expect(drift!.changePercent).toBeCloseTo(-0.428, 2);
      expect(drift!.isSignificant).toBe(true);
    });

    it('should detect significant increase (0.4 -> 0.7)', () => {
      const rewardHistory = [
        // Old half: mean = 0.4
        0.4, 0.4, 0.4, 0.4, 0.4,
        // Recent half: mean = 0.7
        0.7, 0.7, 0.7, 0.7, 0.7,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0.4, 1);
      expect(drift!.newMean).toBeCloseTo(0.7, 1);
      // changePercent = (0.7 - 0.4) / 0.4 = 0.75 (75%)
      expect(drift!.changePercent).toBeCloseTo(0.75, 2);
      expect(drift!.isSignificant).toBe(true);
    });

    it('should calculate correct statistics', () => {
      const rewardHistory = [
        // Old half: mean = 0.5
        0.4, 0.5, 0.5, 0.5, 0.6,
        // Recent half: mean = 0.25 (significant drop)
        0.2, 0.25, 0.25, 0.25, 0.3,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0.5, 1);
      expect(drift!.newMean).toBeCloseTo(0.25, 1);
      // changePercent = (0.25 - 0.5) / 0.5 = -0.5 (-50%)
      expect(drift!.changePercent).toBeCloseTo(-0.5, 1);
      expect(drift!.isSignificant).toBe(true);
      expect(drift!.timestamp).toBeInstanceOf(Date);
    });

    it('should return null for insignificant change (10% increase)', () => {
      const rewardHistory = [
        // Old half: mean = 0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
        // Recent half: mean = 0.55 (10% increase, < 20% threshold)
        0.55, 0.55, 0.55, 0.55, 0.55,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).toBeNull();
    });

    it('should return null for insignificant change (15% decrease)', () => {
      const rewardHistory = [
        // Old half: mean = 0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
        // Recent half: mean = 0.425 (15% decrease, < 20% threshold)
        0.425, 0.425, 0.425, 0.425, 0.425,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).toBeNull();
    });

    it('should detect just above 20% change as significant', () => {
      const rewardHistory = [
        // Old half: mean = 0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
        // Recent half: mean = 0.61 (just above 20% increase)
        0.61, 0.61, 0.61, 0.61, 0.61,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.changePercent).toBeCloseTo(0.22, 1);
      expect(drift!.isSignificant).toBe(true);
    });

    it('should return null for exactly 20% change (boundary condition)', () => {
      const rewardHistory = [
        // Old half: mean = 0.5
        0.5, 0.5, 0.5, 0.5, 0.5,
        // Recent half: mean = 0.6 (exactly 20% increase, not > 20%)
        0.6, 0.6, 0.6, 0.6, 0.6,
      ];

      const drift = detectRewardDrift(rewardHistory);

      // Exactly 20% is not > 20%, so should return null
      expect(drift).toBeNull();
    });

    it('should return null for insufficient data (< 2 values)', () => {
      const drift1 = detectRewardDrift([]);
      const drift2 = detectRewardDrift([0.5]);

      expect(drift1).toBeNull();
      expect(drift2).toBeNull();
    });

    it('should use default window size when not specified', () => {
      const rewardHistory = [
        // Old data (should be included without window)
        0.7, 0.7, 0.7, 0.7, 0.7,
        0.7, 0.7, 0.7, 0.7, 0.7,
        // Recent data
        0.4, 0.4, 0.4, 0.4, 0.4,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeGreaterThan(0.5);
      // With split at 7: old half has 7 values of 0.7, new half has 8 (3 of 0.7, 5 of 0.4)
      // new mean = (3*0.7 + 5*0.4) / 8 = 4.1/8 = 0.5125
      expect(drift!.newMean).toBeCloseTo(0.51, 1);
    });

    it('should use custom window size when specified', () => {
      const rewardHistory = [
        // Old data (should be excluded by window)
        0.1, 0.1, 0.1, 0.1, 0.1,
        // Within window of 10: shift from 0.7 to 0.4
        0.7, 0.7, 0.7, 0.7, 0.7,
        0.4, 0.4, 0.4, 0.4, 0.4,
      ];

      const drift = detectRewardDrift(rewardHistory, 10);

      expect(drift).not.toBeNull();
      // With window=10, old mean should be ~0.7
      expect(drift!.oldMean).toBeCloseTo(0.7, 1);
      expect(drift!.newMean).toBeCloseTo(0.4, 1);
    });

    it('should handle odd-length arrays correctly', () => {
      const rewardHistory = [
        // Old half: 4 values, mean = 0.7
        0.7, 0.7, 0.7, 0.7,
        // Recent half: 5 values, mean = 0.4
        0.4, 0.4, 0.4, 0.4, 0.4,
      ];

      const drift = detectRewardDrift(rewardHistory);

      expect(drift).not.toBeNull();
      expect(drift!.oldMean).toBeCloseTo(0.7, 1);
      expect(drift!.newMean).toBeCloseTo(0.4, 1);
    });

    it('should handle zero old mean gracefully', () => {
      const rewardHistory = [
        // Old half: mean = 0
        0, 0, 0, 0,
        // Recent half: mean = 0.1
        0.1, 0.1, 0.1, 0.1,
      ];

      const drift = detectRewardDrift(rewardHistory);

      // When oldMean is 0, avoid division by zero
      // Should treat as not significant since we can't calculate percentage
      expect(drift).toBeNull();
    });
  });
});
