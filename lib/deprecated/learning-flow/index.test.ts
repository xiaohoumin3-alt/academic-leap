/**
 * Learning Flow Index Tests
 *
 * Tests for the main orchestration functions in the learning-flow module.
 */

import {
  getNextQuestion,
  submitAnswer,
  endSession,
  getSessionSummary,
  getStudentActiveSession,
  resumeSessionFlow,
} from '@/lib/learning-flow/index';
import * as session from '@/lib/learning-flow/session';
import type { LearningSession, SessionSummary } from '@/lib/learning-flow/types';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    practiceSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    question: {
      findUnique: jest.fn(),
    },
    learningPath: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/learning-flow/session', () => ({
  createSession: jest.fn(),
  loadSession: jest.fn(),
  updateSessionQuestion: jest.fn(),
  updateSessionStatus: jest.fn(),
  getActiveSession: jest.fn(),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  completeSession: jest.fn(),
  generateSessionSummary: jest.fn(),
}));

jest.mock('@/lib/recommendation', () => ({
  recommendNextQuestion: jest.fn(),
}));

jest.mock('@/lib/learning-path/adapter', () => ({
  applyMicroAdjustments: jest.fn(),
  calculateMicroAdjustments: jest.fn(),
}));

describe('Learning Flow Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNextQuestion', () => {
    beforeEach(() => {
      // Reset loadSession for each test
      (session.loadSession as jest.Mock).mockReset();
    });

    it('should throw error for non-active session', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        questions: [],
        startTime: new Date(),
        totalCorrect: 8,
        totalAnswered: 10,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      await expect(getNextQuestion('session-1')).rejects.toThrow(
        'Cannot get question for completed session'
      );
    });

    it('should return null when recommendation is null', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue(null);

      // When no database question or template is available, returns null
      const result = await getNextQuestion('session-1');

      expect(result).toBeNull();
    });

    it('should throw error when session not found', async () => {
      (session.loadSession as jest.Mock).mockReset();
      (session.loadSession as jest.Mock).mockRejectedValue(new Error('Session not found'));

      await expect(getNextQuestion('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should return question when found in database', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue({
        question: { id: 'q-1', knowledgePoint: 'kp-1' },
        expectedDifficulty: 5,
        reason: 'Test recommendation',
      });

      const { prisma } = require('@/lib/prisma');
      prisma.question.findUnique.mockReset();
      prisma.question.findUnique.mockResolvedValue({
        id: 'q-1',
        content: 'What is 2 + 2?',
        knowledgePoints: '["kp-1"]',
        difficulty: 5,
        hint: 'Think of addition',
        steps: [{ inputType: 'number', keyboard: 'numeric', answer: '4' }],
      });

      const result = await getNextQuestion('session-1');

      expect(result).not.toBeNull();
      expect(result?.questionId).toBe('q-1');
      expect(result?.content.question).toBe('What is 2 + 2?');
      expect(result?.recommendedDifficulty).toBe(5);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      (session.loadSession as jest.Mock).mockReset();
      (session.updateSessionQuestion as jest.Mock).mockReset();
    });

    it('should throw error when question not found', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      const { prisma } = require('@/lib/prisma');
      prisma.question.findUnique.mockReset();
      prisma.question.findUnique.mockResolvedValue(null);

      await expect(submitAnswer('session-1', 'nonexistent', '4', 30000)).rejects.toThrow(
        'Question not found'
      );
    });

    it('should correctly evaluate correct answer', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      const updatedSession: LearningSession = {
        ...mockSession,
        questions: [{ questionId: 'q-1', isCorrect: true, knowledgePointId: 'kp-1', recommendedDifficulty: 5 }],
        totalCorrect: 1,
        totalAnswered: 1,
      };

      // submitAnswer calls loadSession multiple times:
      // 1. First call to get the session
      // 2. Second call inside getNextQuestion (check if active)
      // 3. Third call after updateSessionQuestion (get updated state)
      (session.loadSession as jest.Mock).mockResolvedValue(updatedSession);

      const { prisma } = require('@/lib/prisma');
      prisma.question.findUnique.mockReset();
      prisma.question.findUnique.mockResolvedValue({
        id: 'q-1',
        content: 'What is 2 + 2?',
        knowledgePoints: '["kp-1"]',
        difficulty: 5,
        answer: '4',
        hint: 'Think of addition',
        steps: [{ answer: '4' }],
      });

      (session.updateSessionQuestion as jest.Mock).mockResolvedValue(undefined);
      prisma.learningPath.findFirst.mockReset();
      prisma.learningPath.findFirst.mockResolvedValue(null);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue(null);

      const result = await submitAnswer('session-1', 'q-1', '4', 30000);

      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe('4');
      expect(result.explanation).toBe('Think of addition');
      expect(session.updateSessionQuestion).toHaveBeenCalled();
    });

    it('should correctly evaluate incorrect answer', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      const updatedSession: LearningSession = {
        ...mockSession,
        questions: [{ questionId: 'q-1', isCorrect: false, knowledgePointId: 'kp-1', recommendedDifficulty: 5 }],
        totalCorrect: 0,
        totalAnswered: 1,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(updatedSession);

      const { prisma } = require('@/lib/prisma');
      prisma.question.findUnique.mockReset();
      prisma.question.findUnique.mockResolvedValue({
        id: 'q-1',
        content: 'What is 2 + 2?',
        knowledgePoints: '["kp-1"]',
        difficulty: 5,
        answer: '4',
        steps: [{ answer: '4' }],
      });

      (session.updateSessionQuestion as jest.Mock).mockResolvedValue(undefined);
      prisma.learningPath.findFirst.mockReset();
      prisma.learningPath.findFirst.mockResolvedValue(null);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue(null);

      const result = await submitAnswer('session-1', 'q-1', '5', 30000);

      expect(result.isCorrect).toBe(false);
      expect(result.correctAnswer).toBe('4');
    });
  });

  describe('endSession', () => {
    beforeEach(() => {
      // Reset mocks that may have been set by previous tests
      (session.completeSession as jest.Mock).mockReset();
      (session.pauseSession as jest.Mock).mockReset();
      (session.generateSessionSummary as jest.Mock).mockReset();
      (session.loadSession as jest.Mock).mockReset();
    });

    it('should complete session when complete=true', async () => {
      const mockSummary: SessionSummary = {
        sessionId: 'session-1',
        studentId: 'student-1',
        duration: 600,
        totalQuestions: 10,
        correctAnswers: 8,
        accuracy: 0.8,
        knowledgePointsPracticed: ['kp-1'],
        startTime: new Date(),
        endTime: new Date(),
      };

      (session.completeSession as jest.Mock).mockResolvedValue(mockSummary);

      const result = await endSession('session-1', true);

      expect(session.completeSession).toHaveBeenCalledWith('session-1');
      expect(result.sessionId).toBe('session-1');
      expect(result.accuracy).toBe(0.8);
    });

    it('should pause session when complete=false', async () => {
      const mockSummary: SessionSummary = {
        sessionId: 'session-1',
        studentId: 'student-1',
        duration: 300,
        totalQuestions: 5,
        correctAnswers: 3,
        accuracy: 0.6,
        knowledgePointsPracticed: ['kp-1'],
        startTime: new Date(),
      };

      (session.pauseSession as jest.Mock).mockResolvedValue(undefined);
      (session.generateSessionSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await endSession('session-1', false);

      expect(session.pauseSession).toHaveBeenCalledWith('session-1');
      expect(result.duration).toBe(300);
    });

    it('should pause session when complete parameter is omitted (default false)', async () => {
      const mockSummary: SessionSummary = {
        sessionId: 'session-1',
        studentId: 'student-1',
        duration: 600,
        totalQuestions: 10,
        correctAnswers: 8,
        accuracy: 0.8,
        knowledgePointsPracticed: ['kp-1'],
        startTime: new Date(),
      };

      (session.pauseSession as jest.Mock).mockResolvedValue(undefined);
      (session.generateSessionSummary as jest.Mock).mockResolvedValue(mockSummary);

      // Call without the complete parameter - should default to pausing
      const result = await endSession('session-1');

      expect(session.pauseSession).toHaveBeenCalledWith('session-1');
      expect(result.sessionId).toBe('session-1');
    });
  });

  describe('getSessionSummary', () => {
    beforeEach(() => {
      (session.generateSessionSummary as jest.Mock).mockReset();
    });

    it('should return session summary', async () => {
      const mockSummary: SessionSummary = {
        sessionId: 'session-1',
        studentId: 'student-1',
        duration: 600,
        totalQuestions: 10,
        correctAnswers: 8,
        accuracy: 0.8,
        knowledgePointsPracticed: ['kp-1', 'kp-2'],
        startTime: new Date(),
        endTime: new Date(),
      };

      (session.generateSessionSummary as jest.Mock).mockResolvedValue(mockSummary);

      const result = await getSessionSummary('session-1');

      expect(result.sessionId).toBe('session-1');
      expect(result.accuracy).toBe(0.8);
      expect(result.knowledgePointsPracticed).toHaveLength(2);
    });
  });

  describe('getStudentActiveSession', () => {
    beforeEach(() => {
      (session.getActiveSession as jest.Mock).mockReset();
    });

    it('should return active session for student', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        questions: [],
        startTime: new Date(),
        totalCorrect: 3,
        totalAnswered: 5,
      };

      (session.getActiveSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await getStudentActiveSession('student-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-1');
    });

    it('should return null when no active session', async () => {
      (session.getActiveSession as jest.Mock).mockResolvedValue(null);

      const result = await getStudentActiveSession('student-1');

      expect(result).toBeNull();
    });
  });

  describe('resumeSessionFlow', () => {
    beforeEach(() => {
      (session.loadSession as jest.Mock).mockReset();
    });

    it('should resume session and return next question as null when no recommendation', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        questions: [],
        startTime: new Date(),
        totalCorrect: 3,
        totalAnswered: 5,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue(null);

      const result = await resumeSessionFlow('session-1');

      expect(result.session.status).toBe('active');
      expect(result.nextQuestion).toBeNull();
    });

    it('should resume session with next question when available', async () => {
      const mockSession: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active', // Must be active for getNextQuestion to work
        currentQuestionIndex: 5,
        questions: [],
        startTime: new Date(),
        totalCorrect: 3,
        totalAnswered: 5,
      };

      (session.loadSession as jest.Mock).mockResolvedValue(mockSession);

      const { recommendNextQuestion } = require('@/lib/recommendation');
      recommendNextQuestion.mockReset();
      recommendNextQuestion.mockResolvedValue({
        question: { id: 'q-1', knowledgePoint: 'kp-1' },
        expectedDifficulty: 5,
        reason: 'Test',
      });

      const { prisma } = require('@/lib/prisma');
      prisma.question.findUnique.mockReset();
      prisma.question.findUnique.mockResolvedValue({
        id: 'q-1',
        content: 'Test question',
        knowledgePoints: '["kp-1"]',
        difficulty: 5,
        steps: [],
      });

      const result = await resumeSessionFlow('session-1');

      expect(result.session.status).toBe('active');
      expect(result.nextQuestion).not.toBeNull();
      expect(result.nextQuestion?.questionId).toBe('q-1');
    });
  });
});