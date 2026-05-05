/**
 * DeltaC to ComplexitySpec Mapping
 *
 * Converts RL bandit recommendation (DeltaC: 1-10) to QIE generation spec.
 */

export interface ComplexitySpec {
  reasoningDepth: 1 | 2 | 3;
  structure: 'linear' | 'nested' | 'multi_equation';
  distractors: 0 | 1 | 2;
}

/**
 * Mapping rule:
 *
 * | DeltaC | Depth | Structure    | Distractors | Target Complexity |
 * |--------|-------|--------------|-------------|-------------------|
 * | 1-3    | 1     | linear       | 0           | 0.2-0.4           |
 * | 4-6    | 2     | linear/nested| 1           | 0.4-0.6           |
 * | 7-8    | 2     | nested       | 1           | 0.6-0.7           |
 * | 9-10   | 3     | multi_equation| 2          | 0.7-0.9           |
 */
export function deltaCToComplexitySpec(deltaC: number): ComplexitySpec {
  const clamped = Math.max(1, Math.min(10, deltaC));

  if (clamped <= 3) {
    return {
      reasoningDepth: 1,
      structure: 'linear',
      distractors: 0,
    };
  }

  if (clamped <= 6) {
    return {
      reasoningDepth: 2,
      structure: clamped <= 5 ? 'linear' : 'nested',
      distractors: 1,
    };
  }

  if (clamped <= 8) {
    return {
      reasoningDepth: 2,
      structure: 'nested',
      distractors: 1,
    };
  }

  return {
    reasoningDepth: 3,
    structure: 'multi_equation',
    distractors: 2,
  };
}

/**
 * Calculate target complexity from DeltaC.
 *
 * Uses non-linear mapping to better distinguish higher difficulties.
 *
 * DeltaC (1-10) → Complexity (0.2-0.9)
 */
export function calculateTargetComplexity(deltaC: number): number {
  const clamped = Math.max(1, Math.min(10, deltaC));
  const normalized = (clamped - 1) / 9; // 0-1
  return 0.2 + normalized * 0.7; // 0.2-0.9
}

/**
 * Convert DeltaC to difficulty level (1-5) for legacy API compatibility.
 */
export function deltaCToDifficulty(deltaC: number): 1 | 2 | 3 | 4 | 5 {
  const clamped = Math.max(1, Math.min(10, deltaC));
  const difficulty = Math.round(clamped / 2);
  return Math.min(5, Math.max(1, difficulty)) as 1 | 2 | 3 | 4 | 5;
}
