/**
 * 菱形性质计算模板
 * 性质：四条边相等、对角线互相垂直平分
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
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
    const params = generateRandomParams(config);
    params.level = level;

    // 生成对角线（确保是整数，便于计算）
    params.diagonal1 = params.diagonal1 || Math.floor(Math.random() * 8) + 4;
    params.diagonal2 = params.diagonal2 || Math.floor(Math.random() * 6) + 4;

    // 计算边长：利用勾股定理，边长 = sqrt((d1/2)^2 + (d2/2)^2)
    const halfD1 = params.diagonal1 / 2;
    const halfD2 = params.diagonal2 / 2;
    params.side = Math.sqrt(halfD1 * halfD1 + halfD2 * halfD2);

    return params;
  },

  buildSteps: (params): StepProtocolV2[] => {
    const { side, diagonal1, diagonal2 } = params;

    const halfD1 = diagonal1! / 2;
    const halfD2 = diagonal2! / 2;
    const sumOfSquares = halfD1 * halfD1 + halfD2 * halfD2;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: '利用菱形对角线互相垂直平分的性质，求对角线一半的平方和',
          hint: `计算：(d₁/2)² + (d₂/2)² = (${halfD1})² + (${halfD2})²`,
        },
        expectedAnswer: { type: 'number', value: Math.round(sumOfSquares * 1000) / 1000, tolerance: 0.001 },
        keyboard: { type: 'numeric' },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: '根据勾股定理，求菱形的边长',
          hint: `边长 = √(${sumOfSquares.toFixed(3)})`,
        },
        expectedAnswer: { type: 'number', value: Math.round(side! * 1000) / 1000, tolerance: 0.001 },
        keyboard: { type: 'numeric' },
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
