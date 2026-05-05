/**
 * Difficulty Matcher
 *
 * Matches question difficulty to student's current ability
 * using IRT (Item Response Theory) models.
 */

import type { Question, StudentState } from './types';
import { deltaCToDifficulty } from '../rl/irt/estimator';

export interface DifficultyMatch {
  question: Question;
  expectedProbability: number; // P(correct)
  matchScore: number; // 0-1, higher is better
}

export interface DifficultyMatcherConfig {
  targetProbability: number; // Optimal learning zone (default: 0.6)
  probabilityTolerance: number; // Acceptable range ± (default: 0.15)
  discrimination: number; // IRT discrimination parameter (default: 1.0)
  guessing: number; // IRT guessing parameter (default: 0.25)
  maxResults?: number; // Limit results (default: unlimited)
}

const DEFAULT_CONFIG: DifficultyMatcherConfig = {
  targetProbability: 0.6,
  probabilityTolerance: 0.15,
  discrimination: 1.0,
  guessing: 0.25,
};

/**
 * Find questions that match the student's ability level
 *
 * Uses IRT 3PL model to calculate expected success probability
 * and returns questions within the optimal learning zone.
 */
export function matchDifficulty(
  availableQuestions: Question[],
  studentAbility: number,
  config: Partial<DifficultyMatcherConfig> = {}
): DifficultyMatch[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (availableQuestions.length === 0) {
    return [];
  }

  // Calculate match scores for all questions
  const matches: DifficultyMatch[] = [];

  for (const question of availableQuestions) {
    // Convert difficulty (deltaC) to IRT scale if needed
    const irtDifficulty = question.difficultyLevel !== undefined
      ? deltaCToDifficulty(question.difficultyLevel)
      : deltaCToDifficulty(question.difficultyLevel || 5); // Fallback to middle difficulty

    // Calculate expected probability using IRT 3PL
    const expectedProbability = calculateIRTProbability(
      studentAbility,
      irtDifficulty,
      cfg.discrimination,
      cfg.guessing
    );

    // Calculate match score: closeness to target probability
    // Perfect match = 1.0, far from target = 0.0
    const probabilityGap = Math.abs(expectedProbability - cfg.targetProbability);
    const normalizedGap = probabilityGap / cfg.probabilityTolerance;
    const matchScore = Math.max(0, 1 - normalizedGap);

    matches.push({
      question,
      expectedProbability,
      matchScore,
    });
  }

  // Sort by match score (descending) then by expected probability
  matches.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    // Prefer questions closer to target probability
    return Math.abs(a.expectedProbability - cfg.targetProbability) -
           Math.abs(b.expectedProbability - cfg.targetProbability);
  });

  // Limit results if specified
  if (cfg.maxResults && cfg.maxResults > 0) {
    return matches.slice(0, cfg.maxResults);
  }

  return matches;
}

/**
 * Select the best matching question from available options
 *
 * Returns the question with the highest match score within tolerance.
 * Returns null if no questions match the criteria.
 */
export function selectBestMatch(
  availableQuestions: Question[],
  studentAbility: number,
  config: Partial<DifficultyMatcherConfig> = {}
): DifficultyMatch | null {
  const matches = matchDifficulty(availableQuestions, studentAbility, config);

  if (matches.length === 0) {
    return null;
  }

  // Return best match (highest score)
  return matches[0];
}

/**
 * Calculate expected probability of correct response
 * using 3PL IRT model: P(theta) = c + (1-c) / (1 + exp(-a(theta - b)))
 *
 * @param studentAbility - IRT theta parameter (typically -3 to 3)
 * @param questionDifficulty - IRT difficulty parameter (b)
 * @param discrimination - IRT discrimination parameter (a), higher = steeper curve
 * @param guessing - Pseudo-guessing parameter (c), lower bound for probability
 * @returns Expected probability of correct response [0, 1]
 */
export function calculateIRTProbability(
  studentAbility: number,
  questionDifficulty: number,
  discrimination: number = 1.0,
  guessing: number = 0.25
): number {
  // Validate inputs
  if (discrimination <= 0) {
    throw new Error(`Discrimination must be positive, got ${discrimination}`);
  }
  if (guessing < 0 || guessing >= 1) {
    throw new Error(`Guessing must be in [0, 1), got ${guessing}`);
  }

  // 3PL IRT formula: P(theta) = c + (1-c) / (1 + exp(-a(theta - b)))
  const numerator = 1 - guessing;
  const exponent = -1 * discrimination * (studentAbility - questionDifficulty);
  const denominator = 1 + Math.exp(exponent);

  return guessing + numerator / denominator;
}

/**
 * Calculate the difficulty (deltaC) that achieves target probability
 * for a given student ability.
 *
 * Inverts the IRT 3PL formula: b = theta - (1/a) * ln((1-c)/(P-c))
 *
 * @param studentAbility - IRT theta parameter
 * @param targetProbability - Desired success probability
 * @param discrimination - IRT discrimination parameter
 * @param guessing - IRT guessing parameter
 * @returns Recommended deltaC value
 */
export function calculateOptimalDeltaC(
  studentAbility: number,
  targetProbability: number,
  discrimination: number = 1.0,
  guessing: number = 0.25
): number {
  if (targetProbability <= guessing || targetProbability >= 1) {
    throw new Error(`Target probability must be in (${guessing}, 1), got ${targetProbability}`);
  }

  // Inverted 3PL: theta - b = (1/a) * ln((1-c)/(P-c))
  const numerator = 1 - guessing;
  const denominator = targetProbability - guessing;
  const logTerm = Math.log(numerator / denominator);
  const difficultyOffset = logTerm / discrimination;

  const irtDifficulty = studentAbility - difficultyOffset;

  // Convert back to deltaC scale [0, 10]
  return Math.max(0, Math.min(10, (irtDifficulty + 3) / 6 * 10));
}
