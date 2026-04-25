/**
 * 菱形性质计算模板
 * 性质：四条边相等、对角线互相垂直平分
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 菱形性质计算模板
 */
export const RhombusPropertyTemplate: QuestionTemplate = {
  id: 'rhombus_property',
  knowledgePoint: 'rhombus_property',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.rhombus_property[level] ||
                   DIFFICULTY_CONFIG.rhombus_property[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { side, diagonal1, diagonal2 } = params;

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_RHOMBUS_PROPERTY,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '利用菱形对角线互相垂直平分的性质，求对角线一半的平方和',
          inputTarget: '(d₁/2)² + (d₂/2)² 的值',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.COMPUTE_RHOMBUS_PROPERTY,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '根据勾股定理，求菱形的边长',
          inputTarget: '边长 a 的值',
          inputHint: '输入数字',
        },
      },
    ];
  },

  render: (params) => {
    const { side, diagonal1, diagonal2 } = params;

    return {
      title: `菱形 ABCD 的对角线分别为 ${diagonal1} 和 ${diagonal2}，求其边长`,
      description: '菱形性质计算',
      context: '菱形性质：四条边相等，对角线互相垂直平分',
    };
  },
};
