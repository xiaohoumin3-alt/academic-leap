/**
 * Learning Flow Types Tests
 *
 * Tests type definitions and interface contracts.
 */

import {
  SessionStatus,
  SessionQuestion,
  LearningSession,
  CreateSessionOptions,
  SessionUpdateResult,
  NextQuestionResult,
  SubmitAnswerResult,
  SessionSummary,
} from '@/lib/learning-flow/types';

describe('Learning Flow Types', () => {
  describe('SessionStatus', () => {
    it('should be a union of valid status strings', () => {
      const statuses: SessionStatus[] = ['active', 'paused', 'completed'];

      statuses.forEach((status) => {
        expect(['active', 'paused', 'completed']).toContain(status);
      });
    });

    it('should only accept valid status values', () => {
      const validStatuses = ['active', 'paused', 'completed'] as const;

      validStatuses.forEach((status) => {
        const session: LearningSession = {
          id: 'test-id',
          studentId: 'student-1',
          status,
          currentQuestionIndex: 0,
          questions: [],
          startTime: new Date(),
          totalCorrect: 0,
          totalAnswered: 0,
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('SessionQuestion', () => {
    it('should accept valid session question with all fields', () => {
      const question: SessionQuestion = {
        questionId: 'q-1',
        knowledgePointId: 'kp-algebra',
        recommendedDifficulty: 5,
        actualDifficulty: 4.5,
        isCorrect: true,
        timeSpent: 30000,
        submittedAt: new Date(),
      };

      expect(question.questionId).toBe('q-1');
      expect(question.knowledgePointId).toBe('kp-algebra');
      expect(question.isCorrect).toBe(true);
    });

    it('should accept session question with minimal fields', () => {
      const question: SessionQuestion = {
        questionId: 'q-1',
        knowledgePointId: 'kp-algebra',
        recommendedDifficulty: 5,
      };

      expect(question.questionId).toBe('q-1');
      expect(question.isCorrect).toBeUndefined();
      expect(question.timeSpent).toBeUndefined();
    });

    it('should represent incorrect answer state', () => {
      const question: SessionQuestion = {
        questionId: 'q-2',
        knowledgePointId: 'kp-geometry',
        recommendedDifficulty: 3,
        isCorrect: false,
        timeSpent: 45000,
      };

      expect(question.isCorrect).toBe(false);
      expect(question.timeSpent).toBe(45000);
    });
  });

  describe('LearningSession', () => {
    it('should accept valid learning session', () => {
      const session: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      expect(session.id).toBe('session-1');
      expect(session.status).toBe('active');
      expect(session.currentQuestionIndex).toBe(0);
    });

    it('should accept session with all optional fields', () => {
      const now = new Date();
      const session: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 10,
        questions: [],
        startTime: now,
        endTime: new Date(now.getTime() + 600000),
        currentKnowledgePoint: 'kp-algebra',
        totalCorrect: 8,
        totalAnswered: 10,
      };

      expect(session.currentKnowledgePoint).toBe('kp-algebra');
      expect(session.totalCorrect).toBe(8);
      expect(session.totalAnswered).toBe(10);
    });

    it('should calculate accuracy from totalCorrect and totalAnswered', () => {
      const session: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'completed',
        currentQuestionIndex: 5,
        questions: [],
        startTime: new Date(),
        totalCorrect: 4,
        totalAnswered: 5,
      };

      const accuracy = session.totalAnswered > 0
        ? session.totalCorrect / session.totalAnswered
        : 0;
      expect(accuracy).toBe(0.8);
    });

    it('should handle zero totalAnswered', () => {
      const session: LearningSession = {
        id: 'session-1',
        studentId: 'student-1',
        status: 'active',
        currentQuestionIndex: 0,
        questions: [],
        startTime: new Date(),
        totalCorrect: 0,
        totalAnswered: 0,
      };

      const accuracy = session.totalAnswered > 0
        ? session.totalCorrect / session.totalAnswered
        : 0;
      expect(accuracy).toBe(0);
    });
  });

  describe('CreateSessionOptions', () => {
    it('should accept minimal options', () => {
      const options: CreateSessionOptions = {
        studentId: 'student-1',
      };

      expect(options.studentId).toBe('student-1');
      expect(options.knowledgePointId).toBeUndefined();
      expect(options.questionCount).toBeUndefined();
      expect(options.subject).toBeUndefined();
    });

    it('should accept full options', () => {
      const options: CreateSessionOptions = {
        studentId: 'student-1',
        knowledgePointId: 'kp-algebra',
        questionCount: 20,
        subject: 'math',
      };

      expect(options.questionCount).toBe(20);
      expect(options.subject).toBe('math');
    });
  });

  describe('NextQuestionResult', () => {
    it('should accept valid question result', () => {
      const result: NextQuestionResult = {
        questionId: 'q-1',
        content: {
          question: 'What is 2 + 2?',
          hint: 'Think of adding',
          inputType: 'number',
          keyboard: 'numeric',
        },
        knowledgePointId: 'kp-arithmetic',
        recommendedDifficulty: 3,
        reason: 'Recommended based on student performance',
        sessionIndex: 0,
      };

      expect(result.questionId).toBe('q-1');
      expect(result.content.question).toBe('What is 2 + 2?');
      expect(result.recommendedDifficulty).toBe(3);
      expect(result.sessionIndex).toBe(0);
    });

    it('should accept result without optional content fields', () => {
      const result: NextQuestionResult = {
        questionId: 'q-1',
        content: {
          question: 'Solve for x',
        },
        knowledgePointId: 'kp-algebra',
        recommendedDifficulty: 5,
        reason: 'Increasing difficulty',
        sessionIndex: 3,
      };

      expect(result.content.hint).toBeUndefined();
      expect(result.content.inputType).toBeUndefined();
    });
  });

  describe('SubmitAnswerResult', () => {
    it('should accept correct answer result', () => {
      const result: SubmitAnswerResult = {
        isCorrect: true,
        correctAnswer: '4',
        explanation: '2 + 2 = 4',
        performance: {
          streak: 3,
          sessionAccuracy: 0.85,
        },
        nextQuestionAvailable: true,
      };

      expect(result.isCorrect).toBe(true);
      expect(result.performance.streak).toBe(3);
      expect(result.nextQuestionAvailable).toBe(true);
    });

    it('should accept incorrect answer result', () => {
      const result: SubmitAnswerResult = {
        isCorrect: false,
        correctAnswer: '7',
        performance: {
          streak: 0,
          sessionAccuracy: 0.6,
        },
        nextQuestionAvailable: true,
      };

      expect(result.isCorrect).toBe(false);
      expect(result.performance.streak).toBe(0);
    });
  });

  describe('SessionSummary', () => {
    it('should accept valid session summary', () => {
      const now = new Date();
      const summary: SessionSummary = {
        sessionId: 'session-1',
        studentId: 'student-1',
        duration: 600,
        totalQuestions: 20,
        correctAnswers: 16,
        accuracy: 0.8,
        knowledgePointsPracticed: ['kp-1', 'kp-2', 'kp-3'],
        startTime: now,
        endTime: new Date(now.getTime() + 600000),
      };

      expect(summary.accuracy).toBe(0.8);
      expect(summary.knowledgePointsPracticed).toHaveLength(3);
    });

    it('should calculate duration correctly', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:10:00Z');
      const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      expect(duration).toBe(600); // 10 minutes in seconds
    });
  });
});