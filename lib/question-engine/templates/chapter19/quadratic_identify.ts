/**
 * 一元二次方程识别模板
 * 标准式 ax² + bx + c = 0 系数识别
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatSigned,
} from '../../difficulty';

/**
 * 一元二次方程识别模板
 */
export const QuadraticIdentifyTemplate: QuestionTemplate = {
  id: 'quadratic_identify',
  knowledgePoint: 'quadratic_identify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_identify[level] ||
                   DIFFICULTY_CONFIG.quadratic_identify[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { a, b, c } = params;

    return [
      {
        stepId: 's1',
        type: StepType.IDENTIFY_QUADRATIC,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '识别一元二次方程的二次项系数 a',
          inputTarget: 'a 的值',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.IDENTIFY_QUADRATIC,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '识别一元二次方程的一次项系数 b',
          inputTarget: 'b 的值',
          inputHint: '输入数字（注意符号）',
        },
      },
      {
        stepId: 's3',
        type: StepType.IDENTIFY_QUADRATIC,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '识别一元二次方程的常数项 c',
          inputTarget: 'c 的值',
          inputHint: '输入数字（注意符号）',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = formatSigned(b);
    const cStr = formatSigned(c);

    return {
      title: `识别方程 ${a}x² ${bStr}x ${cStr} = 0 的系数`,
      description: '一元二次方程识别',
      context: '标准式 ax² + bx + c = 0（a ≠ 0）',
    };
  },
};
