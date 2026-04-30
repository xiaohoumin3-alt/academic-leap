import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TemplateValidator } from '../validator';
import { LLMClient } from '../utils/llm-client';

jest.mock('../utils/llm-client');

describe('TemplateValidator', () => {
  let validator: TemplateValidator;
  let mockLLM: LLMClient;

  const mockTemplate = {
    name: 'Test',
    template: 'Solve: {a}x + {b} = {c}',
    answer: 'x = {x}',
    params: { a: { type: 'range', min: 1, max: 10 } },
    constraint: 'a != 0',
    steps: [],
    hint: 'Isolate x',
    difficulty: 2,
    cognitiveLoad: 0.3,
    reasoningDepth: 0.4,
    learningObjective: 'Solve linear equations',
    concepts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLLM = {
      generate: jest.fn(),
    } as unknown as LLMClient;
    validator = new TemplateValidator(mockLLM);
  });

  it('should validate math correctness', async () => {
    (mockLLM.generate as jest.Mock).mockResolvedValueOnce({
      content: '{"passed": true, "issues": [], "confidence": 0.95, "explanation": "Correct"}',
      parsed: { passed: true, issues: [], confidence: 0.95, explanation: 'Correct' },
      usage: { promptTokens: 50, completionTokens: 30 },
    });

    const result = await validator.validateMath(mockTemplate, 'template-1');

    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.issues).toHaveLength(0);
  });

  it('should validate pedagogy quality', async () => {
    (mockLLM.generate as jest.Mock).mockResolvedValueOnce({
      content: '{"passed": true, "score": 85, "issues": [], "explanation": "Good"}',
      parsed: { passed: true, score: 85, issues: [], explanation: 'Good' },
      usage: { promptTokens: 50, completionTokens: 30 },
    });

    const result = await validator.validatePedagogy(
      mockTemplate,
      { knowledgePoint: 'Linear Equations', grade: 7 }
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should run dual validation', async () => {
    (mockLLM.generate as jest.Mock)
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 0.9}',
        parsed: { passed: true, issues: [], confidence: 0.9 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 90, "issues": []}',
        parsed: { passed: true, score: 90, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.overallScore).toBeGreaterThan(80);
    expect(result.recommendation).toBe('approve');
  });

  it('should recommend rejection when math validation fails', async () => {
    (mockLLM.generate as jest.Mock)
      .mockResolvedValueOnce({
        content: '{"passed": false, "issues": ["Incorrect formula"], "confidence": 0.9}',
        parsed: { passed: false, issues: ['Incorrect formula'], confidence: 0.9 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 90, "issues": []}',
        parsed: { passed: true, score: 90, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.recommendation).toBe('reject');
    expect(result.mathCorrectness.passed).toBe(false);
  });

  it('should recommend review for moderate scores', async () => {
    (mockLLM.generate as jest.Mock)
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 0.8}',
        parsed: { passed: true, issues: [], confidence: 0.8 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 70, "issues": ["Could improve hint", "Add more steps"]}',
        parsed: { passed: true, score: 70, issues: ['Could improve hint', 'Add more steps'] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.recommendation).toBe('review');
  });

  it('should validate batch templates', async () => {
    (mockLLM.generate as jest.Mock)
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 0.9}',
        parsed: { passed: true, issues: [], confidence: 0.9 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 85, "issues": []}',
        parsed: { passed: true, score: 85, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 0.95}',
        parsed: { passed: true, issues: [], confidence: 0.95 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 88, "issues": []}',
        parsed: { passed: true, score: 88, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const templates = [mockTemplate, { ...mockTemplate, name: 'Test2' }];
    const results = await validator.validateBatch(templates, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(results).toHaveLength(2);
    expect(results[0].recommendation).toBe('approve');
    expect(results[1].recommendation).toBe('approve');
  });

  it('should handle parsing errors gracefully', async () => {
    (mockLLM.generate as jest.Mock).mockResolvedValueOnce({
      content: 'Invalid JSON',
      parsed: undefined,
      usage: { promptTokens: 50, completionTokens: 20 },
    });

    const result = await validator.validateMath(mockTemplate, 'template-1');

    expect(result.passed).toBe(false);
    expect(result.issues).toContain('Failed to parse validation response');
  });
});
