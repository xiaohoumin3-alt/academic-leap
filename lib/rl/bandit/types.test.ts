// lib/rl/bandit/types.test.ts

import { describe, it, expect } from '@jest/globals';
import type { BanditArm, BanditState } from './types';

describe('Bandit Types', () => {
  it('should create bandit arm', () => {
    const arm: BanditArm = {
      deltaC: 5.0,
      alpha: 1,
      beta: 1,
      pullCount: 0,
      successCount: 0,
      avgReward: null
    };
    expect(arm.deltaC).toBe(5.0);
  });

  it('should create bandit state', () => {
    const state: BanditState = {
      buckets: new Map([['5.0', {
        deltaC: 5.0,
        alpha: 1,
        beta: 1,
        pullCount: 0,
        successCount: 0,
        avgReward: null
      }]]),
      bucketSize: 0.5
    };
    expect(state.buckets.size).toBe(1);
  });
});
