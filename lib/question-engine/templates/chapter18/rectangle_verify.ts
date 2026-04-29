/**
 * 矩形判定模板
 * 矩形判定方法：
 * 1. 有一个角是直角的平行四边形是矩形
 * 2. 有三个角是直角的四边形是矩形
 * 3. 对角线相等的平行四边形是矩形
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 判定方法类型
 */
type VerifyMethod = 'one_right_angle' | 'three_right_angles' | 'equal_diagonals';

/**
 * 判定方法配置
 */
const VERIFY_METHODS: { method: VerifyMethod; weight: number; description: string }[] = [
  { method: 'one_right_angle', weight: 0.5, description: '有一个角是直角的平行四边形' },
  { method: 'three_right_angles', weight: 0.3, description: '有三个角是直角的四边形' },
  { method: 'equal_diagonals', weight: 0.2, description: '对角线相等的平行四边形' },
];

/**
 * 生成矩形判定题目数据
 */
function generateRectangleVerifyData(
  method: VerifyMethod,
  params: Record<string, number>
): {
  width: number;
  height: number;
  diagonal: number;
  isRectangle: boolean;
  method: VerifyMethod;
  description: string;
  condition: string;
} {
  const diagonal = Math.sqrt(params.width ** 2 + params.height ** 2);

  switch (method) {
    case 'one_right_angle':
      // 有一个角是直角的平行四边形
      return {
        width: params.width,
        height: params.height,
        diagonal,
        isRectangle: true,
        method: 'one_right_angle',
        description: '平行四边形',
        condition: '有一个角是直角',
      };

    case 'three_right_angles':
      // 有三个角是直角的四边形
      return {
        width: params.width,
        height: params.height,
        diagonal,
        isRectangle: true,
        method: 'three_right_angles',
        description: '四边形',
        condition: '有三个角是直角',
      };

    case 'equal_diagonals':
      // 对角线相等的平行四边形
      return {
        width: params.width,
        height: params.height,
        diagonal,
        isRectangle: true,
        method: 'equal_diagonals',
        description: '平行四边形',
        condition: '对角线相等（AC=' + Math.round(diagonal) + ', BD=' + Math.round(diagonal) + '）',
      };

    default:
      return {
        width: params.width,
        height: params.height,
        diagonal,
        isRectangle: true,
        method: 'one_right_angle',
        description: '平行四边形',
        condition: '有一个角是直角',
      };
  }
}

/**
 * 生成非矩形数据
 */
function generateNonRectangle(
  params: Record<string, number>
): {
  isRectangle: boolean;
  description: string;
  condition: string;
} {
  // 随机生成一个非矩形的条件
  const rand = Math.floor(Math.random() * 3);
  switch (rand) {
    case 0:
      return {
        isRectangle: false,
        description: '平行四边形',
        condition: '没有直角',
      };
    case 1:
      return {
        isRectangle: false,
        description: '四边形',
        condition: '只有一个直角',
      };
    default:
      return {
        isRectangle: false,
        description: '平行四边形',
        condition: '对角线不相等',
      };
  }
}

/**
 * 矩形判定模板
 */
export const RectangleVerifyTemplate: QuestionTemplate = {
  id: 'rectangle_verify',
  knowledgePoint: 'rectangle_verify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.rectangle_verify[level] ||
                   DIFFICULTY_CONFIG.rectangle_verify[1];

    const params = generateRandomParams(config);

    // 确定判定方法类型
    let method: VerifyMethod;
    if (level <= 2) {
      // 基础：只用"有一个角是直角的平行四边形"
      method = 'one_right_angle';
      params.method = 0;
    } else if (level <= 3) {
      // 中等：增加"有三个角是直角的四边形"
      method = Math.random() < 0.6 ? 'one_right_angle' : 'three_right_angles';
      params.method = method === 'one_right_angle' ? 0 : 1;
    } else {
      // 高级：包含所有判定方法
      const rand = Math.random();
      if (rand < 0.4) method = 'one_right_angle';
      else if (rand < 0.7) method = 'three_right_angles';
      else method = 'equal_diagonals';
      params.method = method === 'one_right_angle' ? 0 :
                      method === 'three_right_angles' ? 1 : 2;
    }

    // 生成矩形边长（勾股数，便于计算）
    const pythagoreanPairs = [
      [3, 4], [5, 12], [8, 15], [7, 24], [6, 8], [9, 12], [5, 5]
    ];
    const pair = pythagoreanPairs[Math.floor(Math.random() * pythagoreanPairs.length)];
    params.width = pair[0];
    params.height = pair[1];

    // 决定是否生成矩形或非矩形
    // 高难度时增加非矩形题目比例
    const nonRectProb = level >= 4 ? 0.3 : (level >= 3 ? 0.2 : 0.1);
    if (Math.random() < nonRectProb) {
      params.isRectangle = 0;
    } else {
      params.isRectangle = 1;
    }

    params.level = level;

    return params;
  },

  buildSteps: (params): StepProtocolV2[] => {
    const isRectangle = params.isRectangle === 1;
    const method: VerifyMethod =
      params.method === 1 ? 'three_right_angles' :
      params.method === 2 ? 'equal_diagonals' : 'one_right_angle';

    // 根据判定方法生成不同的步骤
    switch (method) {
      case 'one_right_angle':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形是平行四边形吗？',
              hint: '平行四边形 + 一个直角 = 矩形',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '平行四边形有一个角是直角吗？',
              hint: '题目中∠A=90°',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '有直角',
              no: '没有直角',
            },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：满足"有一个角是直角的平行四边形"这个判定条件吗？',
              hint: '矩形判定定理1：有一个角是直角的平行四边形是矩形',
            },
            expectedAnswer: { type: 'yes_no', value: isRectangle },
            options: {
              yes: '是矩形',
              no: '不是矩形',
            },
          },
        ];

      case 'three_right_angles':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形有几个直角？',
              hint: '题目中∠A=∠B=∠C=90°',
            },
            expectedAnswer: { type: 'yes_no', value: false },
            options: {
              yes: '四个直角',
              no: '三个直角',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '有三个角是直角的四边形是矩形吗？',
              hint: '矩形判定定理2：有三个角是直角的四边形是矩形',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '是',
              no: '不是',
            },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：这个四边形是矩形吗？',
              hint: '有三个直角的四边形必为矩形',
            },
            expectedAnswer: { type: 'yes_no', value: isRectangle },
            options: {
              yes: '是矩形',
              no: '不是矩形',
            },
          },
        ];

      case 'equal_diagonals':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形是平行四边形吗？',
              hint: '对角线相等的平行四边形 = 矩形',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '平行四边形的对角线相等吗？',
              hint: `题目中AC=${Math.round(params.width ** 2 + params.height ** 2)}, BD=${Math.round(params.width ** 2 + params.height ** 2)}`,
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '对角线相等',
              no: '对角线不等',
            },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：满足"对角线相等的平行四边形"这个判定条件吗？',
              hint: '矩形判定定理3：对角线相等的平行四边形是矩形',
            },
            expectedAnswer: { type: 'yes_no', value: isRectangle },
            options: {
              yes: '是矩形',
              no: '不是矩形',
            },
          },
        ];

      default:
        return [];
    }
  },

  render: (params) => {
    const isRectangle = params.isRectangle === 1;
    const method: VerifyMethod =
      params.method === 1 ? 'three_right_angles' :
      params.method === 2 ? 'equal_diagonals' : 'one_right_angle';

    let context: string;
    if (isRectangle) {
      switch (method) {
        case 'one_right_angle':
          context = `四边形ABCD是平行四边形，且∠A=90°，判断是否为矩形`;
          break;
        case 'three_right_angles':
          context = `四边形ABCD中，∠A=∠B=∠C=90°，判断是否为矩形`;
          break;
        case 'equal_diagonals':
          context = `平行四边形ABCD中，AC=${Math.round(params.width ** 2 + params.height ** 2)}, BD=${Math.round(params.width ** 2 + params.height ** 2)}，判断是否为矩形`;
          break;
        default:
          context = `四边形ABCD是平行四边形，且∠A=90°，判断是否为矩形`;
      }
    } else {
      // 生成非矩形题目
      const rand = Math.floor(Math.random() * 3);
      switch (rand) {
        case 0:
          context = `平行四边形ABCD中，∠A=60°，判断是否为矩形`;
          break;
        case 1:
          context = `四边形ABCD中，只有∠A=90°，判断是否为矩形`;
          break;
        default:
          // 创建一个对角线不相等的平行四边形
          context = `平行四边形ABCD中，AC=${params.width + 2}，BD=${params.height + 2}，判断是否为矩形`;
      }
    }

    return {
      title: '矩形判定',
      description: '利用矩形判定定理进行判断',
      context,
    };
  },
};
