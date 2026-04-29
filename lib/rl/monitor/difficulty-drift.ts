// lib/rl/monitor/difficulty-drift.ts

export interface QuestionAttempt {
  questionId: string;
  correct: boolean;
  theta: number;
}

export interface DifficultyDrift {
  questionId: string;
  oldDifficulty: number;
  newDifficulty: number;
  driftAmount: number;
  significance: 'insignificant' | 'moderate' | 'significant';
}

/**
 * IRT 2PL model probability function
 * P(correct) = 1 / (1 + exp(-(theta - b)))
 *
 * @param theta - Student ability
 * @param b - Item difficulty
 * @returns Probability of correct response
 */
export function irtProbability(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

/**
 * Estimate difficulty using simplified MLE approach
 *
 * Uses the relationship:
 * - If high theta students get it wrong -> question is easier (lower b)
 * - If low theta students get it right -> question is harder (higher b)
 *
 * Simplified MLE:
 * b = avg(theta) - log(p / (1 - p))
 * where p = correct rate
 *
 * @param attempts - Question attempt history
 * @returns Estimated difficulty (b parameter)
 */
export function estimateDifficulty(attempts: QuestionAttempt[]): number {
  if (attempts.length === 0) {
    return 0;
  }

  const correctCount = attempts.filter(a => a.correct).length;
  const correctRate = correctCount / attempts.length;

  // Avoid log(0) and log(infinity)
  const p = Math.max(0.01, Math.min(0.99, correctRate));

  const avgTheta = attempts.reduce((sum, a) => sum + a.theta, 0) / attempts.length;

  // From IRT: P = 1 / (1 + exp(-(theta - b)))
  // Solving for b: b = theta - log(P / (1 - P))
  const logit = Math.log(p / (1 - p));
  const difficulty = avgTheta - logit;

  return difficulty;
}

/**
 * Detect difficulty drift for a question over time
 *
 * Splits history into older/recent halves and compares estimated difficulties.
 *
 * Significance thresholds:
 * - drift < 0.2: insignificant
 * - 0.2 <= drift < 0.3: moderate
 * - drift >= 0.3: significant
 *
 * @param history - All question attempts (mixed questionIds)
 * @param questionId - Target question to analyze
 * @param initialDifficulty - Baseline difficulty for comparison
 * @param windowSize - Optional sliding window size (default: all)
 * @returns Difficulty drift analysis
 */
export function detectDifficultyDrift(
  history: QuestionAttempt[],
  questionId: string,
  initialDifficulty: number,
  windowSize?: number
): DifficultyDrift {
  // Filter by questionId
  const questionAttempts = history.filter(a => a.questionId === questionId);

  if (questionAttempts.length === 0) {
    return {
      questionId,
      oldDifficulty: initialDifficulty,
      newDifficulty: initialDifficulty,
      driftAmount: 0,
      significance: 'insignificant',
    };
  }

  // Apply sliding window if specified
  const window = windowSize
    ? questionAttempts.slice(-windowSize)
    : questionAttempts;

  if (window.length < 2) {
    // Not enough data to detect drift
    const currentDifficulty = estimateDifficulty(window);
    return {
      questionId,
      oldDifficulty: initialDifficulty,
      newDifficulty: currentDifficulty,
      driftAmount: Math.abs(currentDifficulty - initialDifficulty),
      significance: 'insignificant',
    };
  }

  // Split into older/recent halves
  const midPoint = Math.floor(window.length / 2);
  const olderHalf = window.slice(0, midPoint);
  const recentHalf = window.slice(midPoint);

  const oldDifficulty = estimateDifficulty(olderHalf);
  const newDifficulty = estimateDifficulty(recentHalf);
  const driftAmount = Math.abs(newDifficulty - oldDifficulty);

  let significance: DifficultyDrift['significance'];
  if (driftAmount < 0.2) {
    significance = 'insignificant';
  } else if (driftAmount < 0.3) {
    significance = 'moderate';
  } else {
    significance = 'significant';
  }

  return {
    questionId,
    oldDifficulty,
    newDifficulty,
    driftAmount,
    significance,
  };
}
