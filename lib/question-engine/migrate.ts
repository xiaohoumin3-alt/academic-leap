/**
 * v1 to v2 Protocol Migration Tool
 *
 * 将 v1 协议的 StepProtocol 转换为 v2 协议的 StepProtocolV2
 */

import { StepProtocol, StepType } from './protocol';
import { StepProtocolV2, AnswerMode, ExpectedAnswer } from './protocol-v2';

/**
 * StepType 到 v2 协议的映射配置
 */
interface V1ToV2Mapping {
  answerMode: AnswerMode;
  getExpectedAnswer: (step: StepProtocol, params: Record<string, number>) => ExpectedAnswer;
}

/**
 * StepType 映射表
 */
const STEP_TYPE_MAPPING: Record<StepType, V1ToV2Mapping> = {
  // 二次函数
  [StepType.COMPUTE_VERTEX_X]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.h ?? 0 }),
  },
  [StepType.COMPUTE_VERTEX_Y]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.k ?? 0 }),
  },
  [StepType.FINAL_COORDINATE]: {
    answerMode: AnswerMode.COORDINATE,
    getExpectedAnswer: (_step, params) => ({ type: 'coordinate', x: params.h ?? 0, y: params.k ?? 0 }),
  },
  [StepType.COMPUTE_VALUE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, _params) => ({ type: 'number', value: 0 }), // 需要具体计算
  },

  // 勾股定理
  [StepType.PYTHAGOREAN_C_SQUARE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => {
      const a = params.a ?? 0;
      const b = params.b ?? 0;
      return { type: 'number', value: a * a + b * b, tolerance: 0.01 };
    },
  },
  [StepType.PYTHAGOREAN_C]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => {
      const a = params.a ?? 0;
      const b = params.b ?? 0;
      return { type: 'number', value: Math.sqrt(a * a + b * b), tolerance: 0.01 };
    },
  },

  // 一元一次方程
  [StepType.SOLVE_LINEAR_EQUATION]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.x ?? 0 }),
  },

  // 概率统计
  [StepType.COMPUTE_PROBABILITY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.probability ?? 0 }),
  },

  // 二次根式
  [StepType.COMPUTE_SQRT]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: Math.sqrt(params.value ?? 0), tolerance: 0.01 }),
  },
  [StepType.SIMPLIFY_SQRT]: {
    answerMode: AnswerMode.TEXT_INPUT,
    getExpectedAnswer: (_step, _params) => ({ type: 'string', value: '√a' }),
  },
  [StepType.SQRT_PROPERTY]: {
    answerMode: AnswerMode.TEXT_INPUT,
    getExpectedAnswer: (_step, _params) => ({ type: 'string', value: '|a|' }),
  },
  [StepType.SQRT_MIXED]: {
    answerMode: AnswerMode.EXPRESSION,
    getExpectedAnswer: (_step, _params) => ({ type: 'expression', value: '√2 + 1' }),
  },

  // 三角形判定
  [StepType.VERIFY_RIGHT_ANGLE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (_step, params) => ({ type: 'yes_no', value: params.isRightAngle === 1 }),
  },

  // 四边形判定
  [StepType.VERIFY_PARALLELOGRAM]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (_step, params) => ({ type: 'yes_no', value: params.isParallelogram === 1 }),
  },
  [StepType.VERIFY_RECTANGLE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (_step, params) => ({ type: 'yes_no', value: params.isRectangle === 1 }),
  },
  [StepType.VERIFY_RHOMBUS]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (_step, params) => ({ type: 'yes_no', value: params.isRhombus === 1 }),
  },
  [StepType.VERIFY_SQUARE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (_step, params) => ({ type: 'yes_no', value: params.isSquare === 1 }),
  },

  // 一元二次方程
  [StepType.IDENTIFY_QUADRATIC]: {
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    getExpectedAnswer: (_step, _params) => ({ type: 'choice', value: 'quadratic' }),
  },
  [StepType.SOLVE_DIRECT_ROOT]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.x1 ?? 0 }),
  },
  [StepType.SOLVE_COMPLETE_SQUARE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.x ?? 0 }),
  },
  [StepType.SOLVE_QUADRATIC_FORMULA]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.x1 ?? 0 }),
  },
  [StepType.SOLVE_FACTORIZE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.x1 ?? 0 }),
  },
  [StepType.QUADRATIC_APPLICATION]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.answer ?? 0 }),
  },

  // 数据分析
  [StepType.COMPUTE_MEAN]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.mean ?? 0, tolerance: 0.01 }),
  },
  [StepType.COMPUTE_MEDIAN]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.median ?? 0 }),
  },
  [StepType.COMPUTE_MODE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.mode ?? 0 }),
  },
  [StepType.COMPUTE_VARIANCE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.variance ?? 0, tolerance: 0.01 }),
  },
  [StepType.COMPUTE_STDDEV]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.stddev ?? 0, tolerance: 0.01 }),
  },

  // 四边形性质计算
  [StepType.COMPUTE_RECT_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.result ?? 0 }),
  },
  [StepType.COMPUTE_RHOMBUS_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.result ?? 0 }),
  },
  [StepType.COMPUTE_SQUARE_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (_step, params) => ({ type: 'number', value: params.result ?? 0 }),
  },
};

/**
 * 检测步骤协议版本
 */
export function detectProtocolVersion(step: StepProtocol | StepProtocolV2): 'v1' | 'v2' {
  if ('expectedAnswer' in step) {
    return 'v2';
  }
  return 'v1';
}

/**
 * 检测题目协议版本
 */
export function detectQuestionProtocolVersion(steps: StepProtocol[] | StepProtocolV2[]): 'v1' | 'v2' {
  if (steps.length === 0) return 'v1';
  return detectProtocolVersion(steps[0]);
}

/**
 * 将 v1 步骤转换为 v2 步骤
 */
export function migrateStepToV2(
  step: StepProtocol,
  params: Record<string, number>
): StepProtocolV2 {
  const mapping = STEP_TYPE_MAPPING[step.type];

  if (!mapping) {
    throw new Error(`Unknown StepType: ${step.type}`);
  }

  return {
    stepId: step.stepId,
    answerMode: mapping.answerMode,
    ui: {
      instruction: step.ui.instruction,
      inputPlaceholder: step.ui.inputTarget,
      hint: step.ui.inputHint,
    },
    expectedAnswer: mapping.getExpectedAnswer(step, params),
    keyboard: step.keyboard === 'numeric'
      ? { type: 'numeric', extraKeys: [] }
      : undefined,
  };
}

/**
 * 将 v1 题目转换为 v2 题目
 */
export function migrateQuestionToV2(
  steps: StepProtocol[],
  params: Record<string, number>
): StepProtocolV2[] {
  return steps.map(step => migrateStepToV2(step, params));
}
