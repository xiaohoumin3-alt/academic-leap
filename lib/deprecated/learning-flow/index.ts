/**
 * Learning Flow - Main Session Orchestration
 *
 * Manages the complete learning session lifecycle:
 * - Start session with initial question
 * - Get next question with recommendation
 * - Submit answer and update state
 * - End session with summary
 *
 * Integrates with:
 * - recommendation/ for question selection
 * - learning-path/ for path micro-adjustments
 * - question-engine/ for template-based questions
 */

export * from './session';
export * from './types';
export * from './template-question';

import { prisma } from '@/lib/prisma';
import { recommendNextQuestion, type RecommendationContext } from '@/lib/recommendation';
import { applyMicroAdjustments, type PracticeResult } from '@/lib/learning-path/adapter';
import { generateTemplateQuestion, hasTemplate } from './template-question';
import type {
  LearningSession,
  CreateSessionOptions,
  NextQuestionResult,
  SubmitAnswerResult,
  SessionSummary,
  SessionQuestion,
} from './types';
import {
  createSession,
  loadSession,
  updateSessionQuestion,
  updateSessionStatus,
  getActiveSession,
  pauseSession,
  resumeSession as setSessionActive,
  completeSession,
  generateSessionSummary,
} from './session';

/**
 * Start a new learning session
 *
 * Creates a new session and prepares the first question.
 * Optionally resumes existing active session.
 */
export async function startSession(
  options: CreateSessionOptions
): Promise<{
  session: LearningSession;
  firstQuestion: NextQuestionResult | null;
}> {
  // Check for existing active session
  const existingSession = await getActiveSession(options.studentId);

  let session: LearningSession;

  if (existingSession) {
    // Resume existing session
    session = existingSession;
    if (session.status === 'paused') {
      await updateSessionStatus(session.id, 'active');
    }
  } else {
    // Create new session
    session = await createSession(options);
  }

  // Get first question
  const firstQuestion = await getNextQuestion(session.id);

  return {
    session,
    firstQuestion,
  };
}

/**
 * Get the next question for a session
 *
 * Integrates with recommendation engine to select optimal question.
 * Falls back to template-based generation when no database questions available.
 */
export async function getNextQuestion(sessionId: string): Promise<NextQuestionResult | null> {
  const session = await loadSession(sessionId);

  // Check if session is active
  if (session.status !== 'active') {
    throw new Error(`Cannot get question for ${session.status} session`);
  }

  // Build recommendation context from session history
  const recentPerformance = session.questions
    .filter(q => q.isCorrect !== undefined && q.knowledgePointId)
    .map(q => ({
      knowledgePoint: q.knowledgePointId!,
      isCorrect: q.isCorrect!,
      timeSpent: q.timeSpent || 0,
      timestamp: q.submittedAt || new Date(),
    }));

  const excludeQuestionIds = session.questions.map(q => q.questionId);

  const context: RecommendationContext = {
    studentId: session.studentId,
    currentKnowledgePoint: session.currentKnowledgePoint,
    recentPerformance,
    excludeQuestionIds,
  };

  try {
    const recommendation = await recommendNextQuestion(context);

    // Try to fetch full question data from database
    const questionData = await prisma.question.findUnique({
      where: { id: recommendation.question.id },
      include: { steps: true }
    });

    if (questionData) {
      // Found question in database - knowledgePoints is now Json type
      let knowledgePoints: string[] = [];
      if (Array.isArray(questionData.knowledgePoints)) {
        knowledgePoints = questionData.knowledgePoints.map(kp => {
          if (typeof kp === 'string') return kp;
          if (typeof kp === 'object' && kp !== null) {
            return (kp as { id?: string }).id || '';
          }
          return String(kp);
        }).filter(Boolean);
      } else if (typeof questionData.knowledgePoints === 'string') {
        try {
          const parsed = JSON.parse(questionData.knowledgePoints);
          if (Array.isArray(parsed)) {
            knowledgePoints = parsed.map(kp => {
              if (typeof kp === 'string') return kp;
              if (typeof kp === 'object' && kp !== null) {
                return (kp as { id?: string }).id || '';
              }
              return String(kp);
            }).filter(Boolean);
          }
        } catch { /* ignore */ }
      }
      const knowledgePointId = knowledgePoints[0] || session.currentKnowledgePoint || 'general';

      return {
        questionId: questionData.id,
        content: {
          // content is now Json type - extract question text
          question: typeof questionData.content === 'object' && questionData.content !== null
            ? (questionData.content as { question?: string }).question || JSON.stringify(questionData.content)
            : typeof questionData.content === 'string'
              ? questionData.content
              : JSON.stringify(questionData.content),
          hint: questionData.hint || undefined,
          inputType: questionData.steps[0]?.inputType || undefined,
          keyboard: questionData.steps[0]?.keyboard || undefined,
        },
        knowledgePointId,
        recommendedDifficulty: recommendation.expectedDifficulty,
        reason: recommendation.reason,
        sessionIndex: session.currentQuestionIndex,
      };
    }

    // No database question found - check if we can generate from template
    const targetKnowledgePoint = session.currentKnowledgePoint || recommendation.question.knowledgePoint;

    if (hasTemplate(targetKnowledgePoint)) {
      const templateQuestion = await generateTemplateQuestion(
        targetKnowledgePoint,
        Math.round((recommendation.expectedDifficulty / 10) * 5)
      );

      if (templateQuestion) {
        return {
          questionId: templateQuestion.id,
          content: {
            question: templateQuestion.content.question,
            hint: templateQuestion.content.explanation,
          },
          knowledgePointId: targetKnowledgePoint,
          recommendedDifficulty: recommendation.expectedDifficulty,
          reason: recommendation.reason + ' (generated from template)',
          sessionIndex: session.currentQuestionIndex,
        };
      }
    }

    // Fallback: return recommendation without full content
    // (UI will need to handle this gracefully)
    console.warn('No database question or template found for recommendation');
    return null;

  } catch (error) {
    console.error('Failed to get recommendation:', error);

    // Try template generation as fallback
    if (session.currentKnowledgePoint && hasTemplate(session.currentKnowledgePoint)) {
      const templateQuestion = await generateTemplateQuestion(
        session.currentKnowledgePoint,
        3 // Default to medium difficulty
      );

      if (templateQuestion) {
        return {
          questionId: templateQuestion.id,
          content: {
            question: templateQuestion.content.question,
            hint: templateQuestion.content.explanation,
          },
          knowledgePointId: session.currentKnowledgePoint,
          recommendedDifficulty: 5.0,
          reason: 'Generated from template (fallback)',
          sessionIndex: session.currentQuestionIndex,
        };
      }
    }

    return null;
  }
}

/**
 * Submit answer for current question
 *
 * Records answer, updates session state, and triggers micro-adjustments.
 */
export async function submitAnswer(
  sessionId: string,
  questionId: string,
  userAnswer: string,
  timeSpent: number
): Promise<SubmitAnswerResult> {
  const session = await loadSession(sessionId);

  // Fetch question data
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { steps: true }
  });

  if (!question) {
    throw new Error(`Question not found: ${questionId}`);
  }

  // Determine correctness (compare with first step answer for simplicity)
  // In production, this would use the full step validation logic
  const correctAnswer = question.steps[0]?.answer || question.answer;
  const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

  // Parse knowledge points (knowledgePoints is now Json type)
  let knowledgePoints: string[] = [];
  if (Array.isArray(question.knowledgePoints)) {
    knowledgePoints = question.knowledgePoints.map(kp => {
      if (typeof kp === 'string') return kp;
      if (typeof kp === 'object' && kp !== null) {
        return (kp as { id?: string }).id || '';
      }
      return String(kp);
    }).filter(Boolean);
  } else if (typeof question.knowledgePoints === 'string') {
    try {
      const parsed = JSON.parse(question.knowledgePoints);
      if (Array.isArray(parsed)) {
        knowledgePoints = parsed.map(kp => {
          if (typeof kp === 'string') return kp;
          if (typeof kp === 'object' && kp !== null) {
            return (kp as { id?: string }).id || '';
          }
          return String(kp);
        }).filter(Boolean);
      }
    } catch { /* ignore */ }
  }
  const knowledgePointId = knowledgePoints[0] || session.currentKnowledgePoint || 'general';

  // Create session question entry
  const sessionQuestion: SessionQuestion = {
    questionId,
    knowledgePointId,
    recommendedDifficulty: question.difficulty,
    actualDifficulty: question.difficulty,
    isCorrect,
    timeSpent,
    submittedAt: new Date(),
  };

  // Update session
  await updateSessionQuestion(sessionId, sessionQuestion);

  // Update learning path with micro-adjustment
  if (session.currentKnowledgePoint) {
    await triggerMicroAdjustment(session.studentId, knowledgePointId, isCorrect);
  }

  // Calculate session performance
  const updatedSession = await loadSession(sessionId);
  const sessionAccuracy = updatedSession.totalAnswered > 0
    ? updatedSession.totalCorrect / updatedSession.totalAnswered
    : 0;

  // Get current streak (simplified - could be enhanced with gaming module)
  const streak = isCorrect ? getLastStreak(updatedSession.questions) + 1 : 0;

  // Check if more questions are available
  const nextQuestion = await getNextQuestion(sessionId);
  const nextQuestionAvailable = nextQuestion !== null;

  return {
    isCorrect,
    correctAnswer,
    explanation: question.hint || undefined,
    performance: {
      streak,
      sessionAccuracy,
    },
    nextQuestionAvailable,
  };
}

/**
 * End the current learning session
 *
 * Pauses or completes session and returns summary.
 */
export async function endSession(
  sessionId: string,
  complete: boolean = false
): Promise<SessionSummary> {
  const session = await loadSession(sessionId);

  if (complete) {
    return await completeSession(sessionId);
  } else {
    await pauseSession(sessionId);
    return generateSessionSummary(sessionId);
  }
}

/**
 * Get session summary without ending session
 */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  return generateSessionSummary(sessionId);
}

/**
 * Trigger micro-adjustment based on practice result
 *
 * Updates learning path priorities based on answer correctness.
 */
async function triggerMicroAdjustment(
  studentId: string,
  knowledgePointId: string,
  isCorrect: boolean
): Promise<void> {
  try {
    // Get active learning path for student
    const activePath = await prisma.learningPath.findFirst({
      where: {
        userId: studentId,
        status: 'active',
      }
    });

    if (!activePath) {
      return; // No active path to adjust
    }

    // Parse knowledge data
    const knowledgeData = JSON.parse(activePath.knowledgeData as string);
    const targetNode = knowledgeData.find(
      (node: { nodeId: string }) => node.nodeId === knowledgePointId
    );

    if (!targetNode) {
      return; // Node not in path
    }

    // Import and use micro-adjustment
    const { calculateMicroAdjustments } = await import('@/lib/learning-path/adapter');

    const result = calculateMicroAdjustments(knowledgeData, [
      { knowledgePointId, isCorrect }
    ]);

    if (result.adjustments.length > 0) {
      await applyMicroAdjustments(activePath.id, result.adjustments);
    }
  } catch (error) {
    console.error('Failed to apply micro-adjustment:', error);
    // Don't throw - micro-adjustment failure shouldn't break the flow
  }
}

/**
 * Calculate current answer streak
 *
 * Returns consecutive correct answers count.
 */
function getLastStreak(questions: SessionQuestion[]): number {
  let streak = 0;

  for (let i = questions.length - 1; i >= 0; i--) {
    if (questions[i].isCorrect === true) {
      streak++;
    } else if (questions[i].isCorrect === false) {
      break;
    }
  }

  return streak;
}

/**
 * Get active session for a student
 *
 * Returns the current session if one exists.
 */
export async function getStudentActiveSession(studentId: string): Promise<LearningSession | null> {
  return getActiveSession(studentId);
}

/**
 * Resume a paused session
 *
 * Changes status to active and returns session with next question.
 */
export async function resumeSessionFlow(
  sessionId: string
): Promise<{
  session: LearningSession;
  nextQuestion: NextQuestionResult | null;
}> {
  await setSessionActive(sessionId);
  const session = await loadSession(sessionId);
  const nextQuestion = await getNextQuestion(sessionId);

  return {
    session,
    nextQuestion,
  };
}
