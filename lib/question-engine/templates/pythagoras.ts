/**
 * 勾股定理题目模板
 */

import { QuestionTemplate } from '../protocol';
import { AnswerMode, StepProtocolV2 } from '../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../difficulty';

/**
 * 勾股定理模板
 */
export const PythagorasTemplate: QuestionTemplate = {
  id: 'pythagoras',
  knowledgePoint: '勾股定理',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.pythagoras[level] ||
                   DIFFICULTY_CONFIG.pythagoras[1];
    return generateRandomParams(config);
  },

  buildSteps: (params): StepProtocolV2[] => {
    const { a, b } = params;
    const c = Math.sqrt(a * a + b * b);
    const cSquare = a * a + b * b;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `直角三角形，a=${a}, b=${b}，求斜边 c²`,
          hint: '使用勾股定理 c² = a² + b²',
          inputPlaceholder: '输入 c² 的值',
        },
        keyboard: {
          type: 'numeric',
          extraKeys: ['√', 'π', '.'],
        },
        expectedAnswer: {
          type: 'number',
          value: cSquare,
          tolerance: 0.01,
        },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `求斜边 c`,
          hint: `c = √${cSquare}`,
          inputPlaceholder: '输入 c 的值',
        },
        keyboard: {
          type: 'numeric',
          extraKeys: ['√', '.'],
        },
        expectedAnswer: {
          type: 'number',
          value: c,
          tolerance: 0.01,
        },
      },
    ];
  },

  render: (params) => {
    const { a, b } = params;
    const cSquare = a * a + b * b;
    const c = Math.sqrt(cSquare);
    return {
      title: `勾股定理：a=${a}, b=${b}`,
      description: '求斜边长度',
      context: `直角三角形中，c² = a² + b²，已知 c² = ${cSquare}，求 c（保留两位小数：输入 ${c.toFixed(2)}）`,
    };
  },
};
