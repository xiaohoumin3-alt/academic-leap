/**
 * Tests for DeltaC to ComplexitySpec mapping
 */

import { describe, it, expect } from '@jest/globals';
import {
  deltaCToComplexitySpec,
  calculateTargetComplexity,
  type ComplexitySpec,
} from '../delta-c-to-complexity';

describe('deltaCToComplexitySpec', () => {
  it('should map low DeltaC (1-3) to simple linear questions', () => {
    const result = deltaCToComplexitySpec(2);
    const expected: ComplexitySpec = {
      reasoningDepth: 1,
      structure: 'linear',
      distractors: 0,
    };
    expect(result).toEqual(expected);
  });

  it('should map mid-low DeltaC (4-5) to depth-2 linear/nested with 1 distractor', () => {
    const result4 = deltaCToComplexitySpec(4);
    expect(result4.reasoningDepth).toBe(2);
    expect(result4.structure).toBe('linear');
    expect(result4.distractors).toBe(1);

    const result5 = deltaCToComplexitySpec(5);
    expect(result5.reasoningDepth).toBe(2);
    expect(result5.structure).toBe('nested');
    expect(result5.distractors).toBe(1);
  });

  it('should map mid-high DeltaC (7-8) to depth-2 nested with 1 distractor', () => {
    const result = deltaCToComplexitySpec(7);
    expect(result.reasoningDepth).toBe(2);
    expect(result.structure).toBe('nested');
    expect(result.distractors).toBe(1);
  });

  it('should map high DeltaC (9-10) to depth-3 multi-equation with 2 distractors', () => {
    const result = deltaCToComplexitySpec(9);
    const expected: ComplexitySpec = {
      reasoningDepth: 3,
      structure: 'multi_equation',
      distractors: 2,
    };
    expect(result).toEqual(expected);
  });

  it('should clamp DeltaC to valid range [1, 10]', () => {
    const resultLow = deltaCToComplexitySpec(0);
    expect(resultLow.reasoningDepth).toBe(1);

    const resultHigh = deltaCToComplexitySpec(100);
    expect(resultHigh.reasoningDepth).toBe(3);
  });
});

describe('calculateTargetComplexity', () => {
  it('should map DeltaC 1 to complexity ~0.2', () => {
    const result = calculateTargetComplexity(1);
    expect(result).toBeCloseTo(0.2, 1);
  });

  it('should map DeltaC 5.5 to complexity ~0.55', () => {
    const result = calculateTargetComplexity(5.5);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(0.6);
  });

  it('should map DeltaC 10 to complexity ~0.9', () => {
    const result = calculateTargetComplexity(10);
    expect(result).toBeCloseTo(0.9, 1);
  });

  it('should produce values in range [0.2, 0.9]', () => {
    for (let dc = 1; dc <= 10; dc++) {
      const result = calculateTargetComplexity(dc);
      expect(result).toBeGreaterThanOrEqual(0.2);
      expect(result).toBeLessThanOrEqual(0.9);
    }
  });
});
