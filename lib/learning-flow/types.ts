/**
 * Learning Flow Types
 *
 * Types for session management and question flow orchestration.
 */

/**
 * Session status tracking
 */
export type SessionStatus = 'active' | 'paused' | 'completed';

/**
 * Single question within a learning session
 */
export interface SessionQuestion {
  questionId: string;
  knowledgePointId: string;
  recommendedDifficulty: number;
  actualDifficulty?: number;
  isCorrect?: boolean;
  timeSpent?: number;
  submittedAt?: Date;
}

/**
 * Learning session state
 */
export interface LearningSession {
  id: string;
  studentId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  questions: SessionQuestion[];
  startTime: Date;
  endTime?: Date;
  currentKnowledgePoint?: string;
  totalCorrect: number;
  totalAnswered: number;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  studentId: string;
  knowledgePointId?: string;
  questionCount?: number;
  subject?: string;
}

/**
 * Session update result
 */
export interface SessionUpdateResult {
  session: LearningSession;
  isComplete: boolean;
  performance: {
    correct: number;
    total: number;
    accuracy: number;
  };
}

/**
 * Next question result
 */
export interface NextQuestionResult {
  questionId: string;
  content: {
    question: string;
    hint?: string;
    inputType?: string;
    keyboard?: string;
  };
  knowledgePointId: string;
  recommendedDifficulty: number;
  reason: string;
  sessionIndex: number;
}

/**
 * Answer submission result
 */
export interface SubmitAnswerResult {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  performance: {
    streak: number;
    sessionAccuracy: number;
  };
  nextQuestionAvailable: boolean;
}

/**
 * Session summary for analytics
 */
export interface SessionSummary {
  sessionId: string;
  studentId: string;
  duration: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  knowledgePointsPracticed: string[];
  startTime: Date;
  endTime?: Date;
}
