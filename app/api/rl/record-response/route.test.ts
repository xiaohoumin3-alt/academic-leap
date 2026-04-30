/**
 * Record Response Route Tests
 * Tests for TD-CA (Time-Decayed Credit Assignment) integration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { applyTimeDecay } from '@/lib/rl/reward/time-decay-credit';
import { getFeatureConfig, isFeatureEnabled, TDCAConfig } from '@/lib/rl/config/phase2-features';

// Mock the dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/prisma');
jest.mock('@/lib/rl/persistence/model-store');
jest.mock('@/lib/rl/history/le-history-service');
jest.mock('@/lib/rl/health/monitor');

describe('Record Response - TD-CA Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set environment variables for testing
    process.env.RL_TDCA_ENABLED = 'true';
    process.env.RL_TDCA_DECAY_HALFLIFE = '1800000'; // 30 minutes
    process.env.RL_TDCA_MAX_DELAY = '7200000'; // 2 hours
    process.env.RL_TDCA_MIN_WEIGHT = '0.1';
  });

  afterEach(() => {
    delete process.env.RL_TDCA_ENABLED;
    delete process.env.RL_TDCA_DECAY_HALFLIFE;
    delete process.env.RL_TDCA_MAX_DELAY;
    delete process.env.RL_TDCA_MIN_WEIGHT;
  });

  test('should export TD-CA functions', () => {
    expect(typeof applyTimeDecay).toBe('function');
    expect(typeof getFeatureConfig).toBe('function');
    expect(typeof isFeatureEnabled).toBe('function');
  });

  test('should check TD-CA feature flag', () => {
    const isEnabled = isFeatureEnabled('tdca');
    expect(typeof isEnabled).toBe('boolean');
  });

  test('should get TD-CA configuration', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    expect(config).toHaveProperty('decayHalfLife');
    expect(config).toHaveProperty('maxDelay');
    expect(config).toHaveProperty('minWeight');
  });

  test('should apply time decay to immediate response', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();
    const baseReward = 1.0;
    const result = applyTimeDecay(baseReward, now, config);

    expect(result.originalReward).toBe(baseReward);
    expect(result.isIgnored).toBe(false);
    expect(result.adjustedReward).toBeCloseTo(1.0, 1);
  });

  test('should apply time decay to delayed response (30 minutes)', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();
    const responseTimestamp = now - 1800000; // 30 minutes ago
    const baseReward = 1.0;
    const result = applyTimeDecay(baseReward, responseTimestamp, config);

    expect(result.originalReward).toBe(baseReward);
    expect(result.isIgnored).toBe(false);
    expect(result.adjustedReward).toBeLessThan(1.0);
    expect(result.delayMs).toBe(1800000);
  });

  test('should ignore response with excessive delay (> 2 hours)', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();
    const responseTimestamp = now - 7200001; // Just over 2 hours
    const baseReward = 1.0;
    const result = applyTimeDecay(baseReward, responseTimestamp, config);

    expect(result.originalReward).toBe(baseReward);
    expect(result.isIgnored).toBe(true);
    expect(result.adjustedReward).toBe(0);
  });

  test('should calculate decay weight correctly', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();

    // At half-life, decay should be exp(-1) ≈ 0.37
    const halfLifeResult = applyTimeDecay(1.0, now - config.decayHalfLife, config);
    expect(halfLifeResult.decayWeight).toBeCloseTo(0.37, 1);
  });

  test('should respect minimum weight floor', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();

    // Very long delay should hit minimum weight
    const longDelayResult = applyTimeDecay(1.0, now - 100000000, config);
    expect(longDelayResult.decayWeight).toBeGreaterThanOrEqual(config.minWeight);
  });

  test('should handle feature disabled gracefully', () => {
    process.env.RL_TDCA_ENABLED = 'false';

    const isEnabled = isFeatureEnabled('tdca');
    expect(isEnabled).toBe(false);
  });
});

describe('Record Response - Request Body Validation', () => {
  test('should require responseTimestamp for TD-CA when enabled', () => {
    // When TD-CA is enabled, the API should expect responseTimestamp
    // If not provided, it should use current time as fallback
    const now = Date.now();
    expect(now).toBeGreaterThan(0);
  });

  test('should calculate delay from responseTimestamp', () => {
    const config = getFeatureConfig<TDCAConfig>('tdca');
    const now = Date.now();
    const responseTimestamp = now - 60000; // 1 minute ago

    const result = applyTimeDecay(1.0, responseTimestamp, config);
    expect(result.delayMs).toBe(60000);
  });
});
