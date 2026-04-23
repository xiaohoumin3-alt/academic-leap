/**
 * 二次函数题目模板
 */

import {
  QuestionTemplate,
  StepProtocol,
  StepType,
} from '../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatSigned,
  formatNumber,
} from '../difficulty';

/**
 * 二次函数-顶点坐标模板
 */
export const QuadraticVertexTemplate: QuestionTemplate = {
  id: 'quadratic_vertex_v1',
  knowledgePoint: 'quadratic_function',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_vertex[level] ||
                   DIFFICULTY_CONFIG.quadratic_vertex[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { a, b, c } = params;

    // 计算正确答案
    const x = -b / (2 * a);
    const y = (4 * a * c - b * b) / (4 * a);

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_VERTEX_X,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: `使用顶点公式 x = -b/(2a) 计算顶点 x 坐标`,
          inputTarget: '顶点 x 坐标',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.COMPUTE_VERTEX_Y,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: `将 x = ${formatNumber(x)} 代入方程计算顶点 y 坐标`,
          inputTarget: '顶点 y 坐标',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's3',
        type: StepType.FINAL_COORDINATE,
        inputType: 'coordinate',
        keyboard: 'coordinate',
        answerType: 'coordinate',
        ui: {
          instruction: '写出顶点坐标',
          inputTarget: '顶点坐标',
          inputHint: '格式：(x, y)',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    return {
      title: `已知 y = ${a}x² ${formatSigned(b)}x ${formatSigned(c)}，求顶点坐标`,
      description: '二次函数顶点',
      context: `使用顶点公式：x = -b/(2a), y = (4ac-b²)/(4a)`,
    };
  },
};

/**
 * 二次函数-求值模板
 */
export const QuadraticEvaluateTemplate: QuestionTemplate = {
  id: 'quadratic_evaluate_v1',
  knowledgePoint: 'quadratic_function',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_evaluate[level] ||
                   DIFFICULTY_CONFIG.quadratic_evaluate[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { a, b, c, x } = params;
    const y = a * x * x + b * x + c;

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_VALUE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: `将 x = ${x} 代入方程，求 y 的值`,
          inputTarget: 'y 的值',
          inputHint: '输入数字',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c, x } = params;
    return {
      title: `已知 y = ${a}x² ${formatSigned(b)}x ${formatSigned(c)}，求 x = ${x} 时的 y 值`,
      description: '二次函数求值',
      context: `将 x = ${x} 代入方程计算`,
    };
  },
};
