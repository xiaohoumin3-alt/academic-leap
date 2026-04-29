// lib/rl/irt/estimator.test.ts

import { describe, it, expect } from '@jest/globals';
import { estimateAbilityEAP, deltaCToDifficulty, thetaToDeltaC } from './estimator';

describe('estimateAbilityEAP', () => {
  it('should return prior for empty responses', () => {
    const result = estimateAbilityEAP([]);
    expect(result.theta).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it('should estimate higher theta for correct responses on easy questions', () => {
    const responses = [
      { correct: true, deltaC: 2 },
      { correct: true, deltaC: 3 },
      { correct: true, deltaC: 4 }
    ];
    const result = estimateAbilityEAP(responses);
    expect(result.theta).toBeGreaterThan(0);
  });

  it('should estimate lower theta for incorrect responses on hard questions', () => {
    const responses = [
      { correct: false, deltaC: 8 },
      { correct: false, deltaC: 9 },
      { correct: false, deltaC: 10 }
    ];
    const result = estimateAbilityEAP(responses);
    expect(result.theta).toBeLessThan(0);
  });

  it('should have lower confidence with more data', () => {
    const fewResponses = [
      { correct: true, deltaC: 5 },
      { correct: false, deltaC: 5 }
    ];
    const manyResponses = Array.from({ length: 50 }, (_, i) => ({
      correct: i < 25,
      deltaC: 5
    }));

    const resultFew = estimateAbilityEAP(fewResponses);
    const resultMany = estimateAbilityEAP(manyResponses);

    expect(resultMany.confidence).toBeLessThan(resultFew.confidence);
  });

  it('should handle mixed responses', () => {
    const responses = [
      { correct: true, deltaC: 4 },
      { correct: true, deltaC: 5 },
      { correct: false, deltaC: 6 },
      { correct: false, deltaC: 7 }
    ];
    const result = estimateAbilityEAP(responses);
    // Correct on easier questions + incorrect on harder = positive theta
    expect(result.theta).toBeGreaterThan(0);
    expect(result.theta).toBeLessThan(3);
  });
});

describe('deltaCToDifficulty', () => {
  it('should map deltaC 0 to difficulty -3', () => {
    expect(deltaCToDifficulty(0)).toBe(-3);
  });

  it('should map deltaC 10 to difficulty 3', () => {
    expect(deltaCToDifficulty(10)).toBe(3);
  });

  it('should map deltaC 5 to difficulty 0', () => {
    expect(deltaCToDifficulty(5)).toBeCloseTo(0);
  });
});

describe('thetaToDeltaC', () => {
  it('should map theta -3 to deltaC 0', () => {
    expect(thetaToDeltaC(-3)).toBeCloseTo(0);
  });

  it('should map theta 3 to deltaC 10', () => {
    expect(thetaToDeltaC(3)).toBeCloseTo(10);
  });

  it('should map theta 0 to deltaC 5', () => {
    expect(thetaToDeltaC(0)).toBeCloseTo(5);
  });

  it('should be inverse of deltaCToDifficulty', () => {
    const deltaC = 7.5;
    const difficulty = deltaCToDifficulty(deltaC);
    const recovered = thetaToDeltaC(difficulty);
    expect(recovered).toBeCloseTo(deltaC);
  });
});
