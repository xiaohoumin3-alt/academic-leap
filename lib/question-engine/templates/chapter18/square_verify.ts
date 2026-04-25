/**
 * 正方形判定模板
 * 正方形 = 矩形 + 菱形
 * 判定一个四边形是否为正方形
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

  buildSteps: (params) => {
    const problemType = params.problemType as number;
    const isSquare = params.isSquare === 1;

    switch (problemType) {
      case 1: {
        // 条件1：四边相等
        const side = params.side!;

        return [
          {
            stepId: 's1',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '识别正方形第一条件：四条边相等',
              inputTarget: '边长数值',
              inputHint: `正方形四边相等，当前边长 = ${side}`,
            },
          },
          {
            stepId: 's2',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
              tolerance: 0,
            ui: {
              instruction: '验证所有边是否相等',
              inputTarget: '边数（4）',
              inputHint: '确认四条边长度是否相等',
            },
          },
          {
            stepId: 's3',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '得出结论',
              inputTarget: isSquare ? '1' : '0',
              inputHint: isSquare ? '四边相等，正方形' : '四边不相等，不是正方形',
            },
          },
        ];
      }

      case 2: {
        // 条件2：对角线相等
        const diagonal = params.diagonal!;

        return [
          {
            stepId: 's1',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '识别正方形第二条件：对角线相等',
              inputTarget: '对角线长度',
              inputHint: `正方形对角线长度 = 边长 × √2 ≈ ${diagonal}`,
            },
          },
          {
            stepId: 's2',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '验证对角线是否互相垂直',
              inputTarget: '垂直角度（90）',
              inputHint: '正方形对角线互相垂直',
            },
          },
          {
            stepId: 's3',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '得出结论',
              inputTarget: isSquare ? '1' : '0',
              inputHint: isSquare ? '对角线相等且垂直，正方形' : '对角线条件不满足，不是正方形',
            },
          },
        ];
      }

      case 3: {
        // 条件3：四角为直角
        return [
          {
            stepId: 's1',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '识别正方形第三条件：四角均为直角',
              inputTarget: '角度数值',
              inputHint: '正方形每个角都是90°',
            },
          },
          {
            stepId: 's2',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '验证四角是否均为90°',
              inputTarget: '角数（4）',
              inputHint: '检查四个角是否都是直角',
            },
          },
          {
            stepId: 's3',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '得出结论',
              inputTarget: isSquare ? '1' : '0',
              inputHint: isSquare ? '四角均为直角，正方形' : '有角不是直角，不是正方形',
            },
          },
        ];
      }

      case 4: {
        // 综合判定：需要满足矩形+菱形条件
        const side = params.side!;

        return [
          {
            stepId: 's1',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '第一步：验证矩形条件（四角为直角）',
              inputTarget: '角度（90）',
              inputHint: '正方形首先是矩形，需要四角为直角',
            },
          },
          {
            stepId: 's2',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '第二步：验证菱形条件（四边相等）',
              inputTarget: '边长数值',
              inputHint: `正方形同时也是菱形，四边相等 = ${side}`,
            },
          },
          {
            stepId: 's3',
            type: StepType.VERIFY_SQUARE,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '得出结论',
              inputTarget: isSquare ? '1' : '0',
              inputHint: isSquare ? '满足矩形+菱形条件，是正方形' : '不同时满足两个条件，不是正方形',
            },
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
        return {
          title: isSquare
            ? `一个四边形四条边都等于${params.side}，判定是否为正方形`
            : `一个四边形三条边等于${params.side}，另一条边等于${params.diffSide}，判定是否为正方形`,
          description: '正方形判定 - 四边相等',
          context: '正方形判定方法：四边相等且四角为直角',
        };

      case 2:
        return {
          title: `一个四边形的对角线长度为${params.diagonal}，判定是否为正方形`,
          description: '正方形判定 - 对角线性质',
          context: '正方形判定方法：对角线相等且互相垂直',
        };

      case 3:
        return {
          title: `一个四边形其中一个内角为${params.wrongAngle || 90}°，判定是否为正方形`,
          description: '正方形判定 - 直角条件',
          context: '正方形判定方法：四角均为90°',
        };

      case 4:
        return {
          title: isSquare
            ? `一个四边形四边相等且四角为直角，判定是否为正方形`
            : `一个四边形四边分别为${params.side}和${params.otherSide}，判定是否为正方形`,
          description: '正方形判定 - 综合条件',
          context: '正方形 = 矩形 + 菱形，需要同时满足两个图形的判定条件',
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