/**
 * Recommendation Engine - UOK (Understanding-Oriented Knowledge)
 *
 * Recommends the most appropriate next question for each student
 * based on their current understanding and learning progress.
 *
 * Data Flow:
 * StudentState -> calculateZPD -> selectFromZPD -> matchDifficulty -> getNextQuestion
 */

import type { Question } from './types';
import { getNextQuestion } from './next-question';

export interface RecommendationContext {
  studentId: string;
  currentKnowledgePoint?: string;
  recentPerformance: Array<{
    knowledgePoint: string;
    isCorrect: boolean;
    timeSpent: number;
    timestamp: Date;
  }>;
  learningGoal?: string;
  excludeQuestionIds?: string[];
}

export interface RecommendationResult {
  question: Question;
  reason: string;
  expectedDifficulty: number;
  confidence: number;
}

export interface RecommendationConfig {
  banditConfig?: {
    bucketSize?: number;
    minDeltaC?: number;
    maxDeltaC?: number;
    priorAlpha?: number;
    priorBeta?: number;
  };
  difficultyTolerance?: number;
  maxExplorationQuestions?: number;
}

/**
 * Main entry point for question recommendation
 *
 * Orchestrates the full recommendation pipeline:
 * 1. Analyze student's current state
 * 2. Identify Zone of Proximal Development (ZPD)
 * 3. Select appropriate knowledge point
 * 4. Match difficulty level using IRT
 * 5. Apply exploration/exploitation via Thompson Sampling Bandit
 * 6. Return recommendation with reasoning
 *
 * @param context - Student learning context and history
 * @param config - Optional configuration for recommendation behavior
 * @returns Recommended question with reasoning and confidence
 */
export async function recommendNextQuestion(
  context: RecommendationContext,
  config?: RecommendationConfig
): Promise<RecommendationResult> {
  // Validate context
  if (!context.studentId) {
    throw new Error('studentId is required in RecommendationContext');
  }

  if (!context.recentPerformance || context.recentPerformance.length === 0) {
    // For new students, return a baseline difficulty question
    return getBaselineRecommendation(context);
  }

  // Use the full recommendation pipeline
  return getNextQuestion(context, config);
}

/**
 * Get a baseline recommendation for new students
 *
 * Returns a medium-difficulty question to establish initial ability estimate.
 */
async function getBaselineRecommendation(
  context: RecommendationContext
): Promise<RecommendationResult> {
  const { prisma } = await import('../prisma');

  // Get a question with medium difficulty (deltaC ≈ 5)
  const question = await prisma.question.findFirst({
    where: {
      difficulty: {
        gte: 4,
        lte: 6,
      },
      ...(context.excludeQuestionIds?.length ? { id: { notIn: context.excludeQuestionIds } } : {}),
    },
    orderBy: { difficulty: 'asc' },
  });

  if (!question) {
    // Fallback to any question
    const fallbackQuestion = await prisma.question.findFirst({
      where: {
        ...(context.excludeQuestionIds?.length ? { id: { notIn: context.excludeQuestionIds } } : {}),
      },
    });

    if (!fallbackQuestion) {
      throw new Error('No questions available in the database');
    }

    return {
      question: {
        id: fallbackQuestion.id,
        knowledgePoint: context.currentKnowledgePoint || 'baseline',
        difficultyLevel: fallbackQuestion.difficulty,
        content: {
          // content is now Json type - extract question text
          question: typeof fallbackQuestion.content === 'object' && fallbackQuestion.content !== null
            ? (fallbackQuestion.content as { question?: string }).question || JSON.stringify(fallbackQuestion.content)
            : typeof fallbackQuestion.content === 'string'
              ? fallbackQuestion.content
              : JSON.stringify(fallbackQuestion.content),
          answer: fallbackQuestion.answer,
          explanation: fallbackQuestion.hint || undefined,
        },
      },
      reason: 'Starting with a baseline question to understand your current level.',
      expectedDifficulty: 5.0,
      confidence: 0.5,
    };
  }

  return {
    question: {
      id: question.id,
      knowledgePoint: context.currentKnowledgePoint || 'baseline',
      difficultyLevel: question.difficulty,
      content: {
        // content is now Json type - extract question text
        question: typeof question.content === 'object' && question.content !== null
          ? (question.content as { question?: string }).question || JSON.stringify(question.content)
          : typeof question.content === 'string'
            ? question.content
            : JSON.stringify(question.content),
        answer: question.answer,
        explanation: question.hint || undefined,
      },
    },
    reason: 'Starting with a medium difficulty question to assess your current level.',
    expectedDifficulty: 5.0,
    confidence: 0.5,
  };
}

/**
 * Get recommendations for multiple questions (batch mode)
 *
 * Useful for:
 * - Pre-fetching questions for offline use
 * - Building question pools
 * - Generating practice sets
 *
 * @param context - Student learning context
 * @param count - Number of questions to recommend
 * @param config - Optional configuration
 * @returns Array of recommendations with increasing difficulty
 */
export async function recommendNextQuestions(
  context: RecommendationContext,
  count: number,
  config?: RecommendationConfig
): Promise<RecommendationResult[]> {
  const recommendations: RecommendationResult[] = [];
  const excludeIds = new Set(context.excludeQuestionIds || []);

  for (let i = 0; i < count; i++) {
    try {
      const result = await recommendNextQuestion({
        ...context,
        excludeQuestionIds: Array.from(excludeIds),
      }, config);

      recommendations.push(result);
      excludeIds.add(result.question.id);
    } catch (error) {
      console.error(`Error getting recommendation ${i + 1}:`, error);
      break;
    }
  }

  return recommendations;
}

/**
 * Validate recommendation result
 *
 * Ensures the recommendation meets quality standards before serving.
 */
export function validateRecommendation(
  result: RecommendationResult
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check question exists and has required fields
  if (!result.question) {
    errors.push('Missing question in recommendation');
  } else {
    if (!result.question.id) {
      errors.push('Question missing id');
    }
    if (!result.question.content?.question) {
      errors.push('Question missing content');
    }
    if (!result.question.content?.answer) {
      errors.push('Question missing answer');
    }
  }

  // Check confidence is in valid range
  if (result.confidence < 0 || result.confidence > 1) {
    errors.push(`Invalid confidence: ${result.confidence} (must be 0-1)`);
  }

  // Check expected difficulty is in valid range
  if (result.expectedDifficulty < 0 || result.expectedDifficulty > 10) {
    errors.push(`Invalid expectedDifficulty: ${result.expectedDifficulty} (must be 0-10)`);
  }

  // Check reason exists
  if (!result.reason || result.reason.trim().length === 0) {
    errors.push('Missing recommendation reason');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Re-export types for convenience
export type { Question, StudentState, ZoneOfProximalDevelopment } from './types';
export type { DifficultyMatch } from './difficulty-matcher';
