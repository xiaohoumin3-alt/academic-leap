/**
 * Phase 2 Feature Flags Configuration Tests
 * TDD: Tests written before implementation
 */

import {
  PHASE_2_FEATURES,
  getFeatureConfig,
  isFeatureEnabled,
} from './phase2-features';

describe('Phase 2 Feature Flags', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.RL_CWTS_ENABLED = 'true';
    process.env.RL_TDCA_ENABLED = 'true';
    process.env.RL_DISTMON_ENABLED = 'true';

    // Reset CWTS config
    process.env.RL_CWTS_CONFIDENCE_SCALE = '100';
    process.env.RL_CWTS_MIN_CONFIDENCE = '0.3';
    process.env.RL_CWTS_ENABLE_CUTOFF = 'false';
    process.env.RL_CWTS_CUTOFF_THRESHOLD = '0.1';

    // Reset TDCA config
    process.env.RL_TDCA_DECAY_HALFLIFE = '1800000';
    process.env.RL_TDCA_MAX_DELAY = '7200000';
    process.env.RL_TDCA_MIN_WEIGHT = '0.1';

    // Reset DistMon config
    process.env.RL_DISTMON_CHECK_INTERVAL = '100';
    process.env.RL_DISTMON_ALERT_THRESHOLD = '0.2';
    process.env.RL_DISTMON_DIFFICULTY_WINDOW = '100';
    process.env.RL_DISTMON_ABILITY_WINDOW = '200';
    process.env.RL_DISTMON_REWARD_WINDOW = '50';

    // Clear require cache to reload module
    jest.resetModules();
  });

  describe('PHASE_2_FEATURES structure', () => {
    it('should have cwts feature config', () => {
      const { cwts } = PHASE_2_FEATURES;
      expect(cwts).toBeDefined();
      expect(cwts.enabled).toBe(true);
      expect(cwts.config).toBeDefined();
      expect(cwts.config.confidenceScale).toBe(100);
      expect(cwts.config.minConfidence).toBe(0.3);
      expect(cwts.config.enableCutoff).toBe(false);
      expect(cwts.config.cutoffThreshold).toBe(0.1);
    });

    it('should have tdca feature config', () => {
      const { tdca } = PHASE_2_FEATURES;
      expect(tdca).toBeDefined();
      expect(tdca.enabled).toBe(true);
      expect(tdca.config).toBeDefined();
      expect(tdca.config.decayHalfLife).toBe(1800000);
      expect(tdca.config.maxDelay).toBe(7200000);
      expect(tdca.config.minWeight).toBe(0.1);
    });

    it('should have distmon feature config', () => {
      const { distmon } = PHASE_2_FEATURES;
      expect(distmon).toBeDefined();
      expect(distmon.enabled).toBe(true);
      expect(distmon.config).toBeDefined();
      expect(distmon.config.checkInterval).toBe(100);
      expect(distmon.config.alertThreshold).toBe(0.2);
      expect(distmon.config.difficultyWindowSize).toBe(100);
      expect(distmon.config.abilityWindowSize).toBe(200);
      expect(distmon.config.rewardWindowSize).toBe(50);
    });
  });

  describe('getFeatureConfig', () => {
    it('should return cwts config', () => {
      const cwtsConfig = getFeatureConfig<CWTSConfig>('cwts');
      expect(cwtsConfig).toBeDefined();
      expect(cwtsConfig.confidenceScale).toBe(100);
      expect(cwtsConfig.minConfidence).toBe(0.3);
      expect(cwtsConfig.enableCutoff).toBe(false);
      expect(cwtsConfig.cutoffThreshold).toBe(0.1);
    });

    it('should return tdca config', () => {
      const tdcaConfig = getFeatureConfig<TDCAConfig>('tdca');
      expect(tdcaConfig).toBeDefined();
      expect(tdcaConfig.decayHalfLife).toBe(1800000);
      expect(tdcaConfig.maxDelay).toBe(7200000);
      expect(tdcaConfig.minWeight).toBe(0.1);
    });

    it('should return distmon config', () => {
      const distmonConfig = getFeatureConfig<DistMonConfig>('distmon');
      expect(distmonConfig).toBeDefined();
      expect(distmonConfig.checkInterval).toBe(100);
      expect(distmonConfig.alertThreshold).toBe(0.2);
      expect(distmonConfig.difficultyWindowSize).toBe(100);
      expect(distmonConfig.abilityWindowSize).toBe(200);
      expect(distmonConfig.rewardWindowSize).toBe(50);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled cwts feature', () => {
      expect(isFeatureEnabled('cwts')).toBe(true);
    });

    it('should return true for enabled tdca feature', () => {
      expect(isFeatureEnabled('tdca')).toBe(true);
    });

    it('should return true for enabled distmon feature', () => {
      expect(isFeatureEnabled('distmon')).toBe(true);
    });

    it('should return false for disabled feature', () => {
      process.env.RL_CWTS_ENABLED = 'false';
      jest.resetModules();
      const { isFeatureEnabled: isEnabled } = require('./phase2-features');
      expect(isEnabled('cwts')).toBe(false);
    });

    it('should return false for unknown feature', () => {
      expect(isFeatureEnabled('unknown' as any)).toBe(false);
    });
  });
});

// Type exports for testing
export interface CWTSConfig {
  confidenceScale: number;
  minConfidence: number;
  enableCutoff: boolean;
  cutoffThreshold: number;
}

export interface TDCAConfig {
  decayHalfLife: number;
  maxDelay: number;
  minWeight: number;
}

export interface DistMonConfig {
  checkInterval: number;
  alertThreshold: number;
  difficultyWindowSize: number;
  abilityWindowSize: number;
  rewardWindowSize: number;
}

export interface FeatureConfig<T> {
  enabled: boolean;
  config: T;
}
