// lib/rl/exploration/selector.test.ts

import { describe, it, expect } from '@jest/globals';
import { selectCandidate, SELECTION_WEIGHTS } from './selector';

describe('selectCandidate', () => {
  const candidates = [
    { id: 1, score: 0.9 },
    { id: 2, score: 0.8 },
    { id: 3, score: 0.7 },
    { id: 4, score: 0.6 },
    { id: 5, score: 0.5 },
  ];

  describe('minimal exploration', () => {
    it('should select first candidate most of the time', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'minimal')
      );
      const firstCount = results.filter(r => r?.id === 1).length;
      expect(firstCount).toBeGreaterThan(50);
    });

    it('should rarely select beyond third candidate', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'minimal')
      );
      const beyondThird = results.filter(r => r && r.id > 3).length;
      expect(beyondThird).toBe(0);
    });
  });

  describe('aggressive exploration', () => {
    it('should distribute selections more evenly', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'aggressive')
      );
      const uniqueSelections = new Set(results.filter(r => r).map(r => r!.id)).size;
      expect(uniqueSelections).toBeGreaterThan(2);
    });
  });

  describe('moderate exploration', () => {
    it('should balance between minimal and aggressive', () => {
      const results = Array(100).fill(null).map(() =>
        selectCandidate(candidates, 'moderate')
      );
      const firstCount = results.filter(r => r?.id === 1).length;
      const secondCount = results.filter(r => r?.id === 2).length;
      // First should be more than half but not overwhelming
      expect(firstCount).toBeGreaterThan(20);
      expect(secondCount).toBeGreaterThan(10);
    });
  });

  describe('edge cases', () => {
    it('should return the only candidate for single-item array', () => {
      const single = [{ id: 1 }];
      const result = selectCandidate(single, 'minimal');
      expect(result?.id).toBe(1);
    });

    it('should return null for empty array', () => {
      const result = selectCandidate([], 'minimal');
      expect(result).toBeNull();
    });
  });
});

describe('SELECTION_WEIGHTS', () => {
  it('should have weights that sum to 1.0 for each level', () => {
    for (const level of ['minimal', 'moderate', 'aggressive'] as const) {
      const sum = SELECTION_WEIGHTS[level].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it('should have correct weights for minimal exploration', () => {
    expect(SELECTION_WEIGHTS.minimal[0]).toBeGreaterThan(0.5);
    expect(SELECTION_WEIGHTS.minimal[1]).toBeGreaterThan(0.1);
    expect(SELECTION_WEIGHTS.minimal[3]).toBe(0);
  });

  it('should have equal weights for aggressive exploration', () => {
    const weights = SELECTION_WEIGHTS.aggressive;
    expect(weights[0]).toBe(weights[1]);
    expect(weights[1]).toBe(weights[2]);
    expect(weights[2]).toBe(weights[3]);
  });
});
