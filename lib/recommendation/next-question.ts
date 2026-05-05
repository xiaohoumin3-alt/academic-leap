/**
 * Next Question Recommender
 *
 * Orchestrates the full recommendation pipeline:
 * 1. Analyze student state
 * 2. Calculate ZPD
 * 3. Match difficulty
 * 4. Apply exploration/exploitation (Bandit)
 * 5. Return recommendation
 */

import type { RecommendationContext, RecommendationResult } from './index';
import { calculateZPD, selectFromZPD } from './uok-selector';
import { matchDifficulty } from './difficulty-matcher';
import { ThompsonSamplingBandit } from '../rl';

/**
 * Get the next question recommendation
 */
export async function getNextQuestion(
  context: RecommendationContext
): Promise<RecommendationResult> {
  // TODO: Implement full recommendation pipeline

  // Step 1: Build student state from context
  // Step 2: Calculate ZPD options
  // Step 3: Select knowledge point from ZPD
  // Step 4: Match difficulty for selected point
  // Step 5: Apply exploration (Bandit) for variety
  // Step 6: Return best question with reasoning

  throw new Error('Not implemented yet');
}

/**
 * Explain why a question was recommended
 * (useful for transparency and student trust)
 */
export function explainRecommendation(
  result: RecommendationResult
): string {
  return result.reason;
}
