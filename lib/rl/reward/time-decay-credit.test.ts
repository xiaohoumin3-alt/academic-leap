// lib/rl/reward/time-decay-credit.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateDecayWeight, applyTimeDecay, type DecayResult } from './time-decay-credit';
import type { TDCAConfig } from '../config/phase2-features';

describe('calculateDecayWeight', () => {
  const defaultConfig: TDCAConfig = {
    decayHalfLife: 1800000, // 30 minutes
    maxDelay: 7200000, // 2 hours
    minWeight: 0.1
  };

  it('should return 1.0 for zero delay', () => {
    const weight = calculateDecayWeight(0, defaultConfig.decayHalfLife, defaultConfig.minWeight);
    expect(weight).toBe(1.0);
  });

  it('should return > 0.95 for delay < 1 minute', () => {
    const weight = calculateDecayWeight(59000, defaultConfig.decayHalfLife, defaultConfig.minWeight);
    expect(weight).toBeGreaterThan(0.95);
  });

  it('should return ~0.37 for delay at half-life (30 minutes)', () => {
    // At exactly half-life, decayFactor = exp(-1) ≈ 0.368
    const weight = calculateDecayWeight(1800000, defaultConfig.decayHalfLife, defaultConfig.minWeight);
    expect(weight).toBeCloseTo(0.37, 1);
  });

  it('should return < 0.2 for delay > 2 hours', () => {
    const weight = calculateDecayWeight(7200000, defaultConfig.decayHalfLife, defaultConfig.minWeight);
    expect(weight).toBeLessThan(0.2);
  });

  it('should respect minWeight floor', () => {
    const weight = calculateDecayWeight(100000000, defaultConfig.decayHalfLife, defaultConfig.minWeight);
    expect(weight).toBe(defaultConfig.minWeight);
  });
});

describe('applyTimeDecay', () => {
  const defaultConfig: TDCAConfig = {
    decayHalfLife: 1800000, // 30 minutes
    maxDelay: 7200000, // 2 hours
    minWeight: 0.1
  };

  let now: number;

  beforeEach(() => {
    now = Date.now();
  });

  it('should return full reward for immediate response', () => {
    const result = applyTimeDecay(1.0, now, defaultConfig);

    expect(result.adjustedReward).toBeCloseTo(1.0, 1);
    expect(result.originalReward).toBe(1.0);
    expect(result.decayWeight).toBeCloseTo(1.0, 1);
    expect(result.isIgnored).toBe(false);
    expect(result.delayMs).toBe(0);
  });

  it('should decay reward for delayed response', () => {
    const responseTimestamp = now - 1800000; // 30 minutes ago
    const result = applyTimeDecay(1.0, responseTimestamp, defaultConfig);

    expect(result.adjustedReward).toBeLessThan(1.0);
    expect(result.adjustedReward).toBeGreaterThan(0);
    expect(result.originalReward).toBe(1.0);
    expect(result.decayWeight).toBeLessThan(1.0);
    expect(result.isIgnored).toBe(false);
    expect(result.delayMs).toBe(1800000);
  });

  it('should set isIgnored=true for delays beyond maxDelay', () => {
    const responseTimestamp = now - 7200001; // Just over 2 hours
    const result = applyTimeDecay(1.0, responseTimestamp, defaultConfig);

    expect(result.isIgnored).toBe(true);
    expect(result.adjustedReward).toBe(0);
  });

  it('should calculate delayMs correctly', () => {
    const delay = 1234567;
    const responseTimestamp = now - delay;
    const result = applyTimeDecay(0.8, responseTimestamp, defaultConfig);

    expect(result.delayMs).toBe(delay);
  });

  it('should preserve base reward ratio when applying decay', () => {
    const baseReward = 0.8;
    const responseTimestamp = now - 1800000; // 30 minutes ago
    const result = applyTimeDecay(baseReward, responseTimestamp, defaultConfig);

    expect(result.adjustedReward).toBeCloseTo(baseReward * result.decayWeight, 5);
  });
});
