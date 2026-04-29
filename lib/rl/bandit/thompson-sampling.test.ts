// lib/rl/bandit/thompson-sampling.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ThompsonSamplingBandit, validateThompsonStability } from './thompson-sampling';

describe('ThompsonSamplingBandit', () => {
  let bandit: ThompsonSamplingBandit;

  beforeEach(() => {
    bandit = new ThompsonSamplingBandit();
  });

  it('should initialize with default buckets', () => {
    const state = bandit.getState();
    expect(state.buckets.size).toBe(21); // 0 to 10 in 0.5 increments
  });

  it('should select arm within ability range', () => {
    bandit.setSeed(42);
    const arm = bandit.selectArm(5.0);
    const deltaC = parseFloat(arm);
    expect(deltaC).toBeGreaterThanOrEqual(4.0);
    expect(deltaC).toBeLessThanOrEqual(6.0);
  });

  it('should update bucket on success', () => {
    bandit.update('5.0', true);
    const state = bandit.getState();
    const bucket = state.buckets.get('5.0')!;
    expect(bucket.alpha).toBe(2); // prior 1 + 1
    expect(bucket.beta).toBe(1); // prior 1
    expect(bucket.pullCount).toBe(1);
    expect(bucket.successCount).toBe(1);
  });

  it('should update bucket on failure', () => {
    bandit.update('5.0', false);
    const state = bandit.getState();
    const bucket = state.buckets.get('5.0')!;
    expect(bucket.alpha).toBe(1); // prior 1
    expect(bucket.beta).toBe(2); // prior 1 + 1
    expect(bucket.pullCount).toBe(1);
    expect(bucket.successCount).toBe(0);
  });

  it('should clone with same state', () => {
    bandit.update('5.0', true);
    bandit.update('5.5', false);

    const cloned = bandit.clone();
    const originalState = bandit.getState();
    const clonedState = cloned.getState();

    expect(clonedState.buckets.get('5.0')?.alpha).toBe(2);
    expect(clonedState.buckets.get('5.5')?.beta).toBe(2);
  });

  it('should produce consistent selections with same seed', () => {
    bandit.setSeed(42);
    const selections1 = Array.from({ length: 10 }, () => bandit.selectArm(5.0));

    bandit.setSeed(42);
    const selections2 = Array.from({ length: 10 }, () => bandit.selectArm(5.0));

    expect(selections1).toEqual(selections2);
  });
});

describe('validateThompsonStability', () => {
  it('should calculate CS score', () => {
    const bandit = new ThompsonSamplingBandit();
    const result = validateThompsonStability(bandit, {
      seeds: [1, 2, 3],
      ability: 5.0,
      trials: 100
    });

    expect(result.csScore).toBeGreaterThanOrEqual(0);
    expect(result.csScore).toBeLessThanOrEqual(1);
    expect(result.details).toHaveLength(3);
  });

  it('should have high CS with stable posterior', () => {
    const bandit = new ThompsonSamplingBandit();
    // Warm up with some data to create stable posterior
    for (let i = 0; i < 50; i++) {
      bandit.update('5.0', i % 2 === 0);
    }

    const result = validateThompsonStability(bandit, {
      seeds: [1, 2, 3, 4, 5],
      ability: 5.0,
      trials: 50
    });

    expect(result.csScore).toBeGreaterThan(0.5);
  });
});
