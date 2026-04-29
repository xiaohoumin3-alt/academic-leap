/**
 * 菱形判定模板
 * 判定：四条边相等 / 对角线互相垂直的平行四边形
 */

import {
  QuestionTemplate,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';
import {
  StepProtocolV2,
  AnswerMode,
} from '../../protocol-v2';

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

  buildSteps: (params): StepProtocolV2[] => {
    const { isRhombus } = params;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '根据已知条件，判断四边形是否满足菱形判定条件（四条边相等）',
          hint: '菱形判定：①四条边相等；②对角线互相垂直的平行四边形',
        },
        expectedAnswer: {
          type: 'yes_no',
          value: isRhombus === 1,
        },
        options: {
          yes: '是',
          no: '否',
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
