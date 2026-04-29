/**
 * UOK-based Question Recommendation Service
 *
 * Orchestrates UOK state machine with database queries to provide
 * concrete question recommendations with full observability.
 */

import { prisma } from '@/lib/prisma';
import { UOK } from './uok';
import type { Action, RecommendationRationale } from './types';

export interface QuestionWithComplexity {
  id: string;
  content: any;
  difficulty: number;
  knowledgePoints: string[];
  cognitiveLoad: number | null;
  reasoningDepth: number | null;
  complexity: number | null;
}

export interface NextQuestionRequest {
  studentId: string;
  excludeQuestionIds?: string[];
  knowledgePointFilter?: string[];
}

export interface NextQuestionResponse {
  success: boolean;
  question?: QuestionWithComplexity;
  rationale?: RecommendationRationale;
  error?: string;
}

/**
 * Get next question using UOK recommendation engine
 *
 * Algorithm:
 * 1. Use UOK.act('next_question') to get weakest topic
 * 2. Query database for questions with complexity features
 * 3. Find question with minimal complexity gap to target
 * 4. Return question with full observability
 */
export async function getNextQuestion(request: NextQuestionRequest): Promise<NextQuestionResponse> {
  const { studentId, excludeQuestionIds = [], knowledgePointFilter } = request;

  // Step 1: Get UOK instance and ensure student exists
  const uok = new UOK();
  await uok.getOrCreateStudentWithState(studentId);

  // Step 2: Get recommendation from UOK (weakest topic)
  const action = uok.act('next_question', studentId);

  if (action.type === 'done') {
    return { success: false, error: action.reason };
  }

  if (action.type === 'error') {
    return { success: false, error: action.reason };
  }

  if (action.type === 'recommend') {
    // Legacy action type - upgrade to recommend_question
    return await recommendByTopic(uok, studentId, action.topic, excludeQuestionIds, knowledgePointFilter);
  }

  // Handle gap_report if needed
  return { success: false, error: 'No recommendation available' };
}

/**
 * Recommend a question by topic with complexity matching
 */
async function recommendByTopic(
  uok: UOK,
  studentId: string,
  topic: string,
  excludeIds: string[],
  knowledgeFilter?: string[]
): Promise<NextQuestionResponse> {
  // Get student's current mastery for this topic
  const studentExplanation = uok.explain({ studentId });
  if (studentExplanation.type !== 'student') {
    return { success: false, error: 'Failed to get student state' };
  }

  const topicMastery = studentExplanation.weakTopics.find(t => t.topic === topic)?.mastery ?? 0.5;

  // Calculate target complexity based on mastery (inverse relationship)
  // Lower mastery → lower target complexity (scaffold)
  // Higher mastery → higher target complexity (challenge)
  const targetComplexity = 0.3 + (topicMastery * 0.5); // Range: 0.3 - 0.8

  // Build database query
  const where: any = {
    extractionStatus: 'SUCCESS',
    complexity: { not: null },
    cognitiveLoad: { not: null },
    reasoningDepth: { not: null },
  };

  if (excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }

  // Parse knowledge points (stored as JSON string)
  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      content: true,
      difficulty: true,
      knowledgePoints: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
    },
    take: 100,
  });

  // Filter by topic/knowledge point
  const filteredQuestions = questions.filter(q => {
    const kpList = parseKnowledgePoints(q.knowledgePoints);
    // Check if question contains the target topic
    const hasTopic = kpList.some(kp => kp.includes(topic) || topic.includes(kp));

    // Apply knowledge filter if provided
    if (knowledgeFilter && knowledgeFilter.length > 0) {
      return hasTopic && kpList.some(kp => knowledgeFilter.includes(kp));
    }

    return hasTopic;
  });

  if (filteredQuestions.length === 0) {
    // Fallback: any question with complexity features
    const fallbackQuestions = questions.filter(q => {
      if (knowledgeFilter && knowledgeFilter.length > 0) {
        const kpList = parseKnowledgePoints(q.knowledgePoints);
        return kpList.some(kp => knowledgeFilter.includes(kp));
      }
      return true;
    });

    if (fallbackQuestions.length === 0) {
      return { success: false, error: 'No questions available with complexity features' };
    }

    return findBestMatch(fallbackQuestions, topicMastery, targetComplexity, topic);
  }

  return findBestMatch(filteredQuestions, topicMastery, targetComplexity, topic);
}

/**
 * Find question with minimal complexity gap
 */
function findBestMatch(
  questions: Array<{
    id: string;
    content: any;
    difficulty: number;
    knowledgePoints: string;
    cognitiveLoad: number | null;
    reasoningDepth: number | null;
    complexity: number | null;
  }>,
  mastery: number,
  targetComplexity: number,
  topic: string
): NextQuestionResponse {
  // Score each question by complexity proximity
  const scored = questions.map(q => {
    const complexity = q.complexity ?? 0.5;
    const gap = Math.abs(complexity - targetComplexity);

    // Prefer questions slightly above target for growth
    const adjustedGap = complexity < targetComplexity ? gap * 1.5 : gap;

    return {
      question: q,
      score: -adjustedGap, // Negative because we want minimal gap
      complexity,
    };
  });

  // Sort by score (best match first)
  scored.sort((a, b) => a.score - b.score);

  const best = scored[0];
  const rationale: RecommendationRationale = {
    currentMastery: mastery,
    targetComplexity,
    complexityGap: Math.abs(best.complexity - targetComplexity),
    reason: `Weakest topic "${topic}" (mastery: ${mastery.toFixed(2)}) → closest complexity match`,
  };

  return {
    success: true,
    question: {
      id: best.question.id,
      content: best.question.content,
      difficulty: best.question.difficulty,
      knowledgePoints: parseKnowledgePoints(best.question.knowledgePoints),
      cognitiveLoad: best.question.cognitiveLoad,
      reasoningDepth: best.question.reasoningDepth,
      complexity: best.question.complexity,
    },
    rationale,
  };
}

/**
 * Parse knowledge points from JSON string or array
 */
function parseKnowledgePoints(kp: string | null): string[] {
  if (!kp) return [];

  try {
    const parsed = JSON.parse(kp);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Might be a comma-separated string
    return kp.split(',').map(s => s.trim()).filter(Boolean);
  }
}

/**
 * Encode answer to UOK (triggers learning)
 */
export async function encodeAnswerToUOK(
  studentId: string,
  questionId: string,
  correct: boolean
): Promise<{ probability: number }> {
  const uok = new UOK();

  // Load question to get features and topics
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      knowledgePoints: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
      difficulty: true,
    },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  const topics = parseKnowledgePoints(question.knowledgePoints);

  // Encode question if not already in UOK
  uok.encodeQuestion({
    id: questionId,
    content: '', // Content not needed for features
    topics,
  });

  // Encode answer (triggers ML learning)
  const probability = uok.encodeAnswer(studentId, questionId, correct);

  // Save state
  await uok.saveStudentState(studentId);

  return { probability };
}
