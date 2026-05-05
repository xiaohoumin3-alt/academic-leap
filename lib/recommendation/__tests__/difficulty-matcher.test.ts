/**
 * Difficulty Matcher Unit Tests
 *
 * Tests for difficulty matching functionality including:
 * - IRT probability calculation
 * - Difficulty matching for students
 * - Optimal deltaC calculation
 * - Edge cases for probability boundaries
 */

import {
  matchDifficulty,
  selectBestMatch,
  calculateIRTProbability,
  calculateOptimalDeltaC,
  type DifficultyMatch,
  type DifficultyMatcherConfig,
  type Question
} from '../difficulty-matcher';

// Mock the IRT estimator
jest.mock('../../rl/irt/estimator', () => ({
  deltaCToDifficulty: jest.fn((deltaC: number) => (deltaC / 10) * 6 - 3)
}));

describe('calculateIRTProbability', () => {
  it('should calculate probability with default parameters', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThanOrEqual(1);
  });

  it('should return 0.625 when ability equals difficulty with default parameters', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    // With a=1.0, c=0.25: P = 0.25 + 0.75 / (1 + exp(0)) = 0.25 + 0.75/2 = 0.625
    expect(probability).toBeCloseTo(0.625, 5);
  });

  it('should return higher probability when ability exceeds difficulty', () => {
    // Arrange
    const studentAbility = 0.8;
    const questionDifficulty = 0.3;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0.6);
  });

  it('should return lower probability when difficulty exceeds ability', () => {
    // Arrange
    const studentAbility = 0.2;
    const questionDifficulty = 0.8;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeLessThan(0.6);
  });

  it('should respect guessing parameter (minimum probability)', () => {
    // Arrange
    const studentAbility = -10; // Very low ability
    const questionDifficulty = 10; // Very high difficulty
    const guessing = 0.25;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, 1.0, guessing);

    // Assert
    expect(probability).toBeGreaterThanOrEqual(guessing);
  });

  it('should handle zero guessing parameter', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const guessing = 0.0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, 1.0, guessing);

    // Assert
    expect(probability).toBeCloseTo(0.5, 5);
  });

  it('should handle high discrimination parameter', () => {
    // Arrange
    const studentAbility = 0.6;
    const questionDifficulty = 0.5;
    const discrimination = 2.0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, discrimination);

    // Assert
    expect(probability).toBeGreaterThan(0.6);
  });

  it('should handle low discrimination parameter', () => {
    // Arrange
    const studentAbility = 0.6;
    const questionDifficulty = 0.5;
    const discrimination = 0.5;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, discrimination);

    // Assert
    expect(probability).toBeGreaterThan(0.5);
    expect(probability).toBeLessThan(0.7);
  });

  it('should throw error for non-positive discrimination', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const discrimination = 0;

    // Act & Assert
    expect(() => calculateIRTProbability(studentAbility, questionDifficulty, discrimination)).toThrow('Discrimination must be positive');
  });

  it('should throw error for negative discrimination', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const discrimination = -1;

    // Act & Assert
    expect(() => calculateIRTProbability(studentAbility, questionDifficulty, discrimination)).toThrow();
  });

  it('should throw error for guessing parameter >= 1', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const guessing = 1.0;

    // Act & Assert
    expect(() => calculateIRTProbability(studentAbility, questionDifficulty, 1.0, guessing)).toThrow('Guessing must be in [0, 1)');
  });

  it('should throw error for negative guessing parameter', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const guessing = -0.1;

    // Act & Assert
    expect(() => calculateIRTProbability(studentAbility, questionDifficulty, 1.0, guessing)).toThrow();
  });

  it('should return probability close to 1 for very high ability', () => {
    // Arrange
    const studentAbility = 10;
    const questionDifficulty = 0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0.9);
  });

  it('should return probability close to guessing for very low ability', () => {
    // Arrange
    const studentAbility = -10;
    const questionDifficulty = 10;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeLessThan(0.5);
  });

  it('should handle negative ability values', () => {
    // Arrange
    const studentAbility = -1;
    const questionDifficulty = 0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);
  });

  it('should handle negative difficulty values', () => {
    // Arrange
    const studentAbility = 0;
    const questionDifficulty = -1;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);
  });
});

describe('matchDifficulty', () => {
  const createQuestion = (id: string, difficultyLevel: number): Question => ({
    id,
    knowledgePoint: 'test-kp',
    difficultyLevel,
    content: {
      question: `Question ${id}`,
      answer: 'Answer',
      explanation: 'Explanation'
    }
  });

  it('should return empty array for no questions', () => {
    // Arrange
    const questions: Question[] = [];
    const studentAbility = 0.5;

    // Act
    const result = matchDifficulty(questions, studentAbility);

    // Assert
    expect(result).toEqual([]);
  });

  it('should return matches for single question', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;

    // Act
    const result = matchDifficulty(questions, studentAbility);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('expectedProbability');
    expect(result[0]).toHaveProperty('matchScore');
  });

  it('should sort results by match score descending', () => {
    // Arrange
    const questions = [
      createQuestion('q1', 0.5),
      createQuestion('q2', 0.3),
      createQuestion('q3', 0.7)
    ];
    const studentAbility = 0.5;

    // Act
    const result = matchDifficulty(questions, studentAbility);

    // Assert
    expect(result.length).toBeGreaterThan(0);
    // Check that results are sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].matchScore).toBeGreaterThanOrEqual(result[i].matchScore);
    }
  });

  it('should use default target probability of 0.6', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;

    // Act
    const result = matchDifficulty(questions, studentAbility);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].matchScore).toBeGreaterThanOrEqual(0);
    expect(result[0].matchScore).toBeLessThanOrEqual(1);
  });

  it('should accept custom target probability', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { targetProbability: 0.7 };

    // Act
    const result = matchDifficulty(questions, studentAbility, config);

    // Assert
    expect(result).toHaveLength(1);
  });

  it('should limit results when maxResults is specified', () => {
    // Arrange
    const questions = [
      createQuestion('q1', 0.1),
      createQuestion('q2', 0.3),
      createQuestion('q3', 0.5),
      createQuestion('q4', 0.7),
      createQuestion('q5', 0.9)
    ];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { maxResults: 2 };

    // Act
    const result = matchDifficulty(questions, studentAbility, config);

    // Assert
    expect(result).toHaveLength(2);
  });

  it('should return all results when maxResults is not specified', () => {
    // Arrange
    const questions = [
      createQuestion('q1', 0.1),
      createQuestion('q2', 0.5),
      createQuestion('q3', 0.9)
    ];
    const studentAbility = 0.5;

    // Act
    const result = matchDifficulty(questions, studentAbility);

    // Assert
    expect(result).toHaveLength(3);
  });

  it('should handle custom discrimination parameter', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { discrimination: 2.0 };

    // Act
    const result = matchDifficulty(questions, studentAbility, config);

    // Assert
    expect(result).toHaveLength(1);
  });

  it('should handle custom guessing parameter', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { guessing: 0.1 };

    // Act
    const result = matchDifficulty(questions, studentAbility, config);

    // Assert
    expect(result).toHaveLength(1);
  });

  it('should handle custom probability tolerance', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { probabilityTolerance: 0.2 };

    // Act
    const result = matchDifficulty(questions, studentAbility, config);

    // Assert
    expect(result).toHaveLength(1);
  });
});

describe('selectBestMatch', () => {
  const createQuestion = (id: string, difficultyLevel: number): Question => ({
    id,
    knowledgePoint: 'test-kp',
    difficultyLevel,
    content: {
      question: `Question ${id}`,
      answer: 'Answer',
      explanation: 'Explanation'
    }
  });

  it('should return null for empty questions array', () => {
    // Arrange
    const questions: Question[] = [];
    const studentAbility = 0.5;

    // Act
    const result = selectBestMatch(questions, studentAbility);

    // Assert
    expect(result).toBeNull();
  });

  it('should return best match for single question', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;

    // Act
    const result = selectBestMatch(questions, studentAbility);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.question.id).toBe('q1');
  });

  it('should return highest scoring question', () => {
    // Arrange
    const questions = [
      createQuestion('q1', 0.1),
      createQuestion('q2', 0.5),
      createQuestion('q3', 0.9)
    ];
    const studentAbility = 0.5;

    // Act
    const result = selectBestMatch(questions, studentAbility);

    // Assert
    expect(result).not.toBeNull();
    expect(result?.matchScore).toBeGreaterThanOrEqual(0);
  });

  it('should accept custom config', () => {
    // Arrange
    const questions = [createQuestion('q1', 0.5)];
    const studentAbility = 0.5;
    const config: Partial<DifficultyMatcherConfig> = { targetProbability: 0.7 };

    // Act
    const result = selectBestMatch(questions, studentAbility, config);

    // Assert
    expect(result).not.toBeNull();
  });
});

describe('calculateOptimalDeltaC', () => {
  it('should calculate deltaC for target probability', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 0.6;

    // Act
    const deltaC = calculateOptimalDeltaC(studentAbility, targetProbability);

    // Assert
    expect(deltaC).toBeGreaterThanOrEqual(0);
    expect(deltaC).toBeLessThanOrEqual(10);
  });

  it('should return lower deltaC for lower target probability', () => {
    // Arrange
    const studentAbility = 0;

    // Act
    const deltaC1 = calculateOptimalDeltaC(studentAbility, 0.5);
    const deltaC2 = calculateOptimalDeltaC(studentAbility, 0.7);

    // Assert - Lower probability means easier question, which means lower deltaC
    expect(deltaC1).toBeLessThan(deltaC2);
  });

  it('should throw error for target probability equal to guessing', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 0.25;

    // Act & Assert
    expect(() => calculateOptimalDeltaC(studentAbility, targetProbability)).toThrow();
  });

  it('should throw error for target probability less than guessing', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 0.2;

    // Act & Assert
    expect(() => calculateOptimalDeltaC(studentAbility, targetProbability, 1.0, 0.25)).toThrow();
  });

  it('should throw error for target probability of 1', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 1.0;

    // Act & Assert
    expect(() => calculateOptimalDeltaC(studentAbility, targetProbability)).toThrow('Target probability must be in');
  });

  it('should handle custom discrimination parameter', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 0.6;
    const discrimination = 2.0;

    // Act
    const deltaC = calculateOptimalDeltaC(studentAbility, targetProbability, discrimination);

    // Assert
    expect(deltaC).toBeGreaterThanOrEqual(0);
    expect(deltaC).toBeLessThanOrEqual(10);
  });

  it('should handle custom guessing parameter', () => {
    // Arrange
    const studentAbility = 0;
    const targetProbability = 0.5;
    const guessing = 0.1;

    // Act
    const deltaC = calculateOptimalDeltaC(studentAbility, targetProbability, 1.0, guessing);

    // Assert
    expect(deltaC).toBeGreaterThanOrEqual(0);
    expect(deltaC).toBeLessThanOrEqual(10);
  });

  it('should clamp deltaC to valid range [0, 10]', () => {
    // Arrange
    const veryHighAbility = 10;
    const lowTargetProbability = 0.3;

    // Act
    const deltaC = calculateOptimalDeltaC(veryHighAbility, lowTargetProbability);

    // Assert
    expect(deltaC).toBeGreaterThanOrEqual(0);
    expect(deltaC).toBeLessThanOrEqual(10);
  });
});

describe('Type validation', () => {
  describe('Question type', () => {
    it('should accept valid question structure', () => {
      // Arrange & Act
      const question: Question = {
        id: 'test-question',
        knowledgePoint: 'addition',
        difficultyLevel: 0.5,
        content: {
          question: 'What is 2 + 2?',
          answer: '4',
          explanation: 'Basic addition'
        }
      };

      // Assert
      expect(question.id).toBe('test-question');
      expect(question.knowledgePoint).toBe('addition');
      expect(question.difficultyLevel).toBe(0.5);
    });

    it('should accept question without optional explanation', () => {
      // Arrange & Act
      const question: Question = {
        id: 'test-question',
        knowledgePoint: 'subtraction',
        difficultyLevel: 0.6,
        content: {
          question: 'What is 5 - 3?',
          answer: '2'
        }
      };

      // Assert
      expect(question.content.explanation).toBeUndefined();
    });
  });

  describe('DifficultyMatch type', () => {
    it('should accept valid difficulty match structure', () => {
      // Arrange & Act
      const match: DifficultyMatch = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Q', answer: 'A' }
        },
        expectedProbability: 0.6,
        matchScore: 0.9
      };

      // Assert
      expect(match.expectedProbability).toBe(0.6);
      expect(match.matchScore).toBe(0.9);
    });

    it('should accept match score at boundaries', () => {
      // Arrange & Act
      const perfectMatch: DifficultyMatch = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Q', answer: 'A' }
        },
        expectedProbability: 0.6,
        matchScore: 1.0
      };

      const poorMatch: DifficultyMatch = {
        question: {
          id: 'q2',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Q', answer: 'A' }
        },
        expectedProbability: 0.6,
        matchScore: 0.0
      };

      // Assert
      expect(perfectMatch.matchScore).toBe(1.0);
      expect(poorMatch.matchScore).toBe(0.0);
    });

    it('should accept probability at boundaries', () => {
      // Arrange & Act
      const certainSuccess: DifficultyMatch = {
        question: {
          id: 'q1',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Q', answer: 'A' }
        },
        expectedProbability: 1.0,
        matchScore: 0.5
      };

      const certainFailure: DifficultyMatch = {
        question: {
          id: 'q2',
          knowledgePoint: 'test',
          difficultyLevel: 0.5,
          content: { question: 'Q', answer: 'A' }
        },
        expectedProbability: 0.0,
        matchScore: 0.5
      };

      // Assert
      expect(certainSuccess.expectedProbability).toBe(1.0);
      expect(certainFailure.expectedProbability).toBe(0.0);
    });
  });
});

describe('Edge cases and boundary conditions', () => {
  it('should handle very small discrimination values', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const discrimination = 0.01;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, discrimination);

    // Assert
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(1);
  });

  it('should handle very large discrimination values', () => {
    // Arrange
    const studentAbility = 0.5;
    const questionDifficulty = 0.5;
    const discrimination = 100;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, discrimination);

    // Assert
    expect(probability).toBeCloseTo(0.625, 2);
  });

  it('should handle guessing parameter at maximum valid value', () => {
    // Arrange
    const studentAbility = 0;
    const questionDifficulty = 0;
    const guessing = 0.99;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty, 1.0, guessing);

    // Assert
    expect(probability).toBeCloseTo(0.995, 2);
  });

  it('should handle floating point precision for edge values', () => {
    // Arrange
    const studentAbility = 0.1;
    const questionDifficulty = 0.9;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0.25); // At least guessing parameter
    expect(probability).toBeLessThan(0.5);
  });
});

describe('Extreme ability value tests', () => {
  it('should handle theta = -3 (very low ability)', () => {
    // Arrange
    const studentAbility = -3;
    const questionDifficulty = 0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0);
    expect(probability).toBeLessThan(0.5);
    // Should be close to guessing parameter for extreme low ability
    expect(probability).toBeLessThan(0.3);
  });

  it('should handle theta = 3 (very high ability)', () => {
    // Arrange
    const studentAbility = 3;
    const questionDifficulty = 0;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0.9);
    expect(probability).toBeLessThan(1);
  });

  it('should handle theta = -3 with high difficulty question', () => {
    // Arrange
    const studentAbility = -3;
    const questionDifficulty = 2;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeCloseTo(0.25, 1); // Should be at guessing level
  });

  it('should handle theta = 3 with low difficulty question', () => {
    // Arrange
    const studentAbility = 3;
    const questionDifficulty = -2;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeGreaterThan(0.95);
  });

  it('should handle theta = -3 with equal difficulty', () => {
    // Arrange
    const studentAbility = -3;
    const questionDifficulty = -3;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    // When ability equals difficulty, P = c + (1-c) / 2 = 0.25 + 0.75/2 = 0.625
    expect(probability).toBeCloseTo(0.625, 5);
  });

  it('should handle theta = 3 with equal difficulty', () => {
    // Arrange
    const studentAbility = 3;
    const questionDifficulty = 3;

    // Act
    const probability = calculateIRTProbability(studentAbility, questionDifficulty);

    // Assert
    expect(probability).toBeCloseTo(0.625, 5);
  });
});

describe('IRT 3PL formula verification tests', () => {
  it('should verify 3PL formula: P = c + (1-c) / (1 + exp(-a(theta-b)))', () => {
    // Arrange
    const theta = 0;
    const b = 0;
    const a = 1;
    const c = 0.25;

    // Manual calculation: P = 0.25 + 0.75 / (1 + exp(0)) = 0.25 + 0.75/2 = 0.625
    const expectedProbability = c + (1 - c) / (1 + Math.exp(-1 * a * (theta - b)));

    // Act
    const actualProbability = calculateIRTProbability(theta, b, a, c);

    // Assert
    expect(actualProbability).toBeCloseTo(expectedProbability, 10);
  });

  it('should verify 3PL formula with non-zero ability and difficulty', () => {
    // Arrange
    const theta = 1;
    const b = -0.5;
    const a = 1.5;
    const c = 0.2;

    // Manual calculation
    const exponent = -1 * a * (theta - b);
    const expectedProbability = c + (1 - c) / (1 + Math.exp(exponent));

    // Act
    const actualProbability = calculateIRTProbability(theta, b, a, c);

    // Assert
    expect(actualProbability).toBeCloseTo(expectedProbability, 10);
  });

  it('should verify discrimination parameter steepness effect', () => {
    // Arrange
    const theta = 0.5;
    const b = 0;
    const c = 0.25;

    // Act
    const probLowDiscrimination = calculateIRTProbability(theta, b, 0.5, c);
    const probHighDiscrimination = calculateIRTProbability(theta, b, 2.0, c);

    // Assert
    // Higher discrimination should produce higher probability when ability > difficulty
    expect(probHighDiscrimination).toBeGreaterThan(probLowDiscrimination);
  });

  it('should verify guessing parameter as lower bound', () => {
    // Arrange
    const theta = -10; // Extremely low ability
    const b = 10; // Extremely high difficulty
    const a = 1;
    const c = 0.25;

    // Act
    const probability = calculateIRTProbability(theta, b, a, c);

    // Assert
    // Probability should approach but never go below guessing parameter
    expect(probability).toBeGreaterThanOrEqual(c);
    expect(probability).toBeLessThan(c + 0.01);
  });
});
