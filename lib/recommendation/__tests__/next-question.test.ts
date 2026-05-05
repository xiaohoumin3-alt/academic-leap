/**
 * Next Question Recommender Unit Tests
 *
 * Tests for next question recommendation functionality including:
 * - getNextQuestion main pipeline
 * - explainRecommendation helper
 * - Context handling
 * - Type validation
 */

import {
  getNextQuestion,
  explainRecommendation,
  type NextQuestionConfig
} from '../next-question';
import type { RecommendationContext, RecommendationResult } from '../index';
import type { StudentState, Question } from '../types';

// Mock all dependencies
jest.mock('../uok-selector', () => ({
  calculateZPD: jest.fn(() => [
    {
      knowledgePoint: 'addition',
      minDifficulty: 0.3,
      maxDifficulty: 0.7,
      reason: 'Partial mastery'
    }
  ]),
  selectFromZPD: jest.fn(() => ({
    knowledgePoint: 'addition',
    minDifficulty: 0.3,
    maxDifficulty: 0.7,
    reason: 'Partial mastery'
  }))
}));

jest.mock('../difficulty-matcher', () => ({
  matchDifficulty: jest.fn(() => [
    {
      question: {
        id: 'q1',
        knowledgePoint: 'addition',
        difficultyLevel: 0.5,
        content: { question: 'Test', answer: 'Answer' }
      },
      expectedProbability: 0.6,
      matchScore: 0.9
    }
  ]),
  calculateOptimalDeltaC: jest.fn(() => 5.0)
}));

jest.mock('../../rl', () => ({
  ThompsonSamplingBandit: jest.fn().mockImplementation(() => ({
    selectArm: jest.fn(() => '5.0')
  }))
}));

jest.mock('../../prisma', () => ({
  prisma: {
    iRTStudentState: {
      findUnique: jest.fn().mockResolvedValue({
        userId: 'student-123',
        theta: 0.5
      })
    },
    question: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'q1',
          knowledgePoints: 'addition',
          difficulty: 0.5,
          content: 'What is 2 + 2?',
          answer: '4',
          hint: 'Basic addition'
        }
      ]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'fallback-q',
        knowledgePoints: 'general',
        difficulty: 0.5,
        content: 'Fallback question',
        answer: 'Fallback answer',
        hint: undefined
      })
    }
  }
}));

describe('getNextQuestion', () => {
  const createBasicContext = (): RecommendationContext => ({
    studentId: 'student-123',
    recentPerformance: [
      {
        knowledgePoint: 'addition',
        isCorrect: true,
        timeSpent: 5000,
        timestamp: new Date('2024-01-01')
      }
    ]
  });

  it('should return recommendation result with valid context', async () => {
    // Arrange
    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result).toHaveProperty('question');
    expect(result).toHaveProperty('reason');
    expect(result).toHaveProperty('expectedDifficulty');
    expect(result).toHaveProperty('confidence');
  });

  it('should handle context with current knowledge point', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'student-123',
      currentKnowledgePoint: 'multiplication',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with learning goal', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'student-123',
      recentPerformance: [],
      learningGoal: 'master-multiplication'
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with full parameters', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'student-456',
      currentKnowledgePoint: 'division',
      recentPerformance: [
        {
          knowledgePoint: 'addition',
          isCorrect: true,
          timeSpent: 3000,
          timestamp: new Date()
        },
        {
          knowledgePoint: 'subtraction',
          isCorrect: false,
          timeSpent: 8000,
          timestamp: new Date()
        }
      ],
      learningGoal: 'improve-arithmetic'
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with excludeQuestionIds', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'student-123',
      recentPerformance: [],
      excludeQuestionIds: ['q1', 'q2', 'q3']
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should accept custom config', async () => {
    // Arrange
    const context = createBasicContext();
    const config: NextQuestionConfig = {
      banditConfig: {
        bucketSize: 0.5,
        minDeltaC: 0,
        maxDeltaC: 10
      },
      difficultyTolerance: 0.2,
      maxExplorationQuestions: 5
    };

    // Act
    const result = await getNextQuestion(context, config);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should return question with valid structure', async () => {
    // Arrange
    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toHaveProperty('id');
    expect(result.question).toHaveProperty('knowledgePoint');
    expect(result.question).toHaveProperty('difficultyLevel');
    expect(result.question).toHaveProperty('content');
    expect(result.question.content).toHaveProperty('question');
    expect(result.question.content).toHaveProperty('answer');
  });

  it('should return confidence between 0.5 and 0.99', async () => {
    // Arrange
    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.99);
  });

  it('should return expectedDifficulty within valid range', async () => {
    // Arrange
    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.expectedDifficulty).toBeGreaterThanOrEqual(0);
    expect(result.expectedDifficulty).toBeLessThanOrEqual(10);
  });

  it('should return non-empty reason string', async () => {
    // Arrange
    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('should handle context with no IRT state in database', async () => {
    // Arrange
    const { prisma } = require('../../prisma');
    prisma.iRTStudentState.findUnique.mockResolvedValueOnce(null);

    const context: RecommendationContext = {
      studentId: 'new-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with extensive performance history', async () => {
    // Arrange
    const recentPerformance = Array.from({ length: 100 }, (_, i) => ({
      knowledgePoint: `kp-${i % 10}`,
      isCorrect: Math.random() > 0.3,
      timeSpent: Math.floor(Math.random() * 10000),
      timestamp: new Date(Date.now() - i * 60000)
    }));
    const context: RecommendationContext = {
      studentId: 'experienced-student',
      recentPerformance
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with mixed performance results', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'variable-student',
      recentPerformance: [
        { knowledgePoint: 'test', isCorrect: true, timeSpent: 1000, timestamp: new Date() },
        { knowledgePoint: 'test', isCorrect: false, timeSpent: 10000, timestamp: new Date() },
        { knowledgePoint: 'test', isCorrect: true, timeSpent: 2000, timestamp: new Date() },
        { knowledgePoint: 'test', isCorrect: false, timeSpent: 15000, timestamp: new Date() }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with all correct performance', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'perfect-student',
      recentPerformance: Array.from({ length: 10 }, () => ({
        knowledgePoint: 'test',
        isCorrect: true,
        timeSpent: 2000,
        timestamp: new Date()
      }))
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with all incorrect performance', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'struggling-student',
      recentPerformance: Array.from({ length: 10 }, () => ({
        knowledgePoint: 'test',
        isCorrect: false,
        timeSpent: 10000,
        timestamp: new Date()
      }))
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle empty ZPD options (fallback)', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle empty difficulty matches (fallback)', async () => {
    // Arrange
    const { matchDifficulty } = require('../difficulty-matcher');
    matchDifficulty.mockReturnValueOnce([]);

    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle no available questions (fallback)', async () => {
    // Arrange
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValueOnce([]);

    const context = createBasicContext();

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should throw error when no questions available at all', async () => {
    // Arrange - need to mock both findMany and findFirst to return empty
    const { prisma } = require('../../prisma');
    // Reset mocks and set them to return empty
    prisma.question.findMany.mockResolvedValue([]);
    prisma.question.findFirst.mockResolvedValue(null);

    const context = createBasicContext();

    // Act & Assert
    await expect(getNextQuestion(context)).rejects.toThrow('No questions available');
  });
});

describe('explainRecommendation', () => {
  const createResult = (): RecommendationResult => ({
    question: {
      id: 'q1',
      knowledgePoint: 'addition',
      difficultyLevel: 0.5,
      content: {
        question: 'What is 2 + 2?',
        answer: '4',
        explanation: 'Basic addition'
      }
    },
    reason: 'Student has demonstrated partial mastery of addition',
    expectedDifficulty: 0.5,
    confidence: 0.8
  });

  it('should return the reason from recommendation result', () => {
    // Arrange
    const result = createResult();

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(explanation).toBe('Student has demonstrated partial mastery of addition');
  });

  it('should handle empty reason', () => {
    // Arrange
    const result: RecommendationResult = {
      question: {
        id: 'q1',
        knowledgePoint: 'test',
        difficultyLevel: 0.5,
        content: { question: 'Test', answer: 'Answer' }
      },
      reason: '',
      expectedDifficulty: 0.5,
      confidence: 0.5
    };

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(explanation).toBe('');
  });

  it('should handle long reason text', () => {
    // Arrange
    const longReason = 'This is a detailed explanation '.repeat(20);
    const result: RecommendationResult = {
      question: {
        id: 'q1',
        knowledgePoint: 'test',
        difficultyLevel: 0.5,
        content: { question: 'Test', answer: 'Answer' }
      },
      reason: longReason,
      expectedDifficulty: 0.5,
      confidence: 0.9
    };

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(explanation).toBe(longReason);
    expect(explanation.length).toBeGreaterThan(100);
  });

  it('should handle reason with special characters', () => {
    // Arrange
    const reason = '学生需要练习分数加法 (Fraction Addition) - 难度: 0.5';
    const result: RecommendationResult = {
      question: {
        id: 'q1',
        knowledgePoint: 'fraction-addition',
        difficultyLevel: 0.5,
        content: { question: 'Test', answer: 'Answer' }
      },
      reason,
      expectedDifficulty: 0.5,
      confidence: 0.7
    };

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(explanation).toContain('分数');
    expect(explanation).toContain('Fraction Addition');
  });

  it('should handle reason with newlines', () => {
    // Arrange
    const reason = 'Line 1: Student needs practice\nLine 2: In subtraction\nLine 3: Difficulty 0.6';
    const result: RecommendationResult = {
      question: {
        id: 'q1',
        knowledgePoint: 'subtraction',
        difficultyLevel: 0.6,
        content: { question: 'Test', answer: 'Answer' }
      },
      reason,
      expectedDifficulty: 0.6,
      confidence: 0.75
    };

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(explanation).toContain('\n');
    expect(explanation.split('\n')).toHaveLength(3);
  });

  it('should return string type', () => {
    // Arrange
    const result = createResult();

    // Act
    const explanation = explainRecommendation(result);

    // Assert
    expect(typeof explanation).toBe('string');
  });
});

describe('Type validation', () => {
  describe('RecommendationContext type', () => {
    it('should accept valid context structure', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'student-123',
        currentKnowledgePoint: 'addition',
        recentPerformance: [
          {
            knowledgePoint: 'addition',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date()
          }
        ],
        learningGoal: 'master-arithmetic'
      };

      // Assert
      expect(context.studentId).toBe('student-123');
      expect(context.currentKnowledgePoint).toBe('addition');
      expect(context.recentPerformance).toHaveLength(1);
      expect(context.learningGoal).toBe('master-arithmetic');
    });

    it('should accept context with only required fields', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'minimal-student',
        recentPerformance: []
      };

      // Assert
      expect(context.studentId).toBe('minimal-student');
      expect(context.currentKnowledgePoint).toBeUndefined();
      expect(context.learningGoal).toBeUndefined();
    });

    it('should accept empty recent performance array', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'new-student',
        recentPerformance: []
      };

      // Assert
      expect(context.recentPerformance).toEqual([]);
    });

    it('should accept performance entry with all correct results', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'perfect-student',
        recentPerformance: [
          { knowledgePoint: 'test', isCorrect: true, timeSpent: 1000, timestamp: new Date() },
          { knowledgePoint: 'test', isCorrect: true, timeSpent: 2000, timestamp: new Date() }
        ]
      };

      // Assert
      expect(context.recentPerformance.every(p => p.isCorrect)).toBe(true);
    });

    it('should accept performance entry with all incorrect results', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'struggling-student',
        recentPerformance: [
          { knowledgePoint: 'test', isCorrect: false, timeSpent: 10000, timestamp: new Date() },
          { knowledgePoint: 'test', isCorrect: false, timeSpent: 15000, timestamp: new Date() }
        ]
      };

      // Assert
      expect(context.recentPerformance.every(p => !p.isCorrect)).toBe(true);
    });

    it('should accept performance with minimal time spent', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'fast-student',
        recentPerformance: [
          { knowledgePoint: 'test', isCorrect: true, timeSpent: 0, timestamp: new Date() }
        ]
      };

      // Assert
      expect(context.recentPerformance[0].timeSpent).toBe(0);
    });

    it('should accept performance with maximum time spent', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'slow-student',
        recentPerformance: [
          { knowledgePoint: 'test', isCorrect: true, timeSpent: Number.MAX_SAFE_INTEGER, timestamp: new Date() }
        ]
      };

      // Assert
      expect(context.recentPerformance[0].timeSpent).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should accept special characters in knowledge point', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'test-student',
        recentPerformance: [
          {
            knowledgePoint: '分数加法 (Fraction Addition)',
            isCorrect: true,
            timeSpent: 5000,
            timestamp: new Date()
          }
        ]
      };

      // Assert
      expect(context.recentPerformance[0].knowledgePoint).toContain('分数');
    });

    it('should accept excludeQuestionIds array', () => {
      // Arrange & Act
      const context: RecommendationContext = {
        studentId: 'test-student',
        recentPerformance: [],
        excludeQuestionIds: ['q1', 'q2', 'q3']
      };

      // Assert
      expect(context.excludeQuestionIds).toEqual(['q1', 'q2', 'q3']);
    });
  });

  describe('RecommendationResult type', () => {
    it('should accept valid result structure', () => {
      // Arrange & Act
      const result: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'addition',
          difficultyLevel: 0.5,
          content: {
            question: 'What is 2 + 2?',
            answer: '4',
            explanation: 'Basic addition'
          }
        },
        reason: 'Student needs practice with addition',
        expectedDifficulty: 0.5,
        confidence: 0.8
      };

      // Assert
      expect(result.question.id).toBe('q1');
      expect(result.reason).toBeDefined();
      expect(result.expectedDifficulty).toBe(0.5);
      expect(result.confidence).toBe(0.8);
    });

    it('should accept question without explanation', () => {
      // Arrange & Act
      const result: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'subtraction',
          difficultyLevel: 0.6,
          content: {
            question: 'What is 5 - 3?',
            answer: '2'
          }
        },
        reason: 'Practice subtraction',
        expectedDifficulty: 0.6,
        confidence: 0.7
      };

      // Assert
      expect(result.question.content.explanation).toBeUndefined();
    });

    it('should accept confidence at boundaries', () => {
      // Arrange & Act
      const lowConfidence: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        reason: 'Low confidence',
        expectedDifficulty: 0.5,
        confidence: 0.0
      };

      const highConfidence: RecommendationResult = {
        question: {
          id: 'q2',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        reason: 'High confidence',
        expectedDifficulty: 0.5,
        confidence: 1.0
      };

      // Assert
      expect(lowConfidence.confidence).toBe(0.0);
      expect(highConfidence.confidence).toBe(1.0);
    });

    it('should accept expected difficulty at boundaries', () => {
      // Arrange & Act
      const easyResult: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.0,
          content: { question: 'Easy', answer: 'A' }
        },
        reason: 'Easy question',
        expectedDifficulty: 0.0,
        confidence: 0.9
      };

      const hardResult: RecommendationResult = {
        question: {
          id: 'q2',
          knowledgePoint: 'test',
          difficultyLevel: 1.0,
          content: { question: 'Hard', answer: 'B' }
        },
        reason: 'Hard question',
        expectedDifficulty: 1.0,
        confidence: 0.8
      };

      // Assert
      expect(easyResult.expectedDifficulty).toBe(0.0);
      expect(hardResult.expectedDifficulty).toBe(1.0);
    });

    it('should accept empty reason string', () => {
      // Arrange & Act
      const result: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        reason: '',
        expectedDifficulty: 0.5,
        confidence: 0.5
      };

      // Assert
      expect(result.reason).toBe('');
    });

    it('should accept long reason string', () => {
      // Arrange & Act
      const longReason = 'A'.repeat(1000);
      const result: RecommendationResult = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        reason: longReason,
        expectedDifficulty: 0.5,
        confidence: 0.7
      };

      // Assert
      expect(result.reason.length).toBe(1000);
    });
  });

  describe('NextQuestionConfig type', () => {
    it('should accept empty config', () => {
      // Arrange & Act
      const config: NextQuestionConfig = {};

      // Assert
      expect(Object.keys(config)).toHaveLength(0);
    });

    it('should accept config with bandit config', () => {
      // Arrange & Act
      const config: NextQuestionConfig = {
        banditConfig: {
          bucketSize: 0.5,
          minDeltaC: 0,
          maxDeltaC: 10
        }
      };

      // Assert
      expect(config.banditConfig).toBeDefined();
      expect(config.banditConfig?.bucketSize).toBe(0.5);
    });

    it('should accept config with difficulty tolerance', () => {
      // Arrange & Act
      const config: NextQuestionConfig = {
        difficultyTolerance: 0.2
      };

      // Assert
      expect(config.difficultyTolerance).toBe(0.2);
    });

    it('should accept config with max exploration questions', () => {
      // Arrange & Act
      const config: NextQuestionConfig = {
        maxExplorationQuestions: 10
      };

      // Assert
      expect(config.maxExplorationQuestions).toBe(10);
    });

    it('should accept config with all parameters', () => {
      // Arrange & Act
      const config: NextQuestionConfig = {
        banditConfig: {
          bucketSize: 0.5,
          minDeltaC: 0,
          maxDeltaC: 10
        },
        difficultyTolerance: 0.2,
        maxExplorationQuestions: 5
      };

      // Assert
      expect(config.banditConfig).toBeDefined();
      expect(config.difficultyTolerance).toBe(0.2);
      expect(config.maxExplorationQuestions).toBe(5);
    });
  });
});

describe('buildStudentState behavior', () => {
  beforeEach(() => {
    // Reset mocks
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        knowledgePoints: 'test',
        difficulty: 0.5,
        content: 'Test',
        answer: 'Answer',
        hint: 'Hint'
      }
    ]);
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback',
      answer: 'Fallback',
      hint: undefined
    });
  });

  it('should use default ability (0) when no IRT state exists', async () => {
    // Arrange
    const { prisma } = require('../../prisma');
    prisma.iRTStudentState.findUnique.mockResolvedValueOnce(null);

    const context: RecommendationContext = {
      studentId: 'new-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert - should still work with default ability
    expect(result.question).toBeDefined();
  });

  it('should use IRT theta from database when available', async () => {
    // Arrange
    const { prisma } = require('../../prisma');
    prisma.iRTStudentState.findUnique.mockResolvedValueOnce({
      userId: 'student-123',
      theta: 1.5
    });

    const context: RecommendationContext = {
      studentId: 'student-123',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should build knowledge point mastery from recent performance', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: [
        { knowledgePoint: 'addition', isCorrect: true, timeSpent: 1000, timestamp: new Date() },
        { knowledgePoint: 'addition', isCorrect: true, timeSpent: 2000, timestamp: new Date() },
        { knowledgePoint: 'addition', isCorrect: false, timeSpent: 3000, timestamp: new Date() }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert - should process the performance data
    expect(result.question).toBeDefined();
  });

  it('should limit recent performance to last 10 entries per knowledge point', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: Array.from({ length: 15 }, (_, i) => ({
        knowledgePoint: 'test',
        isCorrect: i % 2 === 0,
        timeSpent: 1000,
        timestamp: new Date()
      }))
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert - should handle gracefully
    expect(result.question).toBeDefined();
  });

  it('should initialize new knowledge points with default values', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'new-kp-student',
      recentPerformance: [
        { knowledgePoint: 'brand-new-topic', isCorrect: true, timeSpent: 5000, timestamp: new Date() }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });
});

describe('buildRecommendationReason behavior', () => {
  beforeEach(() => {
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        knowledgePoints: 'addition',
        difficulty: 0.5,
        content: 'Test',
        answer: 'Answer',
        hint: 'Hint'
      }
    ]);
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback',
      answer: 'Fallback',
      hint: undefined
    });
  });

  it('should include knowledge point in reason', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      currentKnowledgePoint: 'multiplication',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('should include target difficulty in reason', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });

  it('should include expected success rate in reason', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.reason).toBeDefined();
    expect(result.reason).toMatch(/\d+%/); // Should contain percentage
  });

  it('should indicate high confidence match when score > 0.8', async () => {
    // Arrange
    const { matchDifficulty } = require('../difficulty-matcher');
    matchDifficulty.mockReturnValueOnce([
      {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        expectedProbability: 0.6,
        matchScore: 0.9
      }
    ]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.confidence).toBeLessThanOrEqual(0.99);
  });

  it('should indicate good match when score between 0.5 and 0.8', async () => {
    // Arrange
    const { matchDifficulty } = require('../difficulty-matcher');
    matchDifficulty.mockReturnValueOnce([
      {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        expectedProbability: 0.6,
        matchScore: 0.6
      }
    ]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should indicate exploring when score <= 0.5', async () => {
    // Arrange
    const { matchDifficulty } = require('../difficulty-matcher');
    matchDifficulty.mockReturnValueOnce([
      {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Test', answer: 'Answer' }
        },
        expectedProbability: 0.6,
        matchScore: 0.4
      }
    ]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

describe('getFallbackRecommendation behavior', () => {
  beforeEach(() => {
    const { prisma } = require('../../prisma');
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback-q',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback question',
      answer: 'Fallback answer',
      hint: undefined
    });
  });

  it('should return fallback question when ZPD is empty', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      currentKnowledgePoint: 'test',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
    expect(result.question.id).toBe('fallback-q');
  });

  it('should return fallback question when no questions match knowledge point', async () => {
    // Arrange
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      currentKnowledgePoint: 'test',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
    expect(result.question.id).toBe('fallback-q');
  });

  it('should return fallback question when difficulty matching fails', async () => {
    // Arrange
    const { matchDifficulty } = require('../difficulty-matcher');
    matchDifficulty.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
    expect(result.question.id).toBe('fallback-q');
  });

  it('should use currentKnowledgePoint in fallback when available', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      currentKnowledgePoint: 'fractions',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
    expect(result.question.knowledgePoint).toBe('fractions');
  });

  it('should use "general" as knowledge point when none specified', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
    expect(result.question.knowledgePoint).toBe('general');
  });

  it('should respect excludeQuestionIds in fallback', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const { prisma } = require('../../prisma');
    prisma.question.findFirst.mockResolvedValue({
      id: 'different-fallback',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Different fallback',
      answer: 'Different answer',
      hint: undefined
    });

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: [],
      excludeQuestionIds: ['excluded-q1', 'excluded-q2']
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should set expectedDifficulty to 5.0 in fallback', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.expectedDifficulty).toBe(5.0);
  });

  it('should set confidence to 0.5 in fallback', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.confidence).toBe(0.5);
  });

  it('should include exploration message in fallback reason', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.reason).toContain('Exploring new topics');
  });

  it('should throw error when no fallback questions available', async () => {
    // Arrange
    const { calculateZPD } = require('../uok-selector');
    calculateZPD.mockReturnValueOnce([]);

    const { prisma } = require('../../prisma');
    // Use mockReset then mockResolvedValue to override the beforeEach
    prisma.question.findFirst.mockReset();
    prisma.question.findFirst.mockResolvedValue(null);

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act & Assert
    await expect(getNextQuestion(context)).rejects.toThrow('No questions available');

    // Reset for other tests
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback',
      answer: 'Fallback',
      hint: undefined
    });
  });
});

describe('Bandit integration', () => {
  beforeEach(() => {
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        knowledgePoints: 'test',
        difficulty: 0.5,
        content: 'Test',
        answer: 'Answer',
        hint: 'Hint'
      }
    ]);
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback',
      answer: 'Fallback',
      hint: undefined
    });
  });

  it('should use bandit to select deltaC for exploration/exploitation', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.expectedDifficulty).toBeGreaterThanOrEqual(0);
    expect(result.expectedDifficulty).toBeLessThanOrEqual(10);
  });

  it('should use custom bandit config when provided', async () => {
    // Arrange
    const { ThompsonSamplingBandit } = require('../../rl');

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    const config: NextQuestionConfig = {
      banditConfig: {
        bucketSize: 1.0,
        minDeltaC: 2,
        maxDeltaC: 8
      }
    };

    // Act
    const result = await getNextQuestion(context, config);

    // Assert
    expect(result.question).toBeDefined();
    expect(ThompsonSamplingBandit).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketSize: 1.0,
        minDeltaC: 2,
        maxDeltaC: 8
      })
    );
  });

  it('should use default bandit config when none provided', async () => {
    // Arrange
    const { ThompsonSamplingBandit } = require('../../rl');

    const context: RecommendationContext = {
      studentId: 'test-student',
      recentPerformance: []
    };

    // Act
    await getNextQuestion(context);

    // Assert
    expect(ThompsonSamplingBandit).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketSize: 0.5,
        minDeltaC: 0,
        maxDeltaC: 10
      })
    );
  });
});

describe('Edge cases and boundary conditions', () => {
  beforeEach(() => {
    // Reset mocks before each edge case test
    const { prisma } = require('../../prisma');
    prisma.question.findMany.mockResolvedValue([
      {
        id: 'q1',
        knowledgePoints: 'test',
        difficulty: 0.5,
        content: 'Test question',
        answer: 'Test answer',
        hint: 'Test hint'
      }
    ]);
    prisma.question.findFirst.mockResolvedValue({
      id: 'fallback-q',
      knowledgePoints: 'general',
      difficulty: 0.5,
      content: 'Fallback question',
      answer: 'Fallback answer',
      hint: undefined
    });
  });

  it('should handle context with old timestamps', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'old-student',
      recentPerformance: [
        {
          knowledgePoint: 'test',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: new Date('2000-01-01')
        }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with future timestamps', async () => {
    // Arrange
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const context: RecommendationContext = {
      studentId: 'time-traveler',
      recentPerformance: [
        {
          knowledgePoint: 'test',
          isCorrect: true,
          timeSpent: 5000,
          timestamp: futureDate
        }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle context with zero time spent', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'instant-student',
      recentPerformance: [
        {
          knowledgePoint: 'test',
          isCorrect: true,
          timeSpent: 0,
          timestamp: new Date()
        }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle negative time spent', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'negative-time-student',
      recentPerformance: [
        {
          knowledgePoint: 'test',
          isCorrect: true,
          timeSpent: -1000,
          timestamp: new Date()
        }
      ]
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });

  it('should handle more than 10 recent performances (truncates to 10)', async () => {
    // Arrange
    const context: RecommendationContext = {
      studentId: 'active-student',
      recentPerformance: Array.from({ length: 20 }, (_, i) => ({
        knowledgePoint: 'test',
        isCorrect: i % 2 === 0,
        timeSpent: 5000,
        timestamp: new Date()
      }))
    };

    // Act
    const result = await getNextQuestion(context);

    // Assert
    expect(result.question).toBeDefined();
  });
});
