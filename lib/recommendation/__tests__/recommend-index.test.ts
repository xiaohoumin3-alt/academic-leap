/**
 * Recommendation Engine Unit Tests
 *
 * Tests for recommendation functionality including:
 * - recommendNextQuestion main entry point
 * - recommendNextQuestions batch recommendation
 * - validateRecommendation validation helper
 * - Edge cases and error handling
 */

import {
  recommendNextQuestion,
  recommendNextQuestions,
  validateRecommendation,
  type RecommendationContext,
  type RecommendationResult,
  type RecommendationConfig,
} from '../index';
import type { Question } from '../types';

// Mock dependencies
jest.mock('../next-question', () => ({
  getNextQuestion: jest.fn(),
}));

jest.mock('../../prisma', () => ({
  prisma: {
    iRTStudentState: {
      findUnique: jest.fn(),
    },
    question: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { getNextQuestion } from '../next-question';
import { prisma } from '../../prisma';

const mockGetNextQuestion = getNextQuestion as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('recommendNextQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('should throw error when studentId is missing', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: '',
        recentPerformance: [
          {
            knowledgePoint: 'addition',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date(),
          },
        ],
      };

      // Act & Assert
      await expect(recommendNextQuestion(context)).rejects.toThrow(
        'studentId is required in RecommendationContext'
      );
    });

    it('should throw error when studentId is undefined', async () => {
      // Arrange
      const context = {
        studentId: undefined as unknown as string,
        recentPerformance: [],
      };

      // Act & Assert
      await expect(recommendNextQuestion(context)).rejects.toThrow(
        'studentId is required in RecommendationContext'
      );
    });
  });

  describe('new student handling', () => {
    it('should return baseline recommendation when recentPerformance is empty', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: [],
      };

      // Mock medium difficulty question found
      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'baseline-q1',
        knowledgePoints: 'general',
        difficulty: 5,
        content: 'What is 1 + 1?',
        answer: '2',
        hint: 'Count from 1',
      });

      // Act
      const result = await recommendNextQuestion(context);

      // Assert
      expect(result).toBeDefined();
      expect(result.question.id).toBe('baseline-q1');
      expect(result.confidence).toBe(0.5);
      expect(result.expectedDifficulty).toBe(5.0);
      expect(result.reason).toContain('Starting with a medium difficulty question');
    });

    it('should return baseline recommendation when recentPerformance is undefined', async () => {
      // Arrange
      const context = {
        studentId: 'new-student',
        recentPerformance: undefined as unknown as RecommendationContext['recentPerformance'],
      };

      // Mock medium difficulty question found
      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'baseline-q1',
        knowledgePoints: 'general',
        difficulty: 5,
        content: 'What is 1 + 1?',
        answer: '2',
        hint: 'Count from 1',
      });

      // Act
      const result = await recommendNextQuestion(context);

      // Assert
      expect(result).toBeDefined();
      expect(result.question.id).toBe('baseline-q1');
    });

    it('should use medium difficulty (4-6) for baseline recommendation', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: [],
      };

      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'baseline-q1',
        knowledgePoints: 'arithmetic',
        difficulty: 5,
        content: 'Sample question',
        answer: 'Answer',
        hint: 'Hint',
      });

      // Act
      await recommendNextQuestion(context);

      // Assert - verify the difficulty filter in the query
      expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            difficulty: {
              gte: 4,
              lte: 6,
            },
          }),
        })
      );
    });

    it('should use currentKnowledgePoint if provided in baseline', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        currentKnowledgePoint: 'multiplication',
        recentPerformance: [],
      };

      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'baseline-q1',
        knowledgePoints: 'multiplication',
        difficulty: 5,
        content: 'What is 3 x 4?',
        answer: '12',
        hint: 'Think of groups',
      });

      // Act
      const result = await recommendNextQuestion(context);

      // Assert
      expect(result.question.knowledgePoint).toBe('multiplication');
    });

    it('should fallback to any question when no medium difficulty available', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: [],
      };

      // First query with difficulty filter returns null
      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce(null);
      // Second query (fallback) returns any question
      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'fallback-q1',
        knowledgePoints: 'general',
        difficulty: 3,
        content: 'Fallback question',
        answer: 'Answer',
        hint: undefined,
      });

      // Act
      const result = await recommendNextQuestion(context);

      // Assert
      expect(result).toBeDefined();
      expect(result.question.id).toBe('fallback-q1');
      expect(result.question.knowledgePoint).toBe('baseline');
      expect(result.reason).toContain('Starting with a baseline question');
    });

    it('should throw error when no questions available at all', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: [],
      };

      // Both queries return null
      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(recommendNextQuestion(context)).rejects.toThrow(
        'No questions available in the database'
      );
    });

    it('should exclude specified question IDs from baseline recommendations', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: [],
        excludeQuestionIds: ['q-already-done', 'q-skip'],
      };

      (mockPrisma.question.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'baseline-q1',
        knowledgePoints: 'general',
        difficulty: 5,
        content: 'Question',
        answer: 'Answer',
        hint: 'Hint',
      });

      // Act
      await recommendNextQuestion(context);

      // Assert - verify exclusion in both queries
      expect(mockPrisma.question.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['q-already-done', 'q-skip'] },
          }),
        })
      );
    });
  });

  describe('existing student pipeline', () => {
    it('should use full pipeline when recentPerformance exists', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'existing-student',
        recentPerformance: [
          {
            knowledgePoint: 'addition',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date(),
          },
        ],
      };

      const expectedResult: RecommendationResult = {
        question: {
          id: 'q-pipeline-1',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Pipeline question',
            answer: 'Answer',
          },
        },
        reason: 'Recommended based on your progress',
        expectedDifficulty: 5.0,
        confidence: 0.85,
      };

      mockGetNextQuestion.mockResolvedValue(expectedResult);

      // Act
      const result = await recommendNextQuestion(context);

      // Assert
      expect(mockGetNextQuestion).toHaveBeenCalledWith(context, undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should pass config to pipeline', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'existing-student',
        recentPerformance: [
          {
            knowledgePoint: 'addition',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date(),
          },
        ],
      };

      const config: RecommendationConfig = {
        difficultyTolerance: 0.2,
        maxExplorationQuestions: 5,
      };

      const expectedResult: RecommendationResult = {
        question: {
          id: 'q-config-1',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Config question',
            answer: 'Answer',
          },
        },
        reason: 'With config',
        expectedDifficulty: 5.0,
        confidence: 0.8,
      };

      mockGetNextQuestion.mockResolvedValue(expectedResult);

      // Act
      const result = await recommendNextQuestion(context, config);

      // Assert
      expect(mockGetNextQuestion).toHaveBeenCalledWith(context, config);
      expect(result).toEqual(expectedResult);
    });

    it('should include currentKnowledgePoint in context', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'existing-student',
        currentKnowledgePoint: 'subtraction',
        recentPerformance: [
          {
            knowledgePoint: 'subtraction',
            isCorrect: false,
            timeSpent: 3000,
            timestamp: new Date(),
          },
        ],
      };

      mockGetNextQuestion.mockResolvedValue({
        question: {
          id: 'q-kp-1',
          knowledgePoint: 'subtraction',
          difficultyLevel: 4,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Subtraction focus',
        expectedDifficulty: 4.0,
        confidence: 0.7,
      });

      // Act
      await recommendNextQuestion(context);

      // Assert
      expect(mockGetNextQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          currentKnowledgePoint: 'subtraction',
        }),
        undefined
      );
    });

    it('should include learningGoal in context', async () => {
      // Arrange
      const context: RecommendationContext = {
        studentId: 'existing-student',
        learningGoal: 'Master algebra',
        recentPerformance: [
          {
            knowledgePoint: 'algebra',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date(),
          },
        ],
      };

      mockGetNextQuestion.mockResolvedValue({
        question: {
          id: 'q-goal-1',
          knowledgePoint: 'algebra',
          difficultyLevel: 6,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Aligned with goal',
        expectedDifficulty: 6.0,
        confidence: 0.9,
      });

      // Act
      await recommendNextQuestion(context);

      // Assert
      expect(mockGetNextQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          learningGoal: 'Master algebra',
        }),
        undefined
      );
    });
  });
});

describe('recommendNextQuestions (batch mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error in all tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return requested number of recommendations', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    let callCount = 0;
    mockGetNextQuestion.mockImplementation(async (ctx: RecommendationContext) => {
      callCount++;
      return {
        question: {
          id: `q-batch-${callCount}`,
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: `Question ${callCount}`,
            answer: 'Answer',
          },
        },
        reason: `Recommendation ${callCount}`,
        expectedDifficulty: 5.0,
        confidence: 0.8,
      };
    });

    // Act
    const results = await recommendNextQuestions(context, 3);

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0].question.id).toBe('q-batch-1');
    expect(results[1].question.id).toBe('q-batch-2');
    expect(results[2].question.id).toBe('q-batch-3');
  });

  it('should exclude previously recommended questions', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    const excludeCalls: string[][] = [];
    mockGetNextQuestion.mockImplementation(async (ctx: RecommendationContext) => {
      excludeCalls.push(ctx.excludeQuestionIds || []);
      return {
        question: {
          id: `q-exclude-${excludeCalls.length}`,
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Recommendation',
        expectedDifficulty: 5.0,
        confidence: 0.8,
      };
    });

    // Act
    await recommendNextQuestions(context, 3);

    // Assert
    expect(excludeCalls[0]).toHaveLength(0); // First call: no exclusions
    expect(excludeCalls[1]).toContain('q-exclude-1'); // Second call: excludes first
    expect(excludeCalls[2]).toContain('q-exclude-1');
    expect(excludeCalls[2]).toContain('q-exclude-2'); // Third call: excludes first two
  });

  it('should respect initial excludeQuestionIds', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
      excludeQuestionIds: ['already-done-1', 'already-done-2'],
    };

    mockGetNextQuestion.mockResolvedValue({
      question: {
        id: 'q-init-exclude',
        knowledgePoint: 'addition',
        difficultyLevel: 5,
        content: {
          question: 'Question',
          answer: 'Answer',
        },
      },
      reason: 'Recommendation',
      expectedDifficulty: 5.0,
      confidence: 0.8,
    });

    // Act
    await recommendNextQuestions(context, 2);

    // Assert
    expect(mockGetNextQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeQuestionIds: ['already-done-1', 'already-done-2'],
      }),
      undefined
    );
  });

  it('should stop on error and return partial results', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    let callCount = 0;
    mockGetNextQuestion.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Database error');
      }
      return {
        question: {
          id: `q-partial-${callCount}`,
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Recommendation',
        expectedDifficulty: 5.0,
        confidence: 0.8,
      };
    });

    // Act
    const results = await recommendNextQuestions(context, 5);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].question.id).toBe('q-partial-1');
  });

  it('should handle zero count request', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    // Act
    const results = await recommendNextQuestions(context, 0);

    // Assert
    expect(results).toHaveLength(0);
    expect(mockGetNextQuestion).not.toHaveBeenCalled();
  });

  it('should handle negative count request', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    // Act
    const results = await recommendNextQuestions(context, -5);

    // Assert
    expect(results).toHaveLength(0);
    expect(mockGetNextQuestion).not.toHaveBeenCalled();
  });

  it('should pass config to each recommendation', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'batch-student',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date(),
        },
      ],
    };

    const config: RecommendationConfig = {
      difficultyTolerance: 0.3,
    };

    mockGetNextQuestion.mockResolvedValue({
      question: {
        id: 'q-config-batch',
        knowledgePoint: 'addition',
        difficultyLevel: 5,
        content: {
          question: 'Question',
          answer: 'Answer',
        },
      },
      reason: 'Recommendation',
      expectedDifficulty: 5.0,
      confidence: 0.8,
    });

    // Act
    await recommendNextQuestions(context, 2, config);

    // Assert
    expect(mockGetNextQuestion).toHaveBeenCalledWith(
      expect.any(Object),
      config
    );
  });
});

describe('validateRecommendation', () => {
  describe('valid recommendations', () => {
    it('should return valid for complete recommendation', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q1',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'What is 2 + 2?',
            answer: '4',
            explanation: 'Count two plus two',
          },
        },
        reason: 'Good match for your level',
        expectedDifficulty: 5.0,
        confidence: 0.85,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return valid without explanation', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q2',
          knowledgePoint: 'addition',
          difficultyLevel: 3,
          content: {
            question: 'What is 1 + 1?',
            answer: '2',
            // No explanation
          },
        },
        reason: 'Easy question',
        expectedDifficulty: 3.0,
        confidence: 0.9,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return valid with minimum confidence (0)', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q3',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Zero confidence valid',
        expectedDifficulty: 5.0,
        confidence: 0,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
    });

    it('should return valid with maximum confidence (1)', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q4',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Full confidence valid',
        expectedDifficulty: 5.0,
        confidence: 1,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
    });

    it('should return valid with minimum expectedDifficulty (0)', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q5',
          knowledgePoint: 'addition',
          difficultyLevel: 0,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Minimum difficulty valid',
        expectedDifficulty: 0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
    });

    it('should return valid with maximum expectedDifficulty (10)', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'valid-q6',
          knowledgePoint: 'addition',
          difficultyLevel: 10,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Maximum difficulty valid',
        expectedDifficulty: 10,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(true);
    });
  });

  describe('invalid recommendations - question errors', () => {
    it('should return error when question is missing', () => {
      // Arrange
      const result = {
        question: null as unknown as Question,
        reason: 'No question',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing question in recommendation');
    });

    it('should return error when question id is missing', () => {
      // Arrange
      const result = {
        question: {
          id: '',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'No id',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Question missing id');
    });

    it('should return error when question content is missing', () => {
      // Arrange
      const result = {
        question: {
          id: 'q-no-content',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: '',
            answer: 'Answer',
          },
        },
        reason: 'No content',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Question missing content');
    });

    it('should return error when answer is missing', () => {
      // Arrange
      const result = {
        question: {
          id: 'q-no-answer',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: ''
          },
        },
        reason: 'No answer',
        expectedDifficulty: 5.0,
        confidence: 0.5
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Question missing answer');
    });

    it('should return multiple errors for multiple issues', () => {
      // Arrange
      const result = {
        question: {
          id: '',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: '',
            answer: '',
          },
        },
        reason: '',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThanOrEqual(3);
      expect(validation.errors).toContain('Question missing id');
      expect(validation.errors).toContain('Question missing content');
      expect(validation.errors).toContain('Question missing answer');
      expect(validation.errors).toContain('Missing recommendation reason');
    });
  });

  describe('invalid recommendations - confidence errors', () => {
    it('should return error when confidence is negative', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-neg-conf',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Negative confidence',
        expectedDifficulty: 5.0,
        confidence: -0.1,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid confidence: -0.1 (must be 0-1)');
    });

    it('should return error when confidence exceeds 1', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-over-conf',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Over confidence',
        expectedDifficulty: 5.0,
        confidence: 1.1,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid confidence: 1.1 (must be 0-1)');
    });
  });

  describe('invalid recommendations - expectedDifficulty errors', () => {
    it('should return error when expectedDifficulty is negative', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-neg-diff',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Negative difficulty',
        expectedDifficulty: -1,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid expectedDifficulty: -1 (must be 0-10)');
    });

    it('should return error when expectedDifficulty exceeds 10', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-over-diff',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: 'Over difficulty',
        expectedDifficulty: 11,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid expectedDifficulty: 11 (must be 0-10)');
    });
  });

  describe('invalid recommendations - reason errors', () => {
    it('should return error when reason is empty string', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-empty-reason',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: '',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing recommendation reason');
    });

    it('should return error when reason is only whitespace', () => {
      // Arrange
      const result: RecommendationResult = {
        question: {
          id: 'q-whitespace-reason',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: '   ',
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing recommendation reason');
    });

    it('should return error when reason is null', () => {
      // Arrange
      const result = {
        question: {
          id: 'q-null-reason',
          knowledgePoint: 'addition',
          difficultyLevel: 5,
          content: {
            question: 'Question',
            answer: 'Answer',
          },
        },
        reason: null as unknown as string,
        expectedDifficulty: 5.0,
        confidence: 0.5,
      };

      // Act
      const validation = validateRecommendation(result);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing recommendation reason');
    });
  });
});

describe('Type exports', () => {
  it('should export Question type', () => {
    // Verify the type is exported
    const question: Question = {
      id: 'test-q',
      knowledgePoint: 'test',
      difficultyLevel: 5,
      content: {
        question: 'Test question',
        answer: 'Test answer',
      },
    };

    expect(question.id).toBe('test-q');
  });

  it('should export RecommendationConfig type', () => {
    // Verify the type is exported
    const config: RecommendationConfig = {
      difficultyTolerance: 0.2,
      maxExplorationQuestions: 10,
      banditConfig: {
        bucketSize: 0.5,
        minDeltaC: 0,
        maxDeltaC: 10,
        priorAlpha: 1,
        priorBeta: 1,
      },
    };

    expect(config.difficultyTolerance).toBe(0.2);
    expect(config.banditConfig?.bucketSize).toBe(0.5);
  });
});
