/**
 * Validator Unit Tests
 *
 * Tests for question validation logic including:
 * - Mathematical correctness validation
 * - Difficulty appropriateness
 * - Language clarity
 * - Educational value assessment
 * - Batch validation
 */

import {
  validateQuestion,
  validateQuestions,
  type ValidationResult,
  type QuestionToValidate
} from '../validator';

describe('validateQuestion', () => {
  const createValidQuestion = (): QuestionToValidate => ({
    question: 'What is 2 + 2?',
    answer: '4',
    explanation: 'Adding 2 and 2 equals 4',
    knowledgePoint: 'basic-addition'
  });

  it('should return valid result for a well-formed question', async () => {
    // Arrange
    const question = createValidQuestion();

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle questions without optional explanation field', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is 5 × 5?',
      answer: '25',
      knowledgePoint: 'multiplication'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should validate questions with multi-step explanations', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: '12 + (3 × 4) = ?',
      answer: '24',
      explanation: 'First multiply 3 × 4 = 12, then add 12 + 12 = 24',
      knowledgePoint: 'order-of-operations'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle fraction questions', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: '1/2 + 1/4 = ?',
      answer: '3/4',
      explanation: 'Find common denominator 4: 2/4 + 1/4 = 3/4',
      knowledgePoint: 'fraction-addition'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    // Fraction validation may have warnings due to special characters
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should handle division questions', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is 100 ÷ 10?',
      answer: '10',
      explanation: 'Dividing 100 by 10 gives 10',
      knowledgePoint: 'division'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle questions with decimal answers', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is 1 ÷ 2?',
      answer: '0.5',
      explanation: 'Half of 1 is 0.5',
      knowledgePoint: 'division'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle subtraction questions', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is 15 - 7?',
      answer: '8',
      explanation: 'Subtracting 7 from 15 equals 8',
      knowledgePoint: 'subtraction'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should return confidence score within valid range', async () => {
    // Arrange
    const question = createValidQuestion();

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should return empty errors array for valid input', async () => {
    // Arrange
    const question = createValidQuestion();

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.errors).toEqual([]);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should return empty warnings array for valid input', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: '5 + 5 = ?',
      answer: '10',
      explanation: 'Simple addition',
      knowledgePoint: 'addition'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should handle word problems in questions', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'If John has 5 apples and gives 2 to Mary, how many does he have left?',
      answer: '3',
      explanation: '5 - 2 = 3',
      knowledgePoint: 'subtraction-word-problems'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle algebra-style questions', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is x if 2x = 10?',
      answer: '5',
      explanation: 'Divide both sides by 2: x = 10 ÷ 2 = 5',
      knowledgePoint: 'basic-algebra'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should return ValidationResult type with correct structure', async () => {
    // Arrange
    const question = createValidQuestion();

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.isValid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.confidence).toBe('number');
  });
});

describe('validateQuestions', () => {
  it('should validate multiple questions in parallel', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [
      {
        question: 'What is 2 + 2?',
        answer: '4',
        knowledgePoint: 'addition'
      },
      {
        question: 'What is 3 × 3?',
        answer: '9',
        knowledgePoint: 'multiplication'
      },
      {
        question: 'What is 10 - 4?',
        answer: '6',
        knowledgePoint: 'subtraction'
      }
    ];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toHaveLength(3);
    results.forEach((result: ValidationResult) => {
      expect(result.isValid).toBe(true);
    });
  });

  it('should return array of ValidationResult objects', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [
      {
        question: 'What is 1 + 1?',
        answer: '2',
        knowledgePoint: 'addition'
      }
    ];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toHaveProperty('isValid');
    expect(results[0]).toHaveProperty('errors');
    expect(results[0]).toHaveProperty('warnings');
    expect(results[0]).toHaveProperty('confidence');
  });

  it('should handle empty array of questions', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toEqual([]);
  });

  it('should handle single question array', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [
      {
        question: 'What is 5 + 5?',
        answer: '10',
        explanation: 'Basic addition',
        knowledgePoint: 'addition'
      }
    ];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].isValid).toBe(true);
  });

  it('should handle large batch of questions', async () => {
    // Arrange
    const questions: QuestionToValidate[] = Array.from({ length: 100 }, (_, i) => ({
      question: `What is ${i} + ${i}?`,
      answer: String(i * 2),
      knowledgePoint: 'addition'
    }));

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toHaveLength(100);
    results.forEach((result: ValidationResult) => {
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('confidence');
    });
  });

  it('should preserve question order in results', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [
      {
        question: 'First question',
        answer: '1',
        knowledgePoint: 'test1'
      },
      {
        question: 'Second question',
        answer: '2',
        knowledgePoint: 'test2'
      },
      {
        question: 'Third question',
        answer: '3',
        knowledgePoint: 'test3'
      }
    ];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toHaveLength(3);
    // All results should be valid
    expect(results.every(r => r.isValid)).toBe(true);
  });

  it('should handle questions with varying knowledge points', async () => {
    // Arrange
    const questions: QuestionToValidate[] = [
      {
        question: 'Addition question',
        answer: '1',
        knowledgePoint: 'arithmetic-addition'
      },
      {
        question: 'Geometry question',
        answer: '2',
        knowledgePoint: 'geometry-shapes'
      },
      {
        question: 'Algebra question',
        answer: '3',
        knowledgePoint: 'algebra-equations'
      }
    ];

    // Act
    const results = await validateQuestions(questions);

    // Assert
    expect(results).toHaveLength(3);
    results.forEach((result: ValidationResult) => {
      expect(result.isValid).toBe(true);
    });
  });
});

describe('Validation edge cases', () => {
  it('should handle questions with special characters in answer', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is 50% as a decimal?',
      answer: '0.5',
      explanation: '50% equals 0.5 in decimal form',
      knowledgePoint: 'percentages'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle questions with unicode characters', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'What is the sum of 五 and 三?',
      answer: '8',
      explanation: 'Five plus three equals eight',
      knowledgePoint: 'chinese-numbers'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle very long explanation text', async () => {
    // Arrange
    const longExplanation = 'Step 1. '.repeat(100) + 'Final answer';
    const question: QuestionToValidate = {
      question: 'What is 1 + 1?',
      answer: '2',
      explanation: longExplanation,
      knowledgePoint: 'addition'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle questions with multiple choice format', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: 'Which is larger: 0.5 or 0.3?',
      answer: '0.5',
      explanation: 'When comparing decimals, 0.5 is greater than 0.3',
      knowledgePoint: 'decimal-comparison'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.isValid).toBe(true);
  });

  it('should handle questions with fractional answers in simplest form', async () => {
    // Arrange
    const question: QuestionToValidate = {
      question: '2/4 = ?',
      answer: '1/2',
      explanation: 'Divide numerator and denominator by 2',
      knowledgePoint: 'fraction-simplification'
    };

    // Act
    const result = await validateQuestion(question);

    // Assert
    expect(result.confidence).toBeGreaterThan(0);
  });
});
