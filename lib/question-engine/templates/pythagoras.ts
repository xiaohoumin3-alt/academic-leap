/**
 * 勾股定理题目模板
 */

import {
  QuestionTemplate,
  StepType,
} from '../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatNumber,
} from '../difficulty';

/**
 * 勾股定理模板
 */
export const PythagorasTemplate: QuestionTemplate = {
  id: 'pythagoras_v1',
  knowledgePoint: 'pythagoras_theorem',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.pythagoras[level] ||
                   DIFFICULTY_CONFIG.pythagoras[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { a, b } = params;
    const cSquared = a * a + b * b;
    const c = Math.sqrt(cSquared);

    return [
      {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '将两条直角边代入勾股定理，求 c² 的值',
          inputTarget: 'c² 的值',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '对 c² 开平方，求斜边长度（保留两位小数）',
          inputTarget: '斜边长度 c',
          inputHint: '输入数字，保留两位小数',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b } = params;
    return {
      title: `直角三角形两条直角边长分别为 ${a} 和 ${b}，求斜边长度（保留两位小数）`,
      description: '勾股定理',
      context: '使用勾股定理：c² = a² + b²',
    };
  },
};
