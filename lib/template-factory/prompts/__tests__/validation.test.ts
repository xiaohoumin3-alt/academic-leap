import { describe, it, expect } from '@jest/globals';
import { buildMathValidationPrompt, buildPedagogyValidationPrompt } from '../validation';

describe('Validation Prompts', () => {
  const mockTemplate = {
    name: 'Basic Linear Equation',
    template: '解方程: {a}x + {b} = {c}',
    answer: 'x = {x}',
    params: {
      a: { type: 'range', min: 1, max: 10 },
      b: { type: 'range', min: -10, max: 10 },
    },
    constraint: 'a != 0',
    steps: [],
    hint: 'Isolate x',
    difficulty: 2,
    cognitiveLoad: 0.3,
    reasoningDepth: 0.4,
    learningObjective: 'Solve linear equations',
    concepts: [],
  };

  it('should build math validation prompt', () => {
    const prompt = buildMathValidationPrompt(mockTemplate);

    expect(prompt).toContain('数学正确性验证');
    expect(prompt).toContain('解方程: {a}x + {b} = {c}');
    expect(prompt).toContain('x = {x}');
    expect(prompt).toContain('passed');
  });

  it('should build pedagogy validation prompt', () => {
    const prompt = buildPedagogyValidationPrompt(mockTemplate, {
      knowledgePoint: '一元一次方程',
      grade: 7,
    });

    expect(prompt).toContain('教学有效性验证');
    expect(prompt).toContain('一元一次方程');
    expect(prompt).toContain('7年级');
    expect(prompt).toContain('score');
  });
});
