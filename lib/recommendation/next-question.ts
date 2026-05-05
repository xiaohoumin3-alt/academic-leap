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
import type { StudentState, Question, ZoneOfProximalDevelopment } from './types';
import { calculateZPD, selectFromZPD } from './uok-selector';
import { matchDifficulty, calculateOptimalDeltaC, type DifficultyMatch } from './difficulty-matcher';
import { ThompsonSamplingBandit, type ThompsonSamplingConfig } from '../rl';
import { prisma } from '../prisma';

export interface NextQuestionConfig {
  banditConfig?: Partial<ThompsonSamplingConfig>;
  difficultyTolerance?: number;
  maxExplorationQuestions?: number;
}

export interface RecommendationPipeline {
  studentState: StudentState;
  zpdOptions: ZoneOfProximalDevelopment[];
  selectedZPD: ZoneOfProximalDevelopment | null;
  difficultyMatches: DifficultyMatch[];
  selectedDeltaC: number;
  finalQuestion: Question | null;
}

const DEFAULT_BANDIT_CONFIG: Partial<ThompsonSamplingConfig> = {
  bucketSize: 0.5,
  minDeltaC: 0,
  maxDeltaC: 10,
  priorAlpha: 1,
  priorBeta: 1,
};

/**
 * Get the next question recommendation
 *
 * Full pipeline:
 * 1. Build student state from context
 * 2. Calculate ZPD options
 * 3. Select knowledge point from ZPD
 * 4. Use Bandit to select deltaC (exploration/exploitation)
 * 5. Match difficulty for selected point
 * 6. Return best question with reasoning
 */
export async function getNextQuestion(
  context: RecommendationContext,
  config: NextQuestionConfig = {}
): Promise<RecommendationResult> {
  const pipeline: RecommendationPipeline = {
    studentState: { studentId: context.studentId, ability: 0, knowledgePoints: {} },
    zpdOptions: [],
    selectedZPD: null,
    difficultyMatches: [],
    selectedDeltaC: 5.0, // Default middle difficulty
    finalQuestion: null,
  };

  try {
    // Step 1: Build student state from context
    pipeline.studentState = await buildStudentState(context);

    // Step 2: Calculate ZPD options
    pipeline.zpdOptions = calculateZPD(
      pipeline.studentState,
      context.currentKnowledgePoint
    );

    if (pipeline.zpdOptions.length === 0) {
      // No ZPD found - use fallback
      return await getFallbackRecommendation(context, pipeline.studentState);
    }

    // Step 3: Select knowledge point from ZPD
    pipeline.selectedZPD = selectFromZPD(pipeline.zpdOptions, pipeline.studentState);

    // Step 4: Use Bandit to select deltaC for exploration/exploitation
    const bandit = new ThompsonSamplingBandit(config.banditConfig || DEFAULT_BANDIT_CONFIG);
    const selectedDeltaCString = bandit.selectArm(pipeline.studentState.ability);
    pipeline.selectedDeltaC = parseFloat(selectedDeltaCString);

    // Step 5: Get available questions and match difficulty
    const availableQuestions = await getQuestionsByKnowledgePoint(
      pipeline.selectedZPD.knowledgePoint,
      context.excludeQuestionIds || []
    );

    if (availableQuestions.length === 0) {
      return await getFallbackRecommendation(context, pipeline.studentState);
    }

    // Calculate optimal probability based on deltaC
    const irtDifficulty = (pipeline.selectedDeltaC / 10) * 6 - 3;
    const optimalProbability = Math.max(0.1, Math.min(0.9, 1 / (1 + Math.exp(-(pipeline.studentState.ability - irtDifficulty)))));

    // Match difficulty with calculated optimal probability
    pipeline.difficultyMatches = matchDifficulty(
      availableQuestions,
      pipeline.studentState.ability,
      { targetProbability: optimalProbability }
    );

    if (pipeline.difficultyMatches.length === 0) {
      return await getFallbackRecommendation(context, pipeline.studentState);
    }

    // Step 6: Select best match and create result
    const bestMatch = pipeline.difficultyMatches[0];
    pipeline.finalQuestion = bestMatch.question;

    // Build reasoning
    const reason = buildRecommendationReason(
      pipeline.studentState,
      pipeline.selectedZPD,
      bestMatch,
      pipeline.selectedDeltaC
    );

    // Calculate confidence based on match score
    const confidence = Math.max(0.5, Math.min(0.99, bestMatch.matchScore));

    return {
      question: bestMatch.question,
      reason,
      expectedDifficulty: pipeline.selectedDeltaC,
      confidence,
    };

  } catch (error) {
    console.error('Error in getNextQuestion pipeline:', error);
    return await getFallbackRecommendation(context, pipeline.studentState);
  }
}

/**
 * Build student state from recommendation context
 */
async function buildStudentState(context: RecommendationContext): Promise<StudentState> {
  // Get IRT state from database
  const irtState = await prisma.iRTStudentState.findUnique({
    where: { userId: context.studentId },
  });

  const ability = irtState?.theta ?? 0;

  // Build knowledge point mastery map
  const knowledgePoints: Record<string, {
    mastery: number;
    attempts: number;
    recentPerformance: number[];
  }> = {};

  // Group recent performance by knowledge point
  for (const perf of context.recentPerformance) {
    if (!knowledgePoints[perf.knowledgePoint]) {
      knowledgePoints[perf.knowledgePoint] = {
        mastery: 0.5,
        attempts: 0,
        recentPerformance: [],
      };
    }

    knowledgePoints[perf.knowledgePoint].attempts++;
    knowledgePoints[perf.knowledgePoint].recentPerformance.push(perf.isCorrect ? 1 : 0);

    // Keep only last 10 performances
    if (knowledgePoints[perf.knowledgePoint].recentPerformance.length > 10) {
      knowledgePoints[perf.knowledgePoint].recentPerformance.shift();
    }

    // Update mastery as average of recent performance
    const sum = knowledgePoints[perf.knowledgePoint].recentPerformance.reduce((a, b) => a + b, 0);
    knowledgePoints[perf.knowledgePoint].mastery = sum / knowledgePoints[perf.knowledgePoint].recentPerformance.length;
  }

  return {
    studentId: context.studentId,
    ability,
    knowledgePoints,
  };
}

/**
 * Get questions by knowledge point from database
 */
async function getQuestionsByKnowledgePoint(
  knowledgePoint: string,
  excludeIds: string[] = []
): Promise<Question[]> {
  const questions = await prisma.question.findMany({
    where: {
      knowledgePoints: {
        contains: knowledgePoint,
      },
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    take: 100,
  });

  return questions.map(q => ({
    id: q.id,
    knowledgePoint,
    difficultyLevel: q.difficulty,
    content: {
      question: q.content,
      answer: q.answer,
      explanation: q.hint || undefined,
    },
  }));
}

/**
 * Build human-readable recommendation reason
 */
function buildRecommendationReason(
  studentState: StudentState,
  selectedZPD: ZoneOfProximalDevelopment | null,
  match: DifficultyMatch,
  selectedDeltaC: number
): string {
  const parts: string[] = [];

  if (selectedZPD) {
    parts.push(`Based on your current progress in "${selectedZPD.knowledgePoint}"`);
  }

  parts.push(`targeting difficulty ${selectedDeltaC.toFixed(1)}`);

  const masteryPercent = Math.round(match.expectedProbability * 100);
  parts.push(`with expected success rate of ${masteryPercent}%`);

  if (match.matchScore > 0.8) {
    parts.push('(high confidence match)');
  } else if (match.matchScore > 0.5) {
    parts.push('(good match)');
  } else {
    parts.push('(exploring optimal difficulty)');
  }

  return parts.join(' ') + '.';
}

/**
 * Fallback recommendation when main pipeline fails
 */
async function getFallbackRecommendation(
  context: RecommendationContext,
  studentState: StudentState
): Promise<RecommendationResult> {
  // Get any available question
  const fallbackQuestion = await prisma.question.findFirst({
    where: {
      ...(context.excludeQuestionIds?.length ? { id: { notIn: context.excludeQuestionIds } } : {}),
    },
    orderBy: { difficulty: 'asc' },
  });

  if (!fallbackQuestion) {
    throw new Error('No questions available');
  }

  return {
    question: {
      id: fallbackQuestion.id,
      knowledgePoint: context.currentKnowledgePoint || 'general',
      difficultyLevel: fallbackQuestion.difficulty,
      content: {
        question: fallbackQuestion.content,
        answer: fallbackQuestion.answer,
        explanation: fallbackQuestion.hint || undefined,
      },
    },
    reason: 'Exploring new topics to build your learning profile.',
    expectedDifficulty: 5.0,
    confidence: 0.5,
  };
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
