/**
 * Phase 3 Feature Flags Configuration Tests
 * TDD: Tests written before implementation
 */

import {
  PHASE_3_FEATURES,
  getFeatureConfig,
  isFeatureEnabled,
} from './phase3-features';

// Type exports for testing
export interface LQMConfig {
  noiseThreshold: number;
  minAttempts: number;
  decayRate: number;
}

export interface NormalizerConfig {
  windowSize: number;
}

export interface AdaptationConfig {
  baseExplorationRate: number;
  minExplorationRate: number;
  adaptationSpeed: number;
  confidenceThreshold: number;
}

describe('Phase 3 Feature Flags', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.RL_LQM_ENABLED = 'true';
    process.env.RL_NORMALIZER_ENABLED = 'true';
    process.env.RL_ADAPTATION_ENABLED = 'true';

    // Reset LQM config
    process.env.RL_LQM_NOISE_THRESHOLD = '0.7';
    process.env.RL_LQM_MIN_ATTEMPTS = '20';
    process.env.RL_LQM_DECAY_RATE = '0.95';

    // Reset Normalizer config
    process.env.RL_NORMALIZER_WINDOW = '1000';

    // Reset Adaptation config
    process.env.RL_ADAPTATION_BASE_RATE = '0.1';
    process.env.RL_ADAPTATION_MIN_RATE = '0.01';
    process.env.RL_ADAPTATION_SPEED = '0.1';
    process.env.RL_ADAPTATION_CONFIDENCE_THRESHOLD = '0.8';

    // Clear require cache to reload module
    jest.resetModules();
  });

  describe('PHASE_3_FEATURES structure', () => {
    it('should have lqm feature config', () => {
      const { lqm } = PHASE_3_FEATURES;
      expect(lqm).toBeDefined();
      expect(lqm.enabled).toBe(true);
      expect(lqm.config).toBeDefined();
      expect(lqm.config.noiseThreshold).toBe(0.7);
      expect(lqm.config.minAttempts).toBe(20);
      expect(lqm.config.decayRate).toBe(0.95);
    });

    it('should have normalizer feature config', () => {
      const { normalizer } = PHASE_3_FEATURES;
      expect(normalizer).toBeDefined();
      expect(normalizer.enabled).toBe(true);
      expect(normalizer.config).toBeDefined();
      expect(normalizer.config.windowSize).toBe(1000);
    });

    it('should have adaptation feature config', () => {
      const { adaptation } = PHASE_3_FEATURES;
      expect(adaptation).toBeDefined();
      expect(adaptation.enabled).toBe(true);
      expect(adaptation.config).toBeDefined();
      expect(adaptation.config.baseExplorationRate).toBe(0.1);
      expect(adaptation.config.minExplorationRate).toBe(0.01);
      expect(adaptation.config.adaptationSpeed).toBe(0.1);
      expect(adaptation.config.confidenceThreshold).toBe(0.8);
    });
  });

  describe('getFeatureConfig', () => {
    it('should return lqm config', () => {
      const lqmConfig = getFeatureConfig<LQMConfig>('lqm');
      expect(lqmConfig).toBeDefined();
      expect(lqmConfig.noiseThreshold).toBe(0.7);
      expect(lqmConfig.minAttempts).toBe(20);
      expect(lqmConfig.decayRate).toBe(0.95);
    });

    it('should return normalizer config', () => {
      const normalizerConfig = getFeatureConfig<NormalizerConfig>('normalizer');
      expect(normalizerConfig).toBeDefined();
      expect(normalizerConfig.windowSize).toBe(1000);
    });

    it('should return adaptation config', () => {
      const adaptationConfig = getFeatureConfig<AdaptationConfig>('adaptation');
      expect(adaptationConfig).toBeDefined();
      expect(adaptationConfig.baseExplorationRate).toBe(0.1);
      expect(adaptationConfig.minExplorationRate).toBe(0.01);
      expect(adaptationConfig.adaptationSpeed).toBe(0.1);
      expect(adaptationConfig.confidenceThreshold).toBe(0.8);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled lqm feature', () => {
      expect(isFeatureEnabled('lqm')).toBe(true);
    });

    it('should return true for enabled normalizer feature', () => {
      expect(isFeatureEnabled('normalizer')).toBe(true);
    });

    it('should return true for enabled adaptation feature', () => {
      expect(isFeatureEnabled('adaptation')).toBe(true);
    });

    it('should return false for disabled feature', () => {
      process.env.RL_LQM_ENABLED = 'false';
      jest.resetModules();
      const { isFeatureEnabled: isEnabled } = require('./phase3-features');
      expect(isEnabled('lqm')).toBe(false);
    });

    it('should return false for unknown feature', () => {
      expect(isFeatureEnabled('unknown' as any)).toBe(false);
    });
  });

  describe('default values', () => {
    it('should use default values when env vars not set', () => {
      // Clear relevant env vars
      delete process.env.RL_LQM_NOISE_THRESHOLD;
      delete process.env.RL_LQM_MIN_ATTEMPTS;
      delete process.env.RL_LQM_DECAY_RATE;
      delete process.env.RL_NORMALIZER_WINDOW;
      delete process.env.RL_ADAPTATION_BASE_RATE;
      delete process.env.RL_ADAPTATION_MIN_RATE;
      delete process.env.RL_ADAPTATION_SPEED;
      delete process.env.RL_ADAPTATION_CONFIDENCE_THRESHOLD;

      jest.resetModules();
      const { PHASE_3_FEATURES: features } = require('./phase3-features');

      // LQM defaults
      expect(features.lqm.config.noiseThreshold).toBe(0.7);
      expect(features.lqm.config.minAttempts).toBe(20);
      expect(features.lqm.config.decayRate).toBe(0.95);

      // Normalizer defaults
      expect(features.normalizer.config.windowSize).toBe(1000);

      // Adaptation defaults
      expect(features.adaptation.config.baseExplorationRate).toBe(0.1);
      expect(features.adaptation.config.minExplorationRate).toBe(0.01);
      expect(features.adaptation.config.adaptationSpeed).toBe(0.1);
      expect(features.adaptation.config.confidenceThreshold).toBe(0.8);
    });

    it('should default enabled to true when not set', () => {
      delete process.env.RL_LQM_ENABLED;
      delete process.env.RL_NORMALIZER_ENABLED;
      delete process.env.RL_ADAPTATION_ENABLED;

      jest.resetModules();
      const { PHASE_3_FEATURES: features } = require('./phase3-features');

      expect(features.lqm.enabled).toBe(true);
      expect(features.normalizer.enabled).toBe(true);
      expect(features.adaptation.enabled).toBe(true);
    });
  });
});
