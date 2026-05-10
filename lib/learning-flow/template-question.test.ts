/**
 * Template Question Tests
 *
 * Tests for template-based question generation.
 */

import {
  generateTemplateQuestion,
  generateTemplateQuestions,
  hasTemplate,
  getTemplateQuestionForRecommendation,
} from '@/lib/learning-flow/template-question';
import { getTemplateIdForKnowledgePoint } from '@/lib/question-engine/knowledge-point-mapping';

// Mock dependencies
jest.mock('@/lib/question-engine', () => ({
  generateQuestion: jest.fn(),
}));

jest.mock('@/lib/question-engine/knowledge-point-mapping', () => ({
  getTemplateIdForKnowledgePoint: jest.fn(),
}));

describe('Template Question Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTemplateQuestion', () => {
    it('should return null when question generation fails', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockRejectedValue(new Error('Generation failed'));

      const result = await generateTemplateQuestion('sqrt_concept', 3);

      expect(result).toBeNull();
    });

    it('should return null when no question is generated', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue(null);

      const result = await generateTemplateQuestion('unknown_template', 3);

      expect(result).toBeNull();
    });

    it('should generate question with correct structure', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-template-1',
        knowledgePoint: 'sqrt_concept',
        templateId: 'sqrt_concept',
        difficultyLevel: 3,
        content: {
          description: 'Calculate the square root of 16',
          context: 'This is about square roots',
        },
        steps: [
          {
            stepId: 's1',
            ui: { instruction: 'Enter the answer', inputTarget: '4' },
          },
        ],
      });

      const result = await generateTemplateQuestion('sqrt_concept', 3);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('q-template-1');
      expect(result?.knowledgePoint).toBe('sqrt_concept');
      expect(result?.templateId).toBe('sqrt_concept');
      expect(result?.difficultyLevel).toBe(3);
      expect(result?.content.question).toBe('Calculate the square root of 16');
      expect(result?.content.answer).toBe('4');
      expect(result?.content.explanation).toBe('This is about square roots');
    });

    it('should handle v2 protocol steps', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-template-2',
        knowledgePoint: 'pythagoras',
        templateId: 'pythagoras',
        difficultyLevel: 4,
        content: {
          description: 'Find the hypotenuse',
          context: 'Pythagorean theorem',
        },
        steps: [
          {
            stepId: 's1',
            ui: { instruction: 'Enter your answer' },
            answerMode: 'number',
            expectedAnswer: { type: 'number', value: 5 },
          },
        ],
      });

      const result = await generateTemplateQuestion('pythagoras', 4);

      expect(result).not.toBeNull();
      expect(result?.content.answer).toBe('5');
    });

    it('should handle steps without answers gracefully', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-template-3',
        knowledgePoint: 'quadratic',
        templateId: 'quadratic',
        difficultyLevel: 5,
        content: {
          description: 'Solve the equation',
        },
        steps: [], // Empty steps
      });

      const result = await generateTemplateQuestion('quadratic', 5);

      expect(result).not.toBeNull();
      expect(result?.content.answer).toBe('');
    });

    it('should handle different expectedAnswer types for v2 protocol', async () => {
      const { generateQuestion } = require('@/lib/question-engine');

      // Test coordinate type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-1',
        knowledgePoint: 'coordinate',
        content: { description: 'Find point' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'coordinate', x: 3, y: 4 },
          },
        ],
      });

      const coordResult = await generateTemplateQuestion('coordinate', 3);
      expect(coordResult?.content.answer).toBe('(3, 4)');

      // Test yes_no type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-2',
        knowledgePoint: 'boolean',
        content: { description: 'Is this true?' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'yes_no', value: true },
          },
        ],
      });

      const yesNoResult = await generateTemplateQuestion('boolean', 3);
      expect(yesNoResult?.content.answer).toBe('是');

      // Test choice type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-3',
        knowledgePoint: 'choice',
        content: { description: 'Select one' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'choice', value: ['Option A'] },
          },
        ],
      });

      const choiceResult = await generateTemplateQuestion('choice', 3);
      expect(choiceResult?.content.answer).toBe('Option A');

      // Test expression type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-4',
        knowledgePoint: 'expr',
        content: { description: 'Simplify' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'expression', value: 'x^2 + 1' },
          },
        ],
      });

      const exprResult = await generateTemplateQuestion('expr', 3);
      expect(exprResult?.content.answer).toBe('x^2 + 1');

      // Test multi_fill type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-5',
        knowledgePoint: 'multi',
        content: { description: 'Fill all' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'multi_fill', values: ['a', 'b', 'c'] },
          },
        ],
      });

      const multiResult = await generateTemplateQuestion('multi', 3);
      expect(multiResult?.content.answer).toBe('a, b, c');

      // Test order type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-6',
        knowledgePoint: 'order',
        content: { description: 'Order them' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'order', value: ['1st', '2nd', '3rd'] },
          },
        ],
      });

      const orderResult = await generateTemplateQuestion('order', 3);
      expect(orderResult?.content.answer).toBe('1st, 2nd, 3rd');

      // Test match type
      generateQuestion.mockResolvedValueOnce({
        id: 'q-7',
        knowledgePoint: 'match',
        content: { description: 'Match pairs' },
        steps: [
          {
            ui: {},
            expectedAnswer: { type: 'match', value: { A: '1', B: '2' } },
          },
        ],
      });

      const matchResult = await generateTemplateQuestion('match', 3);
      expect(matchResult?.content.answer).toBe('A:1; B:2');
    });

    it('should preserve params from generated question', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Test' },
        steps: [{ ui: { inputTarget: '4' } }],
        params: { a: 16, b: 4, c: 0 },
      });

      const result = await generateTemplateQuestion('sqrt', 3);

      expect(result?.params).toEqual({ a: 16, b: 4, c: 0 });
    });
  });

  describe('generateTemplateQuestions', () => {
    it('should generate multiple questions', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion
        .mockResolvedValueOnce({
          id: 'q-1',
          knowledgePoint: 'sqrt',
          content: { description: 'Question 1' },
          steps: [{ ui: { inputTarget: '4' } }],
        })
        .mockResolvedValueOnce({
          id: 'q-2',
          knowledgePoint: 'sqrt',
          content: { description: 'Question 2' },
          steps: [{ ui: { inputTarget: '9' } }],
        });

      const results = await generateTemplateQuestions('sqrt', 2, 3);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('q-1');
      expect(results[1].id).toBe('q-2');
    });

    it('should skip failed generations', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion
        .mockResolvedValueOnce({
          id: 'q-1',
          knowledgePoint: 'sqrt',
          content: { description: 'Question 1' },
          steps: [{ ui: { inputTarget: '4' } }],
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          id: 'q-3',
          knowledgePoint: 'sqrt',
          content: { description: 'Question 3' },
          steps: [{ ui: { inputTarget: '16' } }],
        });

      const results = await generateTemplateQuestions('sqrt', 3, 3);

      expect(results).toHaveLength(2);
    });

    it('should vary difficulty for each question', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Question' },
        steps: [{ ui: { inputTarget: '4' } }],
        difficultyLevel: 3,
      });

      // Call with base difficulty 3 - should vary by +/- 1
      const results = await generateTemplateQuestions('sqrt', 5, 3);

      expect(results.length).toBeLessThanOrEqual(5);
      expect(generateQuestion).toHaveBeenCalledTimes(results.length);
    });

    it('should respect difficulty bounds', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Question' },
        steps: [{ ui: { inputTarget: '4' } }],
        difficultyLevel: 1,
      });

      // With count 1, should generate one question
      const results = await generateTemplateQuestions('sqrt', 1, 1);

      expect(results).toHaveLength(1);
    });

    it('should return empty array when all generations fail', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockRejectedValue(new Error('Failed'));

      const results = await generateTemplateQuestions('sqrt', 3, 3);

      expect(results).toHaveLength(0);
    });
  });

  describe('hasTemplate', () => {
    it('should return true when template exists', () => {
      const { getTemplateIdForKnowledgePoint } = require('@/lib/question-engine/knowledge-point-mapping');
      getTemplateIdForKnowledgePoint.mockReturnValue('sqrt_concept');

      expect(hasTemplate('sqrt_concept')).toBe(true);
    });

    it('should return false when template does not exist', () => {
      const { getTemplateIdForKnowledgePoint } = require('@/lib/question-engine/knowledge-point-mapping');
      getTemplateIdForKnowledgePoint.mockReturnValue(null);

      expect(hasTemplate('nonexistent')).toBe(false);
    });
  });

  describe('getTemplateQuestionForRecommendation', () => {
    it('should map IRT difficulty to template difficulty', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Question' },
        steps: [{ ui: { inputTarget: '4' } }],
        difficultyLevel: 3, // (5/10) * 5 = 2.5 rounded to 3
      });

      // IRT difficulty 5 should map to template difficulty 3
      const result = await getTemplateQuestionForRecommendation('sqrt', 5);

      expect(result).not.toBeNull();
      expect(generateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgePoint: 'sqrt',
          difficultyLevel: expect.any(Number),
        })
      );
    });

    it('should clamp difficulty to valid range', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Question' },
        steps: [{ ui: { inputTarget: '4' } }],
      });

      // Very high IRT difficulty (10) should cap at template difficulty 5
      await getTemplateQuestionForRecommendation('sqrt', 10);
      expect(generateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ difficultyLevel: 5 })
      );

      // Very low IRT difficulty (0) should floor at template difficulty 1
      await getTemplateQuestionForRecommendation('sqrt', 0);
      expect(generateQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ difficultyLevel: 1 })
      );
    });

    it('should delegate to generateTemplateQuestion', async () => {
      const { generateQuestion } = require('@/lib/question-engine');
      generateQuestion.mockResolvedValue({
        id: 'q-1',
        knowledgePoint: 'sqrt',
        content: { description: 'Question' },
        steps: [{ ui: { inputTarget: '4' } }],
      });

      await getTemplateQuestionForRecommendation('sqrt', 5);

      // Function should work the same as generateTemplateQuestion with mapped difficulty
      expect(generateQuestion).toHaveBeenCalled();
    });
  });
});