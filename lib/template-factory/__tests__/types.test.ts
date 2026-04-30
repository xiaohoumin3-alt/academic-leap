import { describe, it, expect } from '@jest/globals';
import type {
  KnowledgeGap,
  GenerationRequest,
  GeneratedTemplate,
  ValidationResult,
  QualityScore,
} from '../types';

describe('Template Factory Types', () => {
  it('should accept valid KnowledgeGap', () => {
    const gap: KnowledgeGap = {
      knowledgePointId: 'kp-1',
      knowledgePointName: 'Linear Equations',
      currentTemplateCount: 2,
      targetTemplateCount: 5,
      gap: 3,
      priority: 'high',
      estimatedDifficulty: 'medium',
    };
    expect(gap.gap).toBe(3);
  });

  it('should accept valid GenerationRequest', () => {
    const request: GenerationRequest = {
      knowledgePoint: {
        id: 'kp-1',
        name: 'Linear Equations',
      },
      targetStructures: ['linear'],
      targetDepths: [1, 2],
      count: 3,
      context: {
        grade: 7,
        relatedConcepts: ['algebra', 'variables'],
      },
    };
    expect(request.count).toBe(3);
  });

  it('should accept valid GeneratedTemplate', () => {
    const template: GeneratedTemplate = {
      name: 'Basic Linear Equation',
      template: 'Solve for x: {a}x + {b} = {c}',
      answer: 'x = {x}',
      params: {
        a: { type: 'range', min: 1, max: 10 },
        b: { type: 'range', min: -10, max: 10 },
        c: { type: 'range', min: -20, max: 20 },
      },
      constraint: 'a != 0',
      steps: ['Subtract b from both sides', 'Divide by a'],
      hint: 'Isolate x by doing inverse operations',
      difficulty: 2,
      cognitiveLoad: 0.3,
      reasoningDepth: 0.4,
      learningObjective: 'Solve one-step linear equations',
      concepts: ['linear-equations', 'inverse-operations'],
    };
    expect(template.difficulty).toBe(2);
  });
});
