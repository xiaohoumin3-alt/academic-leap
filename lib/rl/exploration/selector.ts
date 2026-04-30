// lib/rl/exploration/selector.ts

import type { ExplorationLevel } from './types';

/**
 * Selection weights for weighted random selection based on exploration level.
 * Weights represent the probability of selecting candidates by their index position.
 * Higher weights mean higher probability of selection.
 */
export const SELECTION_WEIGHTS = {
  /** Focus on top candidates - exploit known good options */
  minimal: [0.7, 0.2, 0.1, 0, 0],
  /** Balanced approach between exploitation and exploration */
  moderate: [0.4, 0.25, 0.2, 0.1, 0.05],
  /** Equal distribution - explore all candidates */
  aggressive: [0.2, 0.2, 0.2, 0.2, 0.2],
} as const satisfies Record<ExplorationLevel, readonly number[]>;

/**
 * Select a candidate based on exploration level using weighted random selection.
 *
 * @param candidates - Array of candidates to select from (ordered by preference)
 * @param explorationLevel - Level of exploration to apply
 * @returns Selected candidate, or null if candidates array is empty
 */
export function selectCandidate<T>(
  candidates: T[],
  explorationLevel: ExplorationLevel
): T | null {
  // Handle empty array
  if (candidates.length === 0) {
    return null;
  }

  // Single candidate - return it directly
  if (candidates.length === 1) {
    return candidates[0];
  }

  const weights = SELECTION_WEIGHTS[explorationLevel];

  // Calculate cumulative weights for each candidate
  const cumWeights = candidates.map((_, index) => {
    if (index < weights.length) {
      return weights[index];
    }
    // For candidates beyond defined weights, distribute remaining probability
    // Use decreasing weight based on position
    const remainingIndex = index - weights.length;
    return weights[weights.length - 1] / (remainingIndex + 2);
  });

  // Normalize weights to ensure they sum to 1
  const totalWeight = cumWeights.reduce((sum, w) => sum + w, 0);

  // Weighted random selection using cumulative distribution
  let random = Math.random() * totalWeight;

  for (let i = 0; i < candidates.length; i++) {
    random -= cumWeights[i];
    if (random <= 0) {
      return candidates[i];
    }
  }

  // Fallback to last candidate (should rarely reach here)
  return candidates[candidates.length - 1];
}
