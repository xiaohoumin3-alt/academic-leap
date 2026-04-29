/**
 * 正方形判定模板
 * 正方形 = 矩形 + 菱形
 * 判定一个四边形是否为正方形
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 判定条件类型
 */
type VerifyConditionType = 'four_sides_equal' | 'four_right_angles' | 'diagonals_equal' | 'diagonals_perpendicular';

/**
 * 生成正方形判定参数
 */
function generateSquareVerifyParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.square_verify[level] ||
                 DIFFICULTY_CONFIG.square_verify[1];

  // 确定题目类型
  // 1 = 给定四边长度，判定是否正方形
  // 2 = 给定对角线长度，判定是否正方形
  // 3 = 给定角度信息，判定是否正方形
  // 4 = 综合判定条件

  const problemType = Math.floor(Math.random() * 4) + 1;

  const params: Record<string, number> = {
    problemType,
    level,
  };

  switch (problemType) {
    case 1: {
      // 给定四边长度，四边形判定
      // 正方形：四条边相等
      // 可以是四边相等（正方形）或不相等（不是正方形）
      const side = generateRandomParams({ side: config.side }).side;
      const isSquare = Math.random() < 0.6; // 60%概率是正方形

      params.side = side;
      params.isSquare = isSquare ? 1 : 0;

      if (!isSquare) {
        // 不是正方形：给出三条相等的边和一条不同的边
        // 或者四条都不相等
        const diffSide = Math.random() < 0.5
          ? side + Math.floor(Math.random() * 5) + 1  // 一条边更长
          : Math.max(1, side - Math.floor(Math.random() * 3) - 1); // 一条边更短
        params.diffSide = diffSide;
      }
      break;
    }

    case 2: {
      // 给定对角线信息判定
      // 正方形对角线相等且互相垂直平分
      const side = generateRandomParams({ side: config.side }).side;
      const diagonal = side * Math.SQRT2;
      const isSquare = Math.random() < 0.5;

      params.side = side;
      params.diagonal = Math.round(diagonal);
      params.isSquare = isSquare ? 1 : 0;

      if (!isSquare) {
        // 不是正方形：给出一个不等于 side * √2 的对角线值
        const wrongDiagonal = diagonal + Math.floor(Math.random() * 5) + 1;
        params.wrongDiagonal = wrongDiagonal;
        params.diagonal = wrongDiagonal;
      }
      break;
    }

    case 3: {
      // 给定角度信息判定
      // 正方形四角均为90°
      const isSquare = Math.random() < 0.5;
      params.isSquare = isSquare ? 1 : 0;

      if (!isSquare) {
        // 不是正方形：有一个角不是90°
        const wrongAngle = 80 + Math.floor(Math.random() * 20); // 80-100度之间
        params.wrongAngle = wrongAngle;
      }
      break;
    }

    case 4: {
      // 综合判定：需要验证多个条件
      const side = generateRandomParams({ side: config.side }).side;
      const isSquare = Math.random() < 0.5;

      params.side = side;
      params.isSquare = isSquare ? 1 : 0;

      if (!isSquare) {
        // 不是正方形但满足部分条件（如矩形但不满足四条边相等）
        const otherSide = side + Math.floor(Math.random() * 5) + 1;
        params.otherSide = otherSide;
      }
      break;
    }
  }

  return params;
}

/**
 * 正方形判定模板
 */
export const SquareVerifyTemplate: QuestionTemplate = {
  id: 'square_verify',
  knowledgePoint: 'square_verify',

  generateParams: (level: number) => {
    return generateSquareVerifyParams(level);
  },

  buildSteps: (params): StepProtocolV2[] => {
    const problemType = params.problemType as number;
    const isSquare = params.isSquare === 1;

    switch (problemType) {
      case 1: {
        // 四边相等问题型 - 题目只给了边长，缺少角度信息
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `题目说"四条边都是${params.side}"——四条边长度相等吗？`,
              hint: '根据题目给出的信息判断',
            },
            options: {
              yes: '是，四条边相等',
              no: '否，四条边不相等',
            },
            expectedAnswer: { type: 'yes_no', value: true },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目给出角度信息了吗？',
              hint: '检查题目描述',
            },
            options: {
              yes: '给出了角度',
              no: '没给角度',
            },
            expectedAnswer: { type: 'yes_no', value: false },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：只知四边相等，能确定是正方形吗？',
              hint: '正方形需要同时满足：四边相等 + 四角为直角',
            },
            options: {
              yes: '能确定',
              no: '不能确定',
            },
            expectedAnswer: { type: 'yes_no', value: false },
          },
        ];
      }

      case 2: {
        // 对角线相等条件型
        const diagonal = params.diagonal!;
        const isDiagonalCorrect = Math.abs(diagonal - (params.side || 0) * Math.SQRT2) < 0.01;

        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `题目给出对角线长度 ${diagonal}，这个长度正确吗？`,
              hint: '正方形对角线 = 边长 × √2',
            },
            options: {
              yes: '长度正确',
              no: '长度不正确',
            },
            expectedAnswer: { type: 'yes_no', value: isDiagonalCorrect },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '正方形对角线互相垂直吗？',
              hint: '正方形对角线性质',
            },
            options: {
              yes: '互相垂直',
              no: '不垂直',
            },
            expectedAnswer: { type: 'yes_no', value: true },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：能否确定是正方形？',
              hint: '需要同时满足对角线长度和性质',
            },
            options: {
              yes: '是正方形',
              no: '不是正方形',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      case 3: {
        // 四角为直角条件型
        const hasRightAngle = !params.wrongAngle || params.wrongAngle === 90;

        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形有一个角是90°吗？',
              hint: hasRightAngle ? '是的，有一个角是90°' : `有一个角是${params.wrongAngle}°`,
            },
            options: {
              yes: '有90°角',
              no: '没有90°角',
            },
            expectedAnswer: { type: 'yes_no', value: hasRightAngle },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '四个角都是直角吗？',
              hint: '正方形四角均为90°',
            },
            options: {
              yes: '都是直角',
              no: '不都是直角',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：是否为正方形？',
              hint: '正方形需要四角为直角',
            },
            options: {
              yes: '是正方形',
              no: '不是正方形',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      case 4: {
        // 综合判定
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '正方形首先是矩形，四角都是直角吗？',
              hint: isSquare ? '都是直角' : '不都是直角',
            },
            options: {
              yes: '都是直角',
              no: '不都是直角',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `正方形同时也是菱形，四边相等（都是${params.side}）吗？`,
              hint: isSquare ? '相等' : params.otherSide ? `不都相等（有${params.otherSide}）` : '不相等',
            },
            options: {
              yes: '四边相等',
              no: '四边不等',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：同时满足矩形（直角）+ 菱形（等边）条件吗？',
              hint: '正方形 = 矩形 + 菱形',
            },
            options: {
              yes: '同时满足',
              no: '不同时满足',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      default:
        return [];
    }
  },

  render: (params) => {
    const problemType = params.problemType as number;
    const isSquare = params.isSquare === 1;

    switch (problemType) {
      case 1:
        // 题目只给边长，不给角度信息
        return {
          title: isSquare
            ? `一个四边形四条边都等于${params.side}，判定是否为正方形`
            : `一个四边形四条边分别等于${params.side}、${params.side}、${params.side}、${params.diffSide}，判定是否为正方形`,
          description: '正方形判定 - 四边相等（缺少角度信息）',
          context: '正方形判定需要同时满足：①四边相等 ②四角为直角。只知道边长无法确定。',
        };

      case 2:
        return {
          title: `一个四边形的对角线长度为${params.diagonal}，判定是否为正方形`,
          description: '正方形判定 - 对角线性质',
          context: '正方形对角线相等且互相垂直',
        };

      case 3:
        return {
          title: `一个四边形其中一个内角为${params.wrongAngle || 90}°，判定是否为正方形`,
          description: '正方形判定 - 直角条件',
          context: '正方形四角均为90°',
        };

      case 4:
        return {
          title: isSquare
            ? `一个四边形四边相等且四角为直角，判定是否为正方形`
            : `一个四边形四边分别为${params.side}和${params.otherSide}，判定是否为正方形`,
          description: '正方形判定 - 综合条件（矩形+菱形）',
          context: '正方形 = 矩形 + 菱形',
        };

      default:
        return {
          title: '正方形判定',
          description: '判定四边形是否为正方形',
          context: '根据正方形的性质和判定条件进行判断',
        };
    }
  },
};