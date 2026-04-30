/**
 * UOK-based Question Recommendation Service
 *
 * Orchestrates UOK state machine with database queries to provide
 * concrete question recommendations with full observability.
 */

import { prisma } from '@/lib/prisma';
import { UOK } from './uok';
import type { Action, RecommendationRationale } from './types';
import { RLExplorationController, selectCandidate } from '@/lib/rl/exploration';
import { isFeatureEnabled, getFeatureConfig } from '@/lib/rl/config/phase3-features';
import type { ExplorationInfo } from './types';

// Global singleton for RL controller
let rlController: RLExplorationController | null = null;

function getRLController(): RLExplorationController | null {
  if (!isFeatureEnabled('uokIntegration')) return null;
  if (!rlController) {
    const uokConfig = getFeatureConfig<{ baseCandidateCount: number; maxCandidateCount: number }>('uokIntegration');
    rlController = new RLExplorationController({
      baseCandidateCount: uokConfig.baseCandidateCount,
      maxCandidateCount: uokConfig.maxCandidateCount,
    });
  }
  return rlController;
}

/**
 * Find top N candidate questions by complexity proximity
 */
async function findTopNCandidates(
  topic: string,
  mastery: number,
  n: number
): Promise<QuestionWithComplexity[]> {
  const targetComplexity = 0.3 + (mastery * 0.5);

  const questions = await prisma.question.findMany({
    where: {
      extractionStatus: 'SUCCESS',
      complexity: { not: null },
    },
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

  const scored = questions
    .filter(q => {
      const kp = parseKnowledgePoints(q.knowledgePoints);
      return kp.some(k => k.includes(topic) || topic.includes(k));
    })
    .map(q => ({
      ...q,
      score: -Math.abs((q.complexity ?? 0.5) - targetComplexity),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n);

  return scored.map(q => ({
    id: q.id,
    content: q.content,
    difficulty: q.difficulty,
    knowledgePoints: parseKnowledgePoints(q.knowledgePoints),
    cognitiveLoad: q.cognitiveLoad,
    reasoningDepth: q.reasoningDepth,
    complexity: q.complexity,
  }));
}

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

  const mastery = studentExplanation.weakTopics.find(t => t.topic === topic)?.mastery ?? 0.5;

  // Get RL controller and candidates
  const rl = getRLController();
  const candidates = await findTopNCandidates(topic, mastery, 10);

  if (!rl) {
    // No RL integration, return best candidate
    const best = candidates[0];
    if (!best) {
      return { success: false, error: 'No questions available' };
    }
    return {
      success: true,
      question: best,
      rationale: {
        currentMastery: mastery,
        targetComplexity: 0.3 + mastery * 0.5,
        complexityGap: 0,
        reason: 'UOK recommendation (RL disabled)',
      },
    };
  }

  // Get exploration info from RL controller
  const exploration = rl.getCandidateCount({
    topic,
    mastery,
    consecutiveSameTopic: rl.getConsecutiveSameTopicCount(topic),
  });

  // Select from candidates using RL exploration
  const selected = selectCandidate(
    candidates.slice(0, exploration.candidateCount),
    exploration.explorationLevel
  );

  // Record recommendation for history tracking
  rl.recordRecommendation(topic);

  if (!selected) {
    return { success: false, error: 'No candidates available' };
  }

  const targetComplexity = 0.3 + mastery * 0.5;

  return {
    success: true,
    question: selected,
    rationale: {
      currentMastery: mastery,
      targetComplexity,
      complexityGap: Math.abs((selected.complexity ?? 0.5) - targetComplexity),
      reason: exploration.reason,
      explorationInfo: exploration,
    },
  };
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

  // Record response with RL controller for health monitoring
  const rl = getRLController();
  if (rl && topics.length > 0) {
    const topic = topics[0] ?? 'unknown';
    rl.recordResponse({
      topic,
      correct,
      complexity: question.complexity ?? 0.5,
    });
  }

  return { probability };
}
