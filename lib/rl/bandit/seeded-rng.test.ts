// lib/rl/bandit/seeded-rng.test.ts

import { describe, it, expect } from '@jest/globals';
import { LinearCongruentialGenerator } from './seeded-rng';

describe('LinearCongruentialGenerator', () => {
  it('should produce consistent sequence with same seed', () => {
    const rng1 = new LinearCongruentialGenerator(42);
    const rng2 = new LinearCongruentialGenerator(42);

    const values1 = [rng1.next(), rng1.next(), rng1.next()];
    const values2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(values1).toEqual(values2);
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = new LinearCongruentialGenerator(42);
    const rng2 = new LinearCongruentialGenerator(43);

    const values1 = [rng1.next(), rng1.next(), rng1.next()];
    const values2 = [rng2.next(), rng2.next(), rng2.next()];

    expect(values1).not.toEqual(values2);
  });

  it('should produce values in [0, 1)', () => {
    const rng = new LinearCongruentialGenerator(42);

    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('should support setSeed', () => {
    const rng = new LinearCongruentialGenerator(42);

    const values1 = [rng.next(), rng.next()];

    rng.setSeed(42);
    const values2 = [rng.next(), rng.next()];

    expect(values1).toEqual(values2);
  });
});
