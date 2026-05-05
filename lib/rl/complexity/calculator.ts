/**
 * Complexity Calculator
 *
 * Calculates question complexity features from ComplexitySpec and difficulty.
 */

import type { ComplexitySpec } from '@/lib/rl/mapping/delta-c-to-complexity';

export interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}

/**
 * Structure complexity weights.
 */
const STRUCTURE_WEIGHTS: Record<ComplexitySpec['structure'], number> = {
  linear: 0.3,
  nested: 0.6,
  multi_equation: 1.0,
} as const;

/**
 * Calculate question features from ComplexitySpec.
 *
 * Formula:
 * - depthWeight = reasoningDepth / 3
 * - structureWeight = STRUCTURE_WEIGHTS[structure]
 * - distractorWeight = distractors / 2
 *
 * complexity = depthWeight * 0.4 + structureWeight * 0.4 + distractorWeight * 0.2
 * cognitiveLoad = complexity * 0.8 + (difficulty / 5) * 0.2
 *
 * @param spec - ComplexitySpec from generation parameters
 * @param difficulty - Difficulty level (1-5)
 * @returns QuestionFeatures with values in [0, 1]
 */
export function calculateComplexity(
  spec: ComplexitySpec,
  difficulty: number
): QuestionFeatures {
  // 推理深度贡献 (0.33, 0.67, 1.0)
  const depthWeight = spec.reasoningDepth / 3;

  // 结构复杂度贡献
  const structureWeight = STRUCTURE_WEIGHTS[spec.structure];

  // 干扰项贡献 (0, 0.5, 1.0)
  const distractorWeight = spec.distractors / 2;

  // 综合复杂度
  // 权重: 深度40%, 结构40%, 干扰项20%
  const complexity =
    depthWeight * 0.4 + structureWeight * 0.4 + distractorWeight * 0.2;

  // 认知负荷 = 复杂度 * 0.8 + 难度 * 0.2
  // 归一化难度到 [0, 1]
  const normalizedDifficulty = (difficulty - 1) / 4; // 0-1
  const cognitiveLoad = complexity * 0.8 + normalizedDifficulty * 0.2;

  return {
    cognitiveLoad: clamp(cognitiveLoad),
    reasoningDepth: spec.reasoningDepth,
    complexity: clamp(complexity),
  };
}

/**
 * Clamp value to [0, 1] range.
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
