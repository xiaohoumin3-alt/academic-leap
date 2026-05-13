/**
 * Session Management
 *
 * Manages learning session state with Prisma integration.
 * Provides session creation, updates, and persistence.
 */

import { prisma } from '@/lib/prisma';
import type { SessionQuestion, LearningSession, SessionStatus, CreateSessionOptions, SessionSummary } from './types';

/**
 * Create a new learning session
 *
 * Creates a session in the database and initializes session state.
 */
export async function createSession(options: CreateSessionOptions): Promise<LearningSession> {
  const { studentId, knowledgePointId, questionCount = 10, subject } = options;

  // Validate student exists
  const student = await prisma.user.findUnique({
    where: { id: studentId }
  });

  if (!student) {
    throw new Error(`Student not found: ${studentId}`);
  }

  // Create session in database
  const session = await prisma.practiceSession.create({
    data: {
      userId: studentId,
      status: 'active',
      currentQuestionIndex: 0,
      answers: JSON.stringify([]),
      subject: subject || null,
      questionCount,
    }
  });

  // Initialize session state
  const learningSession: LearningSession = {
    id: session.id,
    studentId,
    status: 'active',
    currentQuestionIndex: 0,
    questions: [],
    startTime: session.createdAt,
    currentKnowledgePoint: knowledgePointId,
    totalCorrect: 0,
    totalAnswered: 0,
  };

  return learningSession;
}

/**
 * Load an existing session from database
 *
 * Retrieves session state and reconstructs learning session.
 */
export async function loadSession(sessionId: string): Promise<LearningSession> {
  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const answers = JSON.parse(session.answers as string) as SessionQuestion[];

  // Calculate totals from answers
  const totalCorrect = answers.filter(a => a.isCorrect === true).length;
  const totalAnswered = answers.filter(a => a.isCorrect !== undefined).length;

  return {
    id: session.id,
    studentId: session.userId,
    status: session.status as SessionStatus,
    currentQuestionIndex: session.currentQuestionIndex,
    questions: answers,
    startTime: session.createdAt,
    endTime: session.completedAt || undefined,
    totalCorrect,
    totalAnswered,
  };
}

/**
 * Update session with new question state
 *
 * Adds a question to the session and updates database.
 */
export async function updateSessionQuestion(
  sessionId: string,
  question: SessionQuestion
): Promise<void> {
  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const answers = JSON.parse(session.answers as string) as SessionQuestion[];
  answers.push(question);

  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: {
      answers: JSON.stringify(answers),
      currentQuestionIndex: session.currentQuestionIndex + 1,
      updatedAt: new Date(),
    }
  });
}

/**
 * Update session status
 *
 * Transitions session to a new status (active -> paused -> completed).
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
): Promise<void> {
  const updateData: {
    status: string;
    completedAt?: Date;
  } = {
    status,
  };

  if (status === 'completed') {
    updateData.completedAt = new Date();
  }

  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: updateData
  });
}

/**
 * Get active session for a student
 *
 * Returns the most recent active session if exists.
 */
export async function getActiveSession(studentId: string): Promise<LearningSession | null> {
  const session = await prisma.practiceSession.findFirst({
    where: {
      userId: studentId,
      status: 'active',
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!session) {
    return null;
  }

  return loadSession(session.id);
}

/**
 * Generate session summary
 *
 * Creates analytics summary from completed session.
 */
export async function generateSessionSummary(sessionId: string): Promise<SessionSummary> {
  const session = await loadSession(sessionId);

  const knowledgePointsSet = new Set(
    session.questions
      .filter(q => q.knowledgePointId)
      .map(q => q.knowledgePointId)
  );

  const duration = session.endTime
    ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
    : Math.floor((Date.now() - session.startTime.getTime()) / 1000);

  return {
    sessionId: session.id,
    studentId: session.studentId,
    duration,
    totalQuestions: session.questions.length,
    correctAnswers: session.totalCorrect,
    accuracy: session.totalAnswered > 0
      ? session.totalCorrect / session.totalAnswered
      : 0,
    knowledgePointsPracticed: Array.from(knowledgePointsSet),
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

/**
 * Pause an active session
 *
 * Pauses session and saves current state.
 */
export async function pauseSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, 'paused');
}

/**
 * Resume a paused session
 *
 * Changes status back to active.
 */
export async function resumeSession(sessionId: string): Promise<void> {
  await updateSessionStatus(sessionId, 'active');
}

/**
 * Complete a session
 *
 * Marks session as completed and generates summary.
 */
export async function completeSession(sessionId: string): Promise<SessionSummary> {
  await updateSessionStatus(sessionId, 'completed');
  return generateSessionSummary(sessionId);
}
