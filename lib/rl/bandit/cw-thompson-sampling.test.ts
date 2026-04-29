// lib/rl/bandit/cw-thompson-sampling.test.ts

import { CWThompsonSamplingBandit } from './cw-thompson-sampling';
import type { CWTSConfig } from '../config/phase2-features';

describe('CWThompsonSamplingBandit', () => {
  const defaultCWConfig: CWTSConfig = {
    confidenceScale: 100,
    minConfidence: 0.3,
    enableCutoff: false,
    cutoffThreshold: 0.1,
  };

  describe('calculateConfidenceWeight', () => {
    it('should return minConfidence when pullCount is 0', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      const weight = bandit.calculateConfidenceWeight(0);
      expect(weight).toBe(defaultCWConfig.minConfidence);
    });

    it('should increase confidence as pullCount increases', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      const weight1 = bandit.calculateConfidenceWeight(10);
      const weight2 = bandit.calculateConfidenceWeight(50);
      const weight3 = bandit.calculateConfidenceWeight(100);

      expect(weight2).toBeGreaterThan(weight1);
      expect(weight3).toBeGreaterThan(weight2);
    });

    it('should approach 1.0 as pullCount increases significantly', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      const weight = bandit.calculateConfidenceWeight(10000);
      expect(weight).toBeGreaterThan(0.95);
    });
  });

  describe('selectArm', () => {
    it('should respect ability neighborhood constraint [ability-1, ability+1]', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      bandit.setSeed(42);

      // Generate many selections and verify they're within bounds
      const ability = 5;
      const selections: string[] = [];

      for (let i = 0; i < 100; i++) {
        const arm = bandit.selectArm(ability);
        const deltaC = parseFloat(arm);
        selections.push(arm);

        // Should be within [ability-1, ability+1] = [4, 6]
        expect(deltaC).toBeGreaterThanOrEqual(ability - 1);
        expect(deltaC).toBeLessThanOrEqual(ability + 1);
      }

      // Should have variety, not always the same
      const uniqueSelections = new Set(selections);
      expect(uniqueSelections.size).toBeGreaterThan(1);
    });

    it('should prefer high confidence arms (80%+ selection rate)', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      bandit.setSeed(42);

      const ability = 5;
      const lowConfidenceArm = '4.0';
      const highConfidenceArm = '5.0';

      // Give high confidence arm many successful pulls
      for (let i = 0; i < 100; i++) {
        bandit.update(highConfidenceArm, true);
      }

      // Give low confidence arm few pulls with mixed results
      for (let i = 0; i < 5; i++) {
        bandit.update(lowConfidenceArm, i < 2);
      }

      // Count selections
      const selections: Record<string, number> = {};
      const trials = 100;

      for (let i = 0; i < trials; i++) {
        const arm = bandit.selectArm(ability);
        selections[arm] = (selections[arm] || 0) + 1;
      }

      const highConfidenceRate = (selections[highConfidenceArm] || 0) / trials;
      expect(highConfidenceRate).toBeGreaterThanOrEqual(0.8);
    });

    it('should skip low confidence arms when cutoff mode is enabled', () => {
      const cwConfig: CWTSConfig = {
        ...defaultCWConfig,
        enableCutoff: true,
        cutoffThreshold: 0.5,
      };

      const bandit = new CWThompsonSamplingBandit(cwConfig);
      bandit.setSeed(42);

      const ability = 5;

      // Initialize some arms with low pull counts (low confidence)
      bandit.update('4.0', false); // Low confidence
      bandit.update('6.0', false); // Low confidence

      // Give high confidence to middle arm
      for (let i = 0; i < 50; i++) {
        bandit.update('5.0', true);
      }

      // Should prefer the high confidence arm
      const selections: Record<string, number> = {};
      const trials = 50;

      for (let i = 0; i < trials; i++) {
        const arm = bandit.selectArm(ability);
        selections[arm] = (selections[arm] || 0) + 1;
      }

      // High confidence arm should dominate
      expect((selections['5.0'] || 0) / trials).toBeGreaterThan(0.7);
    });

    it('should fallback to normal selection if all arms are cut off', () => {
      const cwConfig: CWTSConfig = {
        ...defaultCWConfig,
        enableCutoff: true,
        cutoffThreshold: 0.99, // Very high threshold, all arms will be cut off
      };

      const bandit = new CWThompsonSamplingBandit(cwConfig);
      bandit.setSeed(42);

      const ability = 5;

      // All arms have low pull count, so all will be cut off
      // Should still return a valid arm within ability neighborhood
      const arm = bandit.selectArm(ability);
      const deltaC = parseFloat(arm);

      expect(deltaC).toBeGreaterThanOrEqual(ability - 1);
      expect(deltaC).toBeLessThanOrEqual(ability + 1);
    });
  });

  describe('update', () => {
    it('should increment alpha and successCount on success', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      const arm = '5.0';

      const stateBefore = bandit.getState();
      const bucketBefore = stateBefore.buckets.get(arm);

      const alphaBefore = bucketBefore?.alpha ?? 0;
      const successCountBefore = bucketBefore?.successCount ?? 0;
      const pullCountBefore = bucketBefore?.pullCount ?? 0;

      bandit.update(arm, true);

      const stateAfter = bandit.getState();
      const bucketAfter = stateAfter.buckets.get(arm);

      expect(bucketAfter?.alpha).toBe(alphaBefore + 1);
      expect(bucketAfter?.successCount).toBe(successCountBefore + 1);
      expect(bucketAfter?.pullCount).toBe(pullCountBefore + 1);
    });

    it('should increment beta on failure', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);
      const arm = '5.0';

      const stateBefore = bandit.getState();
      const bucketBefore = stateBefore.buckets.get(arm);

      const betaBefore = bucketBefore?.beta ?? 0;
      const pullCountBefore = bucketBefore?.pullCount ?? 0;

      bandit.update(arm, false);

      const stateAfter = bandit.getState();
      const bucketAfter = stateAfter.buckets.get(arm);

      expect(bucketAfter?.beta).toBe(betaBefore + 1);
      expect(bucketAfter?.pullCount).toBe(pullCountBefore + 1);
    });
  });

  describe('getState', () => {
    it('should include confidenceWeights in state', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);

      // Make some updates to build confidence
      bandit.update('5.0', true);
      bandit.update('5.0', true);
      bandit.update('4.0', true);

      const state = bandit.getState();

      expect(state.confidenceWeights).toBeInstanceOf(Map);
      expect(state.confidenceWeights.size).toBeGreaterThan(0);
    });

    it('should reflect current confidence weights based on pull counts', () => {
      const bandit = new CWThompsonSamplingBandit(defaultCWConfig);

      // Update different arms different amounts
      for (let i = 0; i < 100; i++) {
        bandit.update('5.0', true);
      }
      for (let i = 0; i < 10; i++) {
        bandit.update('4.0', true);
      }

      const state = bandit.getState();

      const weight5 = state.confidenceWeights.get('5.0');
      const weight4 = state.confidenceWeights.get('4.0');

      expect(weight5).toBeDefined();
      expect(weight4).toBeDefined();
      expect(weight5).toBeGreaterThan(weight4!);
    });
  });

  describe('setSeed', () => {
    it('should produce consistent selections with same seed', () => {
      const bandit1 = new CWThompsonSamplingBandit(defaultCWConfig);
      const bandit2 = new CWThompsonSamplingBandit(defaultCWConfig);

      bandit1.setSeed(12345);
      bandit2.setSeed(12345);

      const selections1: string[] = [];
      const selections2: string[] = [];

      for (let i = 0; i < 20; i++) {
        selections1.push(bandit1.selectArm(5));
        selections2.push(bandit2.selectArm(5));
      }

      expect(selections1).toEqual(selections2);
    });

    it('should produce different selections with different seeds', () => {
      const bandit1 = new CWThompsonSamplingBandit(defaultCWConfig);
      const bandit2 = new CWThompsonSamplingBandit(defaultCWConfig);

      bandit1.setSeed(11111);
      bandit2.setSeed(22222);

      const selections1: string[] = [];
      const selections2: string[] = [];

      for (let i = 0; i < 20; i++) {
        selections1.push(bandit1.selectArm(5));
        selections2.push(bandit2.selectArm(5));
      }

      // With different seeds, selections should differ
      expect(selections1).not.toEqual(selections2);
    });
  });
});
