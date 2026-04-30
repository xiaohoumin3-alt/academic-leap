import { describe, it, expect } from '@jest/globals';
import { buildGenerationPrompt, parseGenerationResponse } from '../generation';

describe('Generation Prompts', () => {
  describe('buildGenerationPrompt', () => {
    it('should build generation prompt with all fields', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: '一元一次方程',
          description: '含有一个未知数，且未知数的次数是1的方程',
        },
        targetStructures: ['linear'],
        targetDepths: [1, 2],
        count: 3,
        context: {
          grade: 7,
          relatedConcepts: ['代数', '等式'],
        },
      });

      expect(prompt).toContain('一元一次方程');
      expect(prompt).toContain('含有一个未知数');
      expect(prompt).toContain('linear');
      expect(prompt).toContain('depth 1');
      expect(prompt).toContain('depth 2');
      expect(prompt).toContain('3个');
      expect(prompt).toContain('7年级');
    });

    it('should include JSON output format in prompt', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: 'Test',
        },
        targetStructures: ['linear'],
        targetDepths: [1],
        count: 1,
        context: { grade: 7, relatedConcepts: [] },
      });

      expect(prompt).toContain('"templates"');
      expect(prompt).toContain('"template"');
      expect(prompt).toContain('"answer"');
      expect(prompt).toContain('"params"');
    });

    it('should handle optional description', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: 'Test',
        },
        targetStructures: ['linear'],
        targetDepths: [1],
        count: 1,
        context: { grade: 7, relatedConcepts: [] },
      });

      expect(prompt).toContain('Test');
      expect(prompt).toContain('1个');
    });

    it('should include textbook when provided', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: 'Test',
          description: 'Test description',
        },
        targetStructures: ['linear'],
        targetDepths: [1],
        count: 1,
        context: {
          grade: 7,
          textbook: '人教版',
          relatedConcepts: [],
        },
      });

      expect(prompt).toContain('人教版');
    });

    it('should handle multiple structures and depths', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: 'Test',
        },
        targetStructures: ['linear', 'nested', 'multi_equation'],
        targetDepths: [1, 2, 3],
        count: 5,
        context: { grade: 8, relatedConcepts: [] },
      });

      expect(prompt).toContain('linear');
      expect(prompt).toContain('nested');
      expect(prompt).toContain('multi_equation');
      expect(prompt).toContain('depth 1');
      expect(prompt).toContain('depth 2');
      expect(prompt).toContain('depth 3');
    });

    it('should show "无" for empty related concepts', () => {
      const prompt = buildGenerationPrompt({
        knowledgePoint: {
          id: 'kp-1',
          name: 'Test',
        },
        targetStructures: ['linear'],
        targetDepths: [1],
        count: 1,
        context: { grade: 7, relatedConcepts: [] },
      });

      expect(prompt).toContain('无');
    });
  });

  describe('parseGenerationResponse', () => {
    it('should parse valid JSON response with templates array', () => {
      const content = JSON.stringify({
        templates: [
          {
            name: 'Test Template',
            template: 'Solve {a}x + {b} = {c}',
            answer: 'x = {x}',
            params: {
              a: { type: 'range', min: 1, max: 10 },
              b: { type: 'range', min: -10, max: 10 },
            },
            constraint: 'a != 0',
            steps: ['Step 1', 'Step 2'],
            hint: 'Hint text',
            difficulty: 3,
            cognitiveLoad: 0.5,
            reasoningDepth: 0.6,
            learningObjective: 'Learn linear equations',
            concepts: ['algebra', 'equations'],
          },
        ],
      });

      const result = parseGenerationResponse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.templates).toHaveLength(1);
      expect(result.templates[0]).toMatchObject({
        name: 'Test Template',
        template: 'Solve {a}x + {b} = {c}',
        difficulty: 3,
      });
    });

    it('should parse JSON from code block', () => {
      const content = `Here's the response:

\`\`\`json
{
  "templates": [
    {
      "name": "Test",
      "template": "Test template",
      "answer": "Test answer",
      "params": {},
      "constraint": "",
      "steps": [],
      "hint": "",
      "difficulty": 1,
      "cognitiveLoad": 0.5,
      "reasoningDepth": 0.5,
      "learningObjective": "",
      "concepts": []
    }
  ]
}
\`\`\`

Hope this helps!`;

      const result = parseGenerationResponse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.templates).toHaveLength(1);
    });

    it('should parse JSON from code block without json tag', () => {
      const content = `\`\`\`
{
  "templates": []
}
\`\`\``;

      const result = parseGenerationResponse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.templates).toHaveLength(0);
    });

    it('should return error for invalid JSON', () => {
      const content = 'This is not valid JSON';

      const result = parseGenerationResponse(content);

      expect(result.templates).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Unexpected token');
    });

    it('should return error for JSON without templates array', () => {
      const content = JSON.stringify({
        something: 'else',
      });

      const result = parseGenerationResponse(content);

      expect(result.templates).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty templates array', () => {
      const content = JSON.stringify({
        templates: [],
      });

      const result = parseGenerationResponse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.templates).toHaveLength(0);
    });

    it('should handle multiple templates', () => {
      const content = JSON.stringify({
        templates: [
          {
            name: 'Template 1',
            template: 'T1',
            answer: 'A1',
            params: {},
            constraint: '',
            steps: [],
            hint: '',
            difficulty: 1,
            cognitiveLoad: 0.5,
            reasoningDepth: 0.5,
            learningObjective: '',
            concepts: [],
          },
          {
            name: 'Template 2',
            template: 'T2',
            answer: 'A2',
            params: {},
            constraint: '',
            steps: [],
            hint: '',
            difficulty: 2,
            cognitiveLoad: 0.6,
            reasoningDepth: 0.6,
            learningObjective: '',
            concepts: [],
          },
        ],
      });

      const result = parseGenerationResponse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.templates).toHaveLength(2);
    });
  });
});
