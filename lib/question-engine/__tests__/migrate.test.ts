/**
 * Tests for v1 to v2 protocol migration
 */

import { migrateStepToV2, migrateQuestionToV2, detectProtocolVersion, detectQuestionProtocolVersion } from '../migrate';
import { StepProtocol, StepType } from '../protocol';
import { StepProtocolV2, AnswerMode } from '../protocol-v2';

describe('migrate', () => {
  describe('detectProtocolVersion', () => {
    it('should detect v1 protocol', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: 'Test',
          inputTarget: 'c',
          inputHint: 'Hint',
        },
      };
      expect(detectProtocolVersion(v1Step)).toBe('v1');
    });

    it('should detect v2 protocol', () => {
      const v2Step: StepProtocolV2 = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number', value: 5 },
      };
      expect(detectProtocolVersion(v2Step)).toBe('v2');
    });

    it('should detect v1 protocol for empty steps array', () => {
      expect(detectQuestionProtocolVersion([])).toBe('v1');
    });
  });

  describe('detectQuestionProtocolVersion', () => {
    it('should detect v1 from steps array', () => {
      const v1Steps: StepProtocol[] = [
        {
          stepId: 's1',
          type: StepType.PYTHAGOREAN_C,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          ui: {
            instruction: 'Test',
            inputTarget: 'c',
            inputHint: 'Hint',
          },
        },
      ];
      expect(detectQuestionProtocolVersion(v1Steps)).toBe('v1');
    });

    it('should detect v2 from steps array', () => {
      const v2Steps: StepProtocolV2[] = [
        {
          stepId: 's1',
          answerMode: AnswerMode.NUMBER,
          ui: { instruction: 'Test' },
          expectedAnswer: { type: 'number', value: 5 },
        },
      ];
      expect(detectQuestionProtocolVersion(v2Steps)).toBe('v2');
    });
  });

  describe('migrateStepToV2', () => {
    it('should migrate PYTHAGOREAN_C step', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '求斜边 c',
          inputTarget: 'c',
          inputHint: '使用勾股定理',
        },
      };
      const params = { a: 3, b: 4 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.NUMBER);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'number',
        value: 5,
        tolerance: 0.01,
      });
      expect(v2Step.ui.instruction).toBe('求斜边 c');
      expect(v2Step.ui.inputPlaceholder).toBe('c');
      expect(v2Step.ui.hint).toBe('使用勾股定理');
      expect(v2Step.keyboard).toEqual({ type: 'numeric', extraKeys: [] });
    });

    it('should migrate PYTHAGOREAN_C_SQUARE step', () => {
      const v1Step: StepProtocol = {
        stepId: 's2',
        type: StepType.PYTHAGOREAN_C_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '求 c²',
          inputTarget: 'c²',
          inputHint: 'c² = a² + b²',
        },
      };
      const params = { a: 3, b: 4 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.NUMBER);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'number',
        value: 25,
        tolerance: 0.01,
      });
    });

    it('should migrate VERIFY_SQUARE step', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.VERIFY_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '是正方形吗？',
          inputTarget: '是/否',
          inputHint: '输入1表示是，0表示否',
        },
      };
      const params = { isSquare: 1 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.YES_NO);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'yes_no',
        value: true,
      });
    });

    it('should migrate VERIFY_SQUARE with false value', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.VERIFY_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '是正方形吗？',
          inputTarget: '是/否',
          inputHint: '输入1表示是，0表示否',
        },
      };
      const params = { isSquare: 0 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.YES_NO);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'yes_no',
        value: false,
      });
    });

    it('should migrate FINAL_COORDINATE step', () => {
      const v1Step: StepProtocol = {
        stepId: 's3',
        type: StepType.FINAL_COORDINATE,
        inputType: 'coordinate',
        keyboard: 'coordinate',
        answerType: 'coordinate',
        ui: {
          instruction: '顶点坐标',
          inputTarget: '(h,k)',
          inputHint: '格式：(h,k)',
        },
      };
      const params = { h: 2, k: -3 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.COORDINATE);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'coordinate',
        x: 2,
        y: -3,
      });
    });

    it('should migrate COMPUTE_MEAN step', () => {
      const v1Step: StepProtocol = {
        stepId: 's4',
        type: StepType.COMPUTE_MEAN,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '计算平均值',
          inputTarget: 'mean',
          inputHint: 'mean = sum/n',
        },
      };
      const params = { mean: 85.5 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.NUMBER);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'number',
        value: 85.5,
        tolerance: 0.01,
      });
    });

    it('should migrate IDENTIFY_QUADRATIC step', () => {
      const v1Step: StepProtocol = {
        stepId: 's5',
        type: StepType.IDENTIFY_QUADRATIC,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '识别方程类型',
          inputTarget: '类型',
          inputHint: '二次方程',
        },
      };
      const params = {};

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.MULTIPLE_CHOICE);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'choice',
        value: 'quadratic',
      });
    });

    it('should not include keyboard for non-numeric keyboard types', () => {
      const v1Step: StepProtocol = {
        stepId: 's7',
        type: StepType.VERIFY_RECTANGLE,
        inputType: 'numeric',
        keyboard: 'full',
        answerType: 'number',
        ui: {
          instruction: '是矩形吗？',
          inputTarget: '是/否',
          inputHint: '',
        },
      };
      const params = { isRectangle: 1 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.keyboard).toBeUndefined();
    });

    it('should throw error for unknown StepType', () => {
      const v1Step: StepProtocol = {
        stepId: 's8',
        type: 'unknown_type' as StepType,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: 'Unknown',
          inputTarget: '?',
          inputHint: '',
        },
      };
      const params = {};

      expect(() => migrateStepToV2(v1Step, params)).toThrow('Unknown StepType: unknown_type');
    });
  });

  describe('migrateQuestionToV2', () => {
    it('should migrate multiple steps', () => {
      const v1Steps: StepProtocol[] = [
        {
          stepId: 's1',
          type: StepType.PYTHAGOREAN_C_SQUARE,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          ui: {
            instruction: '求 c²',
            inputTarget: 'c²',
            inputHint: '',
          },
        },
        {
          stepId: 's2',
          type: StepType.PYTHAGOREAN_C,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          ui: {
            instruction: '求 c',
            inputTarget: 'c',
            inputHint: '',
          },
        },
      ];
      const params = { a: 3, b: 4 };

      const v2Steps = migrateQuestionToV2(v1Steps, params);

      expect(v2Steps).toHaveLength(2);
      expect(v2Steps[0].stepId).toBe('s1');
      expect(v2Steps[0].expectedAnswer).toEqual({
        type: 'number',
        value: 25,
        tolerance: 0.01,
      });
      expect(v2Steps[1].stepId).toBe('s2');
      expect(v2Steps[1].expectedAnswer).toEqual({
        type: 'number',
        value: 5,
        tolerance: 0.01,
      });
    });

    it('should preserve step order', () => {
      const v1Steps: StepProtocol[] = [
        {
          stepId: 'step1',
          type: StepType.COMPUTE_VERTEX_X,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          ui: {
            instruction: '求 h',
            inputTarget: 'h',
            inputHint: '',
          },
        },
        {
          stepId: 'step2',
          type: StepType.COMPUTE_VERTEX_Y,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          ui: {
            instruction: '求 k',
            inputTarget: 'k',
            inputHint: '',
          },
        },
        {
          stepId: 'step3',
          type: StepType.FINAL_COORDINATE,
          inputType: 'coordinate',
          keyboard: 'coordinate',
          answerType: 'coordinate',
          ui: {
            instruction: '顶点坐标',
            inputTarget: '(h,k)',
            inputHint: '',
          },
        },
      ];
      const params = { h: 1, k: 2 };

      const v2Steps = migrateQuestionToV2(v1Steps, params);

      expect(v2Steps[0].stepId).toBe('step1');
      expect(v2Steps[1].stepId).toBe('step2');
      expect(v2Steps[2].stepId).toBe('step3');
    });
  });
});
