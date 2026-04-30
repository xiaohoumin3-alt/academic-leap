import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TemplateGenerator } from '../generator';
import { LLMClient } from '../utils/llm-client';

jest.mock('../utils/llm-client');

describe('TemplateGenerator', () => {
  let generator: TemplateGenerator;
  let mockLLM: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLLM = {
      generate: jest.fn(),
    } as unknown as LLMClient;
    generator = new TemplateGenerator(mockLLM);
  });

  it('should generate templates successfully', async () => {
    (mockLLM.generate as jest.Mock).mockResolvedValueOnce({
      content: '{"templates": [{"name": "Test", "template": "Test {x}", "answer": "{x}", "params": {"x": {"type": "range", "min": 1, "max": 10}}, "constraint": "", "steps": [], "hint": "", "difficulty": 1, "cognitiveLoad": 0.2, "reasoningDepth": 0.3, "learningObjective": "Test", "concepts": []}]}',
      parsed: {
        templates: [{
          name: 'Test',
          template: 'Test {x}',
          answer: '{x}',
          params: { x: { type: 'range', min: 1, max: 10 } },
          constraint: '',
          steps: [],
          hint: '',
          difficulty: 1,
          cognitiveLoad: 0.2,
          reasoningDepth: 0.3,
          learningObjective: 'Test',
          concepts: [],
        }]
      },
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    });

    expect(result.summary.successful).toBe(1);
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].name).toBe('Test');
  });

  it('should handle LLM errors gracefully', async () => {
    (mockLLM.generate as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    }, { maxRetries: 0 });

    expect(result.summary.successful).toBe(0);
    expect(result.summary.failed).toBe(1);
  });

  it('should retry on failure', async () => {
    (mockLLM.generate as jest.Mock)
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        content: '{"templates": []}',
        parsed: { templates: [] },
        usage: { promptTokens: 100, completionTokens: 10 },
      });

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    }, { maxRetries: 2 });

    expect(mockLLM.generate).toHaveBeenCalledTimes(2);
  });
});
