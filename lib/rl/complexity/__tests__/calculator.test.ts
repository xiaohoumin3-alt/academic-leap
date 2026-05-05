/**
 * Tests for Complexity Calculator
 */

import { describe, it, expect } from '@jest/globals';
import { calculateComplexity, type QuestionFeatures } from '../calculator';
import type { ComplexitySpec } from '@/lib/rl/mapping/delta-c-to-complexity';

describe('calculateComplexity', () => {
  it('should calculate low complexity for simple linear questions', () => {
    const spec: ComplexitySpec = {
      reasoningDepth: 1,
      structure: 'linear',
      distractors: 0,
    };

    const result = calculateComplexity(spec, 1);

    expect(result.complexity).toBeGreaterThan(0);
    expect(result.complexity).toBeLessThan(0.5);
    expect(result.reasoningDepth).toBe(1);
  });

  it('should calculate high complexity for multi-equation questions', () => {
    const spec: ComplexitySpec = {
      reasoningDepth: 3,
      structure: 'multi_equation',
      distractors: 2,
    };

    const result = calculateComplexity(spec, 5);

    expect(result.complexity).toBeGreaterThan(0.7);
    expect(result.reasoningDepth).toBe(3);
  });

  it('should keep all values in valid range [0, 1]', () => {
    const specs: ComplexitySpec[] = [
      { reasoningDepth: 1, structure: 'linear', distractors: 0 },
      { reasoningDepth: 2, structure: 'nested', distractors: 1 },
      { reasoningDepth: 3, structure: 'multi_equation', distractors: 2 },
    ];

    for (const spec of specs) {
      for (let difficulty = 1; difficulty <= 5; difficulty++) {
        const result = calculateComplexity(spec, difficulty);
        expect(result.cognitiveLoad).toBeGreaterThanOrEqual(0);
        expect(result.cognitiveLoad).toBeLessThanOrEqual(1);
        expect(result.complexity).toBeGreaterThanOrEqual(0);
        expect(result.complexity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should give higher complexity for nested vs linear with same depth', () => {
    const linearSpec: ComplexitySpec = {
      reasoningDepth: 2,
      structure: 'linear',
      distractors: 0,
    };

    const nestedSpec: ComplexitySpec = {
      reasoningDepth: 2,
      structure: 'nested',
      distractors: 0,
    };

    const linearResult = calculateComplexity(linearSpec, 3);
    const nestedResult = calculateComplexity(nestedSpec, 3);

    expect(nestedResult.complexity).toBeGreaterThan(linearResult.complexity);
  });

  it('should give higher complexity with more distractors', () => {
    const baseSpec: ComplexitySpec = {
      reasoningDepth: 2,
      structure: 'linear',
      distractors: 0,
    };

    const withDistractors: ComplexitySpec = {
      reasoningDepth: 2,
      structure: 'linear',
      distractors: 2,
    };

    const baseResult = calculateComplexity(baseSpec, 3);
    const withResult = calculateComplexity(withDistractors, 3);

    expect(withResult.complexity).toBeGreaterThan(baseResult.complexity);
  });
});
