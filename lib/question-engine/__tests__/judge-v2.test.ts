/**
 * 判题引擎 v2 单元测试
 */

import { judgeStepV2 } from '../judge-v2';
import { AnswerMode } from '../protocol-v2';

describe('judge-v2', () => {
  describe('judgeNumber', () => {
    it('should accept correct number', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      const result = judgeStepV2(step, '5');
      expect(result.isCorrect).toBe(true);
      expect(result.errorType).toBe(null);
    });

    it('should reject wrong number', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      const result = judgeStepV2(step, '3');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('calculation_error');
    });

    it('should handle tolerance', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5, tolerance: 0.1 },
      };
      const result = judgeStepV2(step, '5.05');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject invalid number format', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      const result = judgeStepV2(step, 'abc');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('format_error');
    });

    it('should handle decimal numbers', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 3.14159, tolerance: 0.01 },
      };
      const result = judgeStepV2(step, '3.14');
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('judgeString', () => {
    it('should accept exact string match', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'string' as const, value: 'hello' },
      };
      const result = judgeStepV2(step, 'hello');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept case-insensitive match', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'string' as const, value: 'Hello' },
      };
      const result = judgeStepV2(step, 'HELLO');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept variant strings', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'string' as const, value: 'correct', variants: ['right', 'yes'] },
      };
      expect(judgeStepV2(step, 'right').isCorrect).toBe(true);
      expect(judgeStepV2(step, 'yes').isCorrect).toBe(true);
    });

    it('should accept partial match (substring)', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'string' as const, value: 'triangle' },
      };
      const result = judgeStepV2(step, 'the triangle is');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong string', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'string' as const, value: 'hello' },
      };
      const result = judgeStepV2(step, 'goodbye');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('concept_error');
    });
  });

  describe('judgeYesNo', () => {
    it('should accept "yes" for true', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: true },
      };
      const result = judgeStepV2(step, 'yes');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept "true" for true', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: true },
      };
      const result = judgeStepV2(step, 'true');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept "no" for false', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: false },
      };
      const result = judgeStepV2(step, 'no');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject "yes" for false', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: false },
      };
      const result = judgeStepV2(step, 'yes');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('concept_error');
    });
  });

  describe('judgeChoice', () => {
    it('should accept correct single choice', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MULTIPLE_CHOICE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'choice' as const, value: 'A' },
      };
      const result = judgeStepV2(step, 'A');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept correct multiple choices (order-insensitive)', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MULTIPLE_CHOICE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'choice' as const, value: ['A', 'B', 'C'] },
      };
      expect(judgeStepV2(step, 'A,B,C').isCorrect).toBe(true);
      expect(judgeStepV2(step, 'C,B,A').isCorrect).toBe(true);
    });

    it('should reject wrong single choice', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MULTIPLE_CHOICE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'choice' as const, value: 'A' },
      };
      const result = judgeStepV2(step, 'B');
      expect(result.isCorrect).toBe(false);
    });

    it('should reject incomplete multiple choice', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MULTIPLE_CHOICE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'choice' as const, value: ['A', 'B', 'C'] },
      };
      const result = judgeStepV2(step, 'A,B');
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('judgeCoordinate', () => {
    it('should accept correct coordinate format (x, y)', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      expect(judgeStepV2(step, '(3, 4)').isCorrect).toBe(true);
      expect(judgeStepV2(step, '3, 4').isCorrect).toBe(true);
      expect(judgeStepV2(step, '[3, 4]').isCorrect).toBe(true);
    });

    it('should accept coordinates with Chinese comma', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      const result = judgeStepV2(step, '3，4');
      expect(result.isCorrect).toBe(true);
    });

    it('should handle tolerance', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4, tolerance: 0.5 },
      };
      const result = judgeStepV2(step, '3.3, 4.2');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong coordinate', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      const result = judgeStepV2(step, '(5, 6)');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('calculation_error');
    });

    it('should reject invalid coordinate format', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      const result = judgeStepV2(step, 'invalid');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('format_error');
    });

    it('should handle negative coordinates', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: -3, y: -4 },
      };
      const result = judgeStepV2(step, '(-3, -4)');
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('judgeExpression', () => {
    it('should accept exact expression match', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.EXPRESSION,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'expression' as const, value: '2x + 3 = 7' },
      };
      const result = judgeStepV2(step, '2x + 3 = 7');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept simplified form', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.EXPRESSION,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'expression' as const, value: 'x = (7 - 3) / 2', simplified: 'x = 2' },
      };
      const result = judgeStepV2(step, 'x = 2');
      expect(result.isCorrect).toBe(true);
    });

    it('should ignore whitespace', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.EXPRESSION,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'expression' as const, value: '2x+3=7' },
      };
      const result = judgeStepV2(step, '2x + 3 = 7');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong expression', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.EXPRESSION,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'expression' as const, value: 'x = 2' },
      };
      const result = judgeStepV2(step, 'x = 3');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('calculation_error');
    });
  });

  describe('judgeMultiFill', () => {
    it('should accept all correct values', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.FILL_BLANK,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'multi_fill' as const, values: ['apple', 'banana', 'cherry'] },
      };
      const result = judgeStepV2(step, 'apple, banana, cherry');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept numeric values', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.FILL_BLANK,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'multi_fill' as const, values: [1, 2, 3] },
      };
      const result = judgeStepV2(step, '1 2 3');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept mixed string and number values', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.FILL_BLANK,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'multi_fill' as const, values: ['first', 2, 'third'] },
      };
      const result = judgeStepV2(step, 'first, 2, third');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong number of values', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.FILL_BLANK,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'multi_fill' as const, values: ['a', 'b', 'c'] },
      };
      const result = judgeStepV2(step, 'a, b');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('format_error');
    });

    it('should report partial correctness', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.FILL_BLANK,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'multi_fill' as const, values: ['a', 'b', 'c'] },
      };
      const result = judgeStepV2(step, 'a, x, c');
      expect(result.isCorrect).toBe(false);
      expect(result.hint).toBe('2/3 正确');
    });
  });

  describe('judgeOrder', () => {
    it('should accept correct order', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.ORDER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'order' as const, value: ['first', 'second', 'third'] },
      };
      const result = judgeStepV2(step, 'first second third');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept comma-separated order', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.ORDER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'order' as const, value: ['A', 'B', 'C'] },
      };
      const result = judgeStepV2(step, 'A,B,C');
      expect(result.isCorrect).toBe(true);
    });

    it('should be case-insensitive', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.ORDER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'order' as const, value: ['First', 'Second', 'Third'] },
      };
      const result = judgeStepV2(step, 'FIRST SECOND THIRD');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong order', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.ORDER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'order' as const, value: ['A', 'B', 'C'] },
      };
      const result = judgeStepV2(step, 'A C B');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('concept_error');
    });

    it('should reject incomplete order', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.ORDER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'order' as const, value: ['A', 'B', 'C'] },
      };
      const result = judgeStepV2(step, 'A B');
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('judgeMatch', () => {
    it('should accept correct matching pairs', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: '1', B: '2', C: '3' } },
      };
      const result = judgeStepV2(step, 'A1,B2,C3');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept colon separator', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: '1', B: '2' } },
      };
      const result = judgeStepV2(step, 'A:1,B:2');
      expect(result.isCorrect).toBe(true);
    });

    it('should accept arrow separator', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: '1', B: '2' } },
      };
      const result = judgeStepV2(step, 'A→1,B→2');
      expect(result.isCorrect).toBe(true);
    });

    it('should be case-insensitive', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: 'One', B: 'Two' } },
      };
      const result = judgeStepV2(step, 'a:one,b:two');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject wrong matching', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: '1', B: '2', C: '3' } },
      };
      const result = judgeStepV2(step, 'A1,B3,C2');
      expect(result.isCorrect).toBe(false);
      expect(result.hint).toBe('1/3 正确');
    });

    it('should report partial correctness', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.MATCH,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'match' as const, value: { A: '1', B: '2', C: '3' } },
      };
      const result = judgeStepV2(step, 'A1,B:wrong,C3');
      expect(result.isCorrect).toBe(false);
      expect(result.hint).toBe('2/3 正确');
    });
  });

  describe('unknown type', () => {
    it('should return system error for unknown type', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.TEXT_INPUT,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'unknown' as any, value: 'test' },
      };
      const result = judgeStepV2(step, 'test');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('system_error');
      expect(result.hint).toBe('题目配置错误，请联系管理员');
    });
  });
});
