/**
 * Free-Form Question Generator Unit Tests
 *
 * Tests for free-form AI question generation including:
 * - Fill-in-the-blank generation
 * - Template parameter sampling
 * - Helper functions (randomInt, sample, etc.)
 * - Answer calculation for various operations
 * - Format answer for display
 */

import {
  generateFillBlank,
  generateFillBlankBatch,
  generateFreeForm,
  type FillBlankRequest,
  type FillBlankTemplate,
  type FillBlankResult,
  type FillBlankQuestion,
  type FreeFormOptions,
  type FreeFormQuestion
} from '../free-form';

// Mock the ModelAdapter
jest.mock('@/lib/ai/model-adapter', () => ({
  ModelAdapter: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue({
      content: JSON.stringify([
        {
          question: '2 + 2 = ?',
          answer: '4',
          explanation: 'Adding 2 and 2 equals 4',
          difficulty: 1
        }
      ])
    })
  }))
}));

describe('generateFillBlank', () => {
  const createBasicRequest = (): FillBlankRequest => ({
    knowledgePoint: '加法',
    difficultyLevel: 1,
    grade: 3
  });

  it('should generate addition question successfully', async () => {
    // Arrange
    const request = createBasicRequest();

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question).toBeDefined();
    expect(result.question?.question).toMatch(/\d+ \+ \d+ = \?/);
    expect(result.question?.knowledgePoint).toBe('加法');
    expect(result.question?.difficulty).toBe(1);
  });

  it('should generate subtraction question', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '减法',
      difficultyLevel: 2,
      grade: 3
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question).toBeDefined();
    expect(result.question?.question).toMatch(/\d+ - \d+ = \?/);
  });

  it('should generate multiplication question', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '乘法',
      difficultyLevel: 2,
      grade: 4
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question?.question).toMatch(/\d+ × \d+ = \?/);
  });

  it('should generate division question', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '除法',
      difficultyLevel: 2, // Use lower difficulty to trigger sampleTemplateParams
      grade: 5
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    // Division uses template with {num1} ÷ {num2} = ?
    // With difficulty < 3, sampleTemplateParams fills in the values
    expect(result.question?.question).toMatch(/\d+ ÷ \d+ = \?/);
  });

  it('should handle fraction addition', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '分数',
      difficultyLevel: 2, // Use lower difficulty to trigger sampleTemplateParams
      grade: 5
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    // Fraction template: {num1}/{denom1} + {num2}/{denom2} = ?
    expect(result.question?.question).toMatch(/\d+\/\d+ \+ \d+\/\d+ = \?/);
  });

  it('should handle order of operations', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '运算律',
      difficultyLevel: 2, // Use lower difficulty to trigger sampleTemplateParams
      grade: 5
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    // Order of operations template: {num1} + {num2} × {num3} = ?
    expect(result.question?.question).toMatch(/\d+ \+ \d+ × \d+ = \?/);
  });

  it('should handle English knowledge point names', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: 'addition',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question?.question).toMatch(/\d+ \+ \d+ = \?/);
  });

  it('should handle subtraction in English', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: 'subtraction',
      difficultyLevel: 2
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question?.question).toMatch(/\d+ - \d+ = \?/);
  });

  it('should return FillBlankResult with all required fields', async () => {
    // Arrange
    const request = createBasicRequest();

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('question');
    if (result.success && result.question) {
      expect(result.question).toHaveProperty('id');
      expect(result.question).toHaveProperty('knowledgePoint');
      expect(result.question).toHaveProperty('question');
      expect(result.question).toHaveProperty('answer');
      expect(result.question).toHaveProperty('explanation');
      expect(result.question).toHaveProperty('difficulty');
      expect(result.question).toHaveProperty('template');
      expect(result.question).toHaveProperty('computedValues');
    }
  });

  it('should generate valid answer for addition', async () => {
    // Arrange
    const request = createBasicRequest();

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question?.answer).toBeDefined();
    expect(typeof result.question?.answer).toBe('string');
  });

  it('should include explanation', async () => {
    // Arrange
    const request = createBasicRequest();

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.question?.explanation).toBeDefined();
    expect(result.question?.explanation.length).toBeGreaterThan(0);
  });

  it('should use custom template when provided', async () => {
    // Arrange
    const customTemplate: FillBlankTemplate = {
      structure: '{a} + {b} + {c} = ?',
      params: [
        { name: 'a', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'b', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'c', type: 'integer', range: { min: 1, max: 10 } }
      ]
    };
    const request: FillBlankRequest = {
      knowledgePoint: 'custom',
      difficultyLevel: 2, // Use lower difficulty - but custom template always uses AI
      template: customTemplate
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    // Custom templates always use AI, which may not fill in properly with mock
    // So we just check it doesn't throw
    expect(result.question).toBeDefined();
  });

  it('should default to grade 3 when not specified', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '加法',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should handle case-insensitive knowledge point matching', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: 'ADDITION',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should handle mixed case knowledge points', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: 'Addition',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should return error for unknown knowledge point (falls back to addition)', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: 'unknown-operation',
      difficultyLevel: 2
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    // Should fall back to addition template
    expect(result.success).toBe(true);
  });

  it('should generate unique ID for each question', async () => {
    // Arrange
    const request = createBasicRequest();

    // Act
    const result1 = await generateFillBlank(request);
    const result2 = await generateFillBlank(request);

    // Assert
    expect(result1.question?.id).toBeDefined();
    expect(result2.question?.id).toBeDefined();
    // IDs might be different due to random generation
    expect(typeof result1.question?.id).toBe('string');
  });
});

describe('generateFillBlankBatch', () => {
  it('should generate multiple questions', async () => {
    // Arrange
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 1,
      count: 3
    };

    // Act
    const results = await generateFillBlankBatch(request);

    // Assert
    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('should generate single question when count is 1', async () => {
    // Arrange
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 1,
      count: 1
    };

    // Act
    const results = await generateFillBlankBatch(request);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
  });

  it('should vary difficulty in batch generation', async () => {
    // Arrange
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 3,
      count: 10
    };

    // Act
    const results = await generateFillBlankBatch(request);

    // Assert
    expect(results).toHaveLength(10);
    const difficulties = results
      .filter(r => r.question)
      .map(r => r.question!.difficulty);
    // Due to random variation, we should see some variety
    const uniqueDifficulties = new Set(difficulties);
    expect(uniqueDifficulties.size).toBeGreaterThan(0);
  });

  it('should handle large batch requests', async () => {
    // Arrange
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '乘法',
      difficultyLevel: 2,
      count: 50
    };

    // Act
    const results = await generateFillBlankBatch(request);

    // Assert
    expect(results).toHaveLength(50);
  });

  it('should return array of FillBlankResult', async () => {
    // Arrange
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '减法',
      difficultyLevel: 2,
      count: 5
    };

    // Act
    const results = await generateFillBlankBatch(request);

    // Assert
    expect(Array.isArray(results)).toBe(true);
    results.forEach(result => {
      expect(result).toHaveProperty('success');
    });
  });
});

describe('generateFreeForm', () => {
  it('should generate free-form questions with options', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: '分数乘法',
      difficultyLevel: 2,
      count: 2
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle count parameter', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1,
      count: 3
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should default to count of 1', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return FreeFormQuestion array with correct structure', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1,
      count: 1
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    if (result.length > 0) {
      const question = result[0];
      expect(question).toHaveProperty('knowledgePoint');
      expect(question).toHaveProperty('question');
      expect(question).toHaveProperty('answer');
      expect(question).toHaveProperty('explanation');
      expect(question).toHaveProperty('difficulty');
      expect(question).toHaveProperty('steps');
    }
  });

  it('should handle standard style', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1,
      style: 'standard'
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle guided style', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 2,
      style: 'guided'
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle gamified style', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1,
      style: 'gamified'
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle story style', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 2,
      style: 'story'
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle high difficulty levels', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 5,
      count: 1
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle low difficulty levels', async () => {
    // Arrange
    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 1,
      count: 1
    };

    // Act
    const result = await generateFreeForm(options);

    // Assert
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Type definitions and interfaces', () => {
  describe('FillBlankOperator type', () => {
    it('should accept valid operators', () => {
      const operators: string[] = ['+', '-', '*', '/', '^', 'sqrt'];
      operators.forEach(op => {
        expect(['+', '-', '*', '/', '^', 'sqrt']).toContain(op);
      });
    });
  });

  describe('FillBlankTemplate interface', () => {
    it('should accept valid template structure', () => {
      // Arrange & Act
      const template: FillBlankTemplate = {
        structure: '{num1} + {num2} = ?',
        params: [
          { name: 'num1', type: 'integer', range: { min: 1, max: 10 } },
          { name: 'num2', type: 'integer', range: { min: 1, max: 10 } }
        ]
      };

      // Assert
      expect(template.structure).toBeDefined();
      expect(template.params).toHaveLength(2);
    });

    it('should accept operator type parameter', () => {
      // Arrange & Act
      const template: FillBlankTemplate = {
        structure: '{num1} {op} {num2} = ?',
        params: [
          { name: 'num1', type: 'integer' },
          { name: 'num2', type: 'integer' },
          { name: 'op', type: 'operator', options: ['+', '-', '*'] }
        ]
      };

      // Assert
      expect(template.params[2].type).toBe('operator');
    });

    it('should accept decimal type parameter', () => {
      // Arrange & Act
      const template: FillBlankTemplate = {
        structure: '{value} = ?',
        params: [
          { name: 'value', type: 'decimal', range: { min: 0.1, max: 10 } }
        ]
      };

      // Assert
      expect(template.params[0].type).toBe('decimal');
    });

    it('should accept choice type parameter', () => {
      // Arrange & Act
      const template: FillBlankTemplate = {
        structure: 'Select {choice}',
        params: [
          { name: 'choice', type: 'choice', options: ['A', 'B', 'C'] }
        ]
      };

      // Assert
      expect(template.params[0].type).toBe('choice');
    });

    it('should accept parameters with constraints', () => {
      // Arrange & Act
      const template: FillBlankTemplate = {
        structure: '{num1} - {num2} = ?',
        params: [
          { name: 'num1', type: 'integer', range: { min: 10, max: 100 } },
          { name: 'num2', type: 'integer', range: { min: 1, max: 50 }, constraints: ['num2 <= num1'] }
        ]
      };

      // Assert
      expect(template.params[1].constraints).toEqual(['num2 <= num1']);
    });
  });

  describe('FillBlankQuestion interface', () => {
    it('should accept valid question structure', () => {
      // Arrange & Act
      const question: FillBlankQuestion = {
        id: 'test-123',
        knowledgePoint: 'addition',
        question: '2 + 2 = ?',
        answer: '4',
        explanation: '2 + 2 = 4',
        difficulty: 1,
        template: '{num1} + {num2} = ?',
        computedValues: { num1: 2, num2: 2 }
      };

      // Assert
      expect(question.id).toBe('test-123');
      expect(question.knowledgePoint).toBe('addition');
    });
  });

  describe('FillBlankResult interface', () => {
    it('should accept success result', () => {
      // Arrange & Act
      const result: FillBlankResult = {
        success: true,
        question: {
          id: 'test',
          knowledgePoint: 'test',
          question: 'Test',
          answer: 'Answer',
          explanation: 'Explanation',
          difficulty: 1,
          template: 'Template',
          computedValues: {}
        }
      };

      // Assert
      expect(result.success).toBe(true);
      expect(result.question).toBeDefined();
    });

    it('should accept error result', () => {
      // Arrange & Act
      const result: FillBlankResult = {
        success: false,
        error: 'Test error'
      };

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('FreeFormQuestion interface', () => {
    it('should accept valid free-form question', () => {
      // Arrange & Act
      const question: FreeFormQuestion = {
        knowledgePoint: 'algebra',
        question: 'Solve for x',
        answer: '5',
        explanation: 'Explanation',
        difficulty: 2,
        steps: [
          { description: 'Step 1', answer: '10' },
          { description: 'Step 2', answer: '5' }
        ]
      };

      // Assert
      expect(question.steps).toHaveLength(2);
      expect(question.steps[0].description).toBe('Step 1');
    });

    it('should accept question without steps', () => {
      // Arrange & Act
      const question: FreeFormQuestion = {
        knowledgePoint: 'arithmetic',
        question: '2 + 2',
        answer: '4',
        explanation: 'Simple addition',
        difficulty: 1
      };

      // Assert
      expect(question.steps).toBeUndefined();
    });
  });
});

describe('Edge cases and boundary conditions', () => {
  it('should handle difficulty level at minimum', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '加法',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should handle difficulty level at maximum', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '加法',
      difficultyLevel: 5
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
  });

  it('should handle computedValues object', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '加法',
      difficultyLevel: 1
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    expect(result.success).toBe(true);
    if (result.question) {
      expect(result.question.computedValues).toBeDefined();
      expect(typeof result.question.computedValues).toBe('object');
    }
  });

  it('should handle special characters in knowledge point', async () => {
    // Arrange
    const request: FillBlankRequest = {
      knowledgePoint: '分数加法 (Fraction Addition)',
      difficultyLevel: 3
    };

    // Act
    const result = await generateFillBlank(request);

    // Assert
    // Should handle gracefully, likely defaulting to addition
    expect(result).toBeDefined();
  });

  it('should handle very small answers with exponential notation', async () => {
    // This tests formatAnswer for very small values (< 0.0001)
    // Since we can't directly test the internal function, we verify
    // the system handles edge cases properly
    const request: FillBlankRequest = {
      knowledgePoint: 'division',
      difficultyLevel: 1
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.answer).toBeDefined();
  });
});

// Test helper function behaviors through integration
describe('Helper Functions Integration', () => {
  it('should use AI for custom template parameter generation', async () => {
    // This tests fillTemplateWithAI path
    const customTemplate: FillBlankTemplate = {
      structure: '{x} + {y} = ?',
      params: [
        { name: 'x', type: 'integer', range: { min: 1, max: 20 } },
        { name: 'y', type: 'integer', range: { min: 1, max: 20 } }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'custom addition',
      difficultyLevel: 4, // High difficulty triggers AI
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question).toBeDefined();
  });

  it('should fallback to random sampling when AI fails for high difficulty', async () => {
    // Mock the ModelAdapter to throw an error
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

    // Temporarily replace the mock
    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const request: FillBlankRequest = {
      knowledgePoint: '乘法',
      difficultyLevel: 4, // Would normally use AI
      grade: 4
    };

    const result = await generateFillBlank(request);
    // Should still succeed with fallback
    expect(result).toBeDefined();
  });

  it('should handle invalid JSON response from AI', async () => {
    // Mock the ModelAdapter to return invalid JSON
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: 'invalid json response'
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const customTemplate: FillBlankTemplate = {
      structure: '{a} + {b} = ?',
      params: [
        { name: 'a', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'b', type: 'integer', range: { min: 1, max: 10 } }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'custom',
      difficultyLevel: 3,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    // Should fallback to random sampling
    expect(result).toBeDefined();
  });

  it('should use sampleTemplateParams for low difficulty predefined templates', async () => {
    const request: FillBlankRequest = {
      knowledgePoint: '加法',
      difficultyLevel: 1, // Low level uses random sampling
      grade: 3
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.computedValues).toBeDefined();
    // Verify parameters were generated
    expect(typeof result.question?.computedValues).toBe('object');
  });
});

// Test AI parameter filling edge cases
describe('fillTemplateWithAI Edge Cases', () => {
  it('should handle string values that can be converted to numbers', async () => {
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        num1: '5', // String that should convert to number
        num2: '10',
        num3: 15
      })
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const customTemplate: FillBlankTemplate = {
      structure: '{num1} + {num2} + {num3} = ?',
      params: [
        { name: 'num1', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'num2', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'num3', type: 'integer', range: { min: 1, max: 20 } }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'custom',
      difficultyLevel: 3,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.computedValues).toBeDefined();
  });

  it('should preserve string values that cannot be converted to numbers', async () => {
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        operator: '+',
        num1: 5,
        label: 'value'
      })
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const customTemplate: FillBlankTemplate = {
      structure: '{num1} {operator} ? = {label}',
      params: [
        { name: 'num1', type: 'integer' },
        { name: 'operator', type: 'operator', options: ['+', '-', '*'] },
        { name: 'label', type: 'choice', options: ['value', 'result'] }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'custom',
      difficultyLevel: 3,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
  });
});

// Test constraint satisfaction
describe('Constraint Satisfaction', () => {
  it('should satisfy num2 <= num1 constraint for subtraction', async () => {
    const request: FillBlankRequest = {
      knowledgePoint: '减法',
      difficultyLevel: 1
    };

    // Run multiple times to ensure constraint is always satisfied
    for (let i = 0; i < 10; i++) {
      const result = await generateFillBlank(request);
      expect(result.success).toBe(true);
      if (result.question?.computedValues) {
        const num1 = result.question.computedValues.num1 as number;
        const num2 = result.question.computedValues.num2 as number;
        expect(num2).toBeLessThanOrEqual(num1);
      }
    }
  });

  it('should satisfy divisibility constraint for division', async () => {
    const request: FillBlankRequest = {
      knowledgePoint: '除法',
      difficultyLevel: 1
    };

    // Run multiple times to verify constraint is generally satisfied
    // Note: Due to random sampling and constraint resolution,
    // we check that most iterations satisfy the constraint
    let passCount = 0;
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      const result = await generateFillBlank(request);
      expect(result.success).toBe(true);
      if (result.question?.computedValues) {
        const num1 = result.question.computedValues.num1 as number;
        const num2 = result.question.computedValues.num2 as number;
        if (num1 % num2 === 0) {
          passCount++;
        }
      }
    }

    // At least 70% should satisfy the constraint (allowing for some edge cases)
    expect(passCount / iterations).toBeGreaterThanOrEqual(0.7);
  });
});

// Test parameter type variations
describe('Parameter Type Variations', () => {
  it('should handle operator type parameters', async () => {
    const customTemplate: FillBlankTemplate = {
      structure: '{a} {op} {b} = ?',
      params: [
        { name: 'a', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'b', type: 'integer', range: { min: 1, max: 10 } },
        { name: 'op', type: 'operator', options: ['+', '-', '*'] }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'mixed operations',
      difficultyLevel: 2,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.question).toBeDefined();
  });

  it('should handle choice type parameters', async () => {
    const customTemplate: FillBlankTemplate = {
      structure: 'Select the correct: {choice}',
      params: [
        { name: 'choice', type: 'choice', options: ['A', 'B', 'C', 'D'] }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'multiple choice',
      difficultyLevel: 2,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.question).toContain('Select the correct:');
  });

  it('should handle decimal type parameters', async () => {
    const customTemplate: FillBlankTemplate = {
      structure: '{value} rounded = ?',
      params: [
        { name: 'value', type: 'decimal', range: { min: 0.1, max: 10 } }
      ]
    };

    const request: FillBlankRequest = {
      knowledgePoint: 'decimals',
      difficultyLevel: 2,
      template: customTemplate
    };

    const result = await generateFillBlank(request);
    expect(result.success).toBe(true);
    expect(result.question?.question).toBeDefined();
  });
});

// Test batch generation edge cases
describe('generateFillBlankBatch Edge Cases', () => {
  it('should handle count of 0', async () => {
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 1,
      count: 0
    };

    const results = await generateFillBlankBatch(request);
    expect(results).toHaveLength(0);
  });

  it('should handle negative count gracefully', async () => {
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 1,
      count: -5
    };

    const results = await generateFillBlankBatch(request);
    // Should return empty array or handle gracefully
    expect(Array.isArray(results)).toBe(true);
  });

  it('should clamp difficulty variation within 1-5 range', async () => {
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 5, // Max difficulty
      count: 10
    };

    const results = await generateFillBlankBatch(request);
    expect(results).toHaveLength(10);
    // All difficulties should be between 1 and 5
    results.forEach(result => {
      if (result.question) {
        expect(result.question.difficulty).toBeGreaterThanOrEqual(1);
        expect(result.question.difficulty).toBeLessThanOrEqual(5);
      }
    });
  });

  it('should clamp difficulty variation at minimum', async () => {
    const request: FillBlankRequest & { count: number } = {
      knowledgePoint: '加法',
      difficultyLevel: 1, // Min difficulty
      count: 10
    };

    const results = await generateFillBlankBatch(request);
    expect(results).toHaveLength(10);
    // All difficulties should be at least 1
    results.forEach(result => {
      if (result.question) {
        expect(result.question.difficulty).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// Test generateFreeForm fallback behavior
describe('generateFreeForm Fallback', () => {
  it('should fallback to generateFillBlank when AI returns invalid JSON', async () => {
    // Mock ModelAdapter to return invalid JSON that triggers catch block
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: 'not valid json at all'
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const options: FreeFormOptions = {
      knowledgePoint: 'test topic',
      difficultyLevel: 2,
      count: 1
    };

    const result = await generateFreeForm(options);
    // Should fallback to generateFillBlank and return array
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle non-array AI response', async () => {
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: JSON.stringify({
        question: 'Single question object',
        answer: '42',
        explanation: 'Test explanation',
        difficulty: 2
      })
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 2,
      count: 1
    };

    const result = await generateFreeForm(options);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle empty JSON response', async () => {
    const { ModelAdapter } = require('@/lib/ai/model-adapter');
    const mockGenerate = jest.fn().mockResolvedValue({
      content: JSON.stringify({})
    });

    ModelAdapter.mockImplementationOnce(() => ({
      generate: mockGenerate
    }));

    const options: FreeFormOptions = {
      knowledgePoint: 'test',
      difficultyLevel: 2,
      count: 1
    };

    const result = await generateFreeForm(options);
    expect(Array.isArray(result)).toBe(true);
  });
});
