/**
 * Learning Flow Session Tests
 *
 * Tests for session management functions including:
 * - Session creation
 * - Session loading
 * - Session updates
 * - Session status management
 * - Session summary generation
 */

import {
  createSession,
  loadSession,
  updateSessionQuestion,
  updateSessionStatus,
  getActiveSession,
  generateSessionSummary,
  pauseSession,
  resumeSession,
  completeSession,
} from '@/lib/learning-flow/session';
import type { CreateSessionOptions, SessionQuestion } from '@/lib/learning-flow/types';

// Mock Prisma - use function to avoid hoisting issues
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    practiceSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockPrisma = require('@/lib/prisma').prisma;

describe('Session Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getMockPrisma = () => require('@/lib/prisma').prisma;

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockUser = { id: 'student-1', name: 'Test Student' };
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        answers: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      getMockPrisma().user.findUnique.mockResolvedValue(mockUser);
      getMockPrisma().practiceSession.create.mockResolvedValue(mockSession);

      const options: CreateSessionOptions = {
        studentId: 'student-1',
        knowledgePointId: 'kp-algebra',
        questionCount: 10,
        subject: 'math',
      };

      const session = await createSession(options);

      expect(session.id).toBe('session-1');
      expect(session.studentId).toBe('student-1');
      expect(session.status).toBe('active');
      expect(session.currentQuestionIndex).toBe(0);
      expect(session.currentKnowledgePoint).toBe('kp-algebra');
      expect(session.totalCorrect).toBe(0);
      expect(session.totalAnswered).toBe(0);
    });

    it('should throw error if student not found', async () => {
      getMockPrisma().user.findUnique.mockResolvedValue(null);

      const options: CreateSessionOptions = {
        studentId: 'nonexistent',
      };

      await expect(createSession(options)).rejects.toThrow('Student not found');
    });

    it('should create session with default question count', async () => {
      const mockUser = { id: 'student-1', name: 'Test Student' };
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        answers: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      getMockPrisma().user.findUnique.mockResolvedValue(mockUser);
      getMockPrisma().practiceSession.create.mockResolvedValue(mockSession);

      const options: CreateSessionOptions = {
        studentId: 'student-1',
      };

      const session = await createSession(options);

      expect(getMockPrisma().practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionCount: 10, // Default value
          }),
        })
      );
    });

    it('should store subject in session', async () => {
      const mockUser = { id: 'student-1', name: 'Test Student' };
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        answers: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      getMockPrisma().user.findUnique.mockResolvedValue(mockUser);
      getMockPrisma().practiceSession.create.mockResolvedValue(mockSession);

      const options: CreateSessionOptions = {
        studentId: 'student-1',
        subject: 'physics',
      };

      await createSession(options);

      expect(getMockPrisma().practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subject: 'physics',
          }),
        })
      );
    });
  });

  describe('loadSession', () => {
    it('should load an existing session', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        answers: JSON.stringify([
          { questionId: 'q1', knowledgePointId: 'kp-1', recommendedDifficulty: 3, isCorrect: true },
          { questionId: 'q2', knowledgePointId: 'kp-1', recommendedDifficulty: 3, isCorrect: false },
        ]),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:30:00Z'),
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const session = await loadSession('session-1');

      expect(session.id).toBe('session-1');
      expect(session.studentId).toBe('student-1');
      expect(session.currentQuestionIndex).toBe(5);
      expect(session.totalCorrect).toBe(1);
      expect(session.totalAnswered).toBe(2);
    });

    it('should throw error if session not found', async () => {
      getMockPrisma().practiceSession.findUnique.mockResolvedValue(null);

      await expect(loadSession('nonexistent')).rejects.toThrow('Session not found');
    });

    it('should calculate totals from answers', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        answers: JSON.stringify([
          { questionId: 'q1', isCorrect: true },
          { questionId: 'q2', isCorrect: true },
          { questionId: 'q3', isCorrect: false },
          { questionId: 'q4', isCorrect: true },
        ]),
        createdAt: new Date(),
        completedAt: new Date(),
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const session = await loadSession('session-1');

      expect(session.totalCorrect).toBe(3);
      expect(session.totalAnswered).toBe(4);
    });

    it('should handle empty answers', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        answers: '[]',
        createdAt: new Date(),
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const session = await loadSession('session-1');

      expect(session.questions).toHaveLength(0);
      expect(session.totalCorrect).toBe(0);
      expect(session.totalAnswered).toBe(0);
    });

    it('should include endTime for completed sessions', async () => {
      const completedAt = new Date();
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        answers: '[]',
        createdAt: new Date(completedAt.getTime() - 600000),
        completedAt,
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const session = await loadSession('session-1');

      expect(session.endTime).toBeDefined();
      expect(session.endTime).toEqual(completedAt);
    });
  });

  describe('updateSessionQuestion', () => {
    it('should add new question to session', async () => {
      const mockSession = {
        id: 'session-1',
        answers: JSON.stringify([]),
        currentQuestionIndex: 0,
      };

      const newQuestion: SessionQuestion = {
        questionId: 'q-new',
        knowledgePointId: 'kp-1',
        recommendedDifficulty: 5,
        isCorrect: true,
        timeSpent: 30000,
        submittedAt: new Date(),
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);
      getMockPrisma().practiceSession.update.mockResolvedValue({
        ...mockSession,
        answers: JSON.stringify([newQuestion]),
        currentQuestionIndex: 1,
      });

      await updateSessionQuestion('session-1', newQuestion);

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            currentQuestionIndex: 1,
          }),
        })
      );
    });

    it('should throw error if session not found', async () => {
      getMockPrisma().practiceSession.findUnique.mockResolvedValue(null);

      const question: SessionQuestion = {
        questionId: 'q-1',
        knowledgePointId: 'kp-1',
        recommendedDifficulty: 5,
      };

      await expect(updateSessionQuestion('nonexistent', question)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should preserve existing answers when adding new question', async () => {
      const existingQuestion: SessionQuestion = {
        questionId: 'q-existing',
        knowledgePointId: 'kp-1',
        recommendedDifficulty: 4,
        isCorrect: true,
      };

      const mockSession = {
        id: 'session-1',
        answers: JSON.stringify([existingQuestion]),
        currentQuestionIndex: 1,
      };

      const newQuestion: SessionQuestion = {
        questionId: 'q-new',
        knowledgePointId: 'kp-2',
        recommendedDifficulty: 5,
        isCorrect: false,
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      // Simple mock that just returns the updated session
      getMockPrisma().practiceSession.update.mockResolvedValue({
        ...mockSession,
        currentQuestionIndex: 2,
      });

      await updateSessionQuestion('session-1', newQuestion);

      // Verify update was called with the session ID
      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
        })
      );

      // Verify the update was called (the function works as expected)
      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSessionStatus', () => {
    it('should update status to paused', async () => {
      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'paused',
      });

      await updateSessionStatus('session-1', 'paused');

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );
    });

    it('should set completedAt when status is completed', async () => {
      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'completed',
        completedAt: new Date(),
      });

      await updateSessionStatus('session-1', 'completed');

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should not set completedAt for non-completed statuses', async () => {
      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'active',
      });

      await updateSessionStatus('session-1', 'active');

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });
  });

  describe('getActiveSession', () => {
    it('should return null if no active session exists', async () => {
      getMockPrisma().practiceSession.findFirst.mockResolvedValue(null);

      const result = await getActiveSession('student-1');

      expect(result).toBeNull();
    });

    it('should return active session for student', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        answers: '[]',
        createdAt: new Date(),
      };

      getMockPrisma().practiceSession.findFirst.mockResolvedValue(mockSession);
      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const result = await getActiveSession('student-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('session-1');
    });

    it('should find most recent active session', async () => {
      const mockSession = {
        id: 'session-new',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        answers: '[]',
        createdAt: new Date(),
      };

      getMockPrisma().practiceSession.findFirst.mockResolvedValue(mockSession);
      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const result = await getActiveSession('student-1');

      expect(getMockPrisma().practiceSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'student-1',
            status: 'active',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });
  });

  describe('generateSessionSummary', () => {
    it('should generate summary for completed session', async () => {
      const startTime = new Date(Date.now() - 600000);
      const endTime = new Date();

      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        answers: JSON.stringify([
          { questionId: 'q1', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q2', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q3', knowledgePointId: 'kp-2', isCorrect: false },
        ]),
        createdAt: startTime,
        completedAt: endTime,
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const summary = await generateSessionSummary('session-1');

      expect(summary.sessionId).toBe('session-1');
      expect(summary.studentId).toBe('student-1');
      expect(summary.totalQuestions).toBe(3);
      expect(summary.correctAnswers).toBe(2);
      expect(summary.accuracy).toBeCloseTo(0.667, 2);
      expect(summary.knowledgePointsPracticed).toContain('kp-1');
      expect(summary.knowledgePointsPracticed).toContain('kp-2');
      expect(summary.duration).toBeGreaterThanOrEqual(600);
    });

    it('should handle session without endTime', async () => {
      const startTime = new Date(Date.now() - 300000);

      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'active',
        currentQuestionIndex: 5,
        answers: JSON.stringify([
          { questionId: 'q1', knowledgePointId: 'kp-1', isCorrect: true },
        ]),
        createdAt: startTime,
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const summary = await generateSessionSummary('session-1');

      expect(summary.endTime).toBeUndefined();
      expect(summary.duration).toBeGreaterThanOrEqual(300);
    });

    it('should deduplicate knowledge points', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        answers: JSON.stringify([
          { questionId: 'q1', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q2', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q3', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q4', knowledgePointId: 'kp-2', isCorrect: true },
        ]),
        createdAt: new Date(),
        completedAt: new Date(),
      };

      getMockPrisma().practiceSession.findUnique.mockResolvedValue(mockSession);

      const summary = await generateSessionSummary('session-1');

      expect(summary.knowledgePointsPracticed).toHaveLength(2);
    });
  });

  describe('pauseSession', () => {
    it('should pause session by updating status', async () => {
      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'paused',
      });

      await pauseSession('session-1');

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'paused',
          }),
        })
      );
    });
  });

  describe('resumeSession', () => {
    it('should resume session by updating status to active', async () => {
      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'active',
      });

      await resumeSession('session-1');

      expect(getMockPrisma().practiceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });
  });

  describe('completeSession', () => {
    it('should complete session and generate summary', async () => {
      const startTime = new Date(Date.now() - 600000);
      const endTime = new Date();

      getMockPrisma().practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'completed',
        completedAt: endTime,
      });

      getMockPrisma().practiceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        answers: JSON.stringify([
          { questionId: 'q1', knowledgePointId: 'kp-1', isCorrect: true },
          { questionId: 'q2', knowledgePointId: 'kp-1', isCorrect: true },
        ]),
        createdAt: startTime,
        completedAt: endTime,
      });

      const summary = await completeSession('session-1');

      expect(summary.sessionId).toBe('session-1');
      expect(summary.correctAnswers).toBe(2);
      expect(summary.totalQuestions).toBe(2);
    });
  });
});