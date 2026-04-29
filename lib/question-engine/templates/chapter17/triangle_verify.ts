/**
 * 勾股定理逆定理模板
 * 判断三角形是否为直角三角形
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 勾股定理逆定理模板
 */
export const TriangleVerifyTemplate: QuestionTemplate = {
  id: 'triangle_verify',
  knowledgePoint: 'triangle_verify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.triangle_verify[level] ||
                   DIFFICULTY_CONFIG.triangle_verify[1];

    const params = generateRandomParams(config);

    // 根据难度决定是否生成直角三角形
    // 高级难度增加非直角三角形比例
    const nonRightProb = level >= 4 ? 0.4 : (level >= 3 ? 0.3 : 0.2);
    const isRight = Math.random() >= nonRightProb;
    params.isRight = isRight ? 1 : 0;

    if (isRight) {
      // 生成勾股数
      const pythagoreanTriples = [
        [3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25],
        [6, 8, 10], [9, 12, 15], [5, 5, 5], [9, 40, 41],
        [11, 60, 61], [12, 5, 13], [15, 8, 17], [20, 21, 29],
      ];
      const triple = pythagoreanTriples[Math.floor(Math.random() * pythagoreanTriples.length)];

      // 根据难度调整数字大小
      if (level <= 2) {
        params.side1 = triple[0] <= 8 ? triple[0] : triple[0] / 2;
        params.side2 = triple[1] <= 12 ? triple[1] : triple[1] / 2;
        params.side3 = triple[2] <= 15 ? triple[2] : triple[2] / 2;
      } else if (level <= 3) {
        params.side1 = triple[0];
        params.side2 = triple[1];
        params.side3 = triple[2];
      } else {
        // 高级难度使用完整勾股数或倍数
        const multiplier = level === 5 ? 2 : 1;
        params.side1 = triple[0] * multiplier;
        params.side2 = triple[1] * multiplier;
        params.side3 = triple[2] * multiplier;
      }

      // 确保side1 < side2 < side3
      const sides = [params.side1, params.side2, params.side3].sort((a, b) => a - b);
      params.side1 = sides[0];
      params.side2 = sides[1];
      params.side3 = sides[2];
    } else {
      // 生成非直角三角形
      // 确保三边不能构成直角三角形
      let attempts = 0;
      do {
        params.side1 = Math.floor(Math.random() * 10) + 2;
        params.side2 = Math.floor(Math.random() * 10) + 3;
        params.side3 = Math.floor(Math.random() * 12) + 4;

        // 确保能构成三角形
        if (params.side1 + params.side2 <= params.side3) {
          params.side3 = params.side1 + params.side2 - 1;
        }

        // 排序
        const sides = [params.side1, params.side2, params.side3].sort((a, b) => a - b);
        params.side1 = sides[0];
        params.side2 = sides[1];
        params.side3 = sides[2];

        attempts++;
      } while (
        Math.abs(params.side1 * params.side1 + params.side2 * params.side2 - params.side3 * params.side3) < 1 &&
        attempts < 10
      );
    }

    params.level = level;

    return params;
  },

  buildSteps: (params): StepProtocolV2[] => {
    const isRightTriangle = params.isRight === 1;
    const { side1, side2, side3 } = params;

    // 将三边排序
    const sides = [side1, side2, side3].sort((a, b) => a - b);
    const [a, b, c] = sides;

    // 判断是否为直角三角形
    const cSquared = a * a + b * b;
    const cSquare = c * c;
    const isRight = Math.abs(cSquared - cSquare) < 0.0001;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '将三边按从小到大排列，识别最长边',
          hint: `三边排序后为：${a}, ${b}, ${c}，最长边是${c}`,
        },
        expectedAnswer: { type: 'yes_no', value: true },
        options: {
          yes: `${c}是最长边`,
          no: '识别错误',
        },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '验证勾股定理逆定理：较短两边的平方和是否等于最长边的平方？',
          hint: `计算：${a}² + ${b}² = ${a * a + b * b}，${c}² = ${c * c}`,
        },
        expectedAnswer: { type: 'yes_no', value: isRight },
        options: {
          yes: '相等（是直角三角形）',
          no: '不相等（不是直角三角形）',
        },
      },
      {
        stepId: 's3',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '综合判断：该三角形是否为直角三角形？',
          hint: isRight ? '满足勾股定理逆定理，是直角三角形' : '不满足勾股定理逆定理，不是直角三角形',
        },
        expectedAnswer: { type: 'yes_no', value: isRightTriangle },
        options: {
          yes: '是直角三角形',
          no: '不是直角三角形',
        },
      },
    ];
  },

  render: (params) => {
    const { side1, side2, side3 } = params;
    const isRightTriangle = params.isRight === 1;

    const sides = [side1, side2, side3].sort((a, b) => a - b);
    const [a, b, c] = sides;

    const context = `三角形ABC的三边分别为 ${side1}、${side2}、${side3}，判断该三角形是否为直角三角形`;

    return {
      title: '勾股定理逆定理',
      description: '判断三角形是否为直角三角形',
      context,
    };
  },
};
