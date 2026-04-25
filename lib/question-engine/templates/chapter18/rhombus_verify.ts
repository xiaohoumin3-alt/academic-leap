/**
 * 菱形判定模板
 * 判定：四条边相等 / 对角线互相垂直的平行四边形
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
 * 菱形判定模板
 */
export const RhombusVerifyTemplate: QuestionTemplate = {
  id: 'rhombus_verify',
  knowledgePoint: 'rhombus_verify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.rhombus_verify[level] ||
                   DIFFICULTY_CONFIG.rhombus_verify[1];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { sideAB, sideBC, sideCD, sideDA, isEqual, parallelogram } = params;

    return [
      {
        stepId: 's1',
        type: StepType.VERIFY_RHOMBUS,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '根据已知条件，计算各边长度以判断是否满足菱形判定条件',
          inputTarget: 'AB 的值',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.VERIFY_RHOMBUS,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '计算 BC 的长度',
          inputTarget: 'BC 的值',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's3',
        type: StepType.VERIFY_RHOMBUS,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '综合判定，计算 CD 的长度',
          inputTarget: 'CD 的值',
          inputHint: '输入数字',
        },
      },
    ];
  },

  render: (params) => {
    const { sideAB, sideBC, sideCD, sideDA } = params;

    return {
      title: `四边形 ABCD 为平行四边形，各边长度分别为 AB=${sideAB}, BC=${sideBC}, CD=${sideCD}, DA=${sideDA}。判断 ABCD 是否为菱形`,
      description: '菱形判定',
      context: '菱形判定：①四条边相等；②对角线互相垂直的平行四边形',
    };
  },
};
