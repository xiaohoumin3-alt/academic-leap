/**
 * 一元二次方程配方法模板
 * 解形如 ax² + bx + c = 0 的方程，通过配方法求解
 * 步骤：移项、化1、配方、开方
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatSigned,
  formatNumber,
} from '../../difficulty';

/**
 * 配方法模板
 */
export const QuadraticCompleteSquareTemplate: QuestionTemplate = {
  id: 'quadratic_complete_square',
  knowledgePoint: 'quadratic_complete_square',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_complete_square[level] ||
                   DIFFICULTY_CONFIG.quadratic_complete_square[1];

    const params = generateRandomParams(config);

    // 确保方程有实数解：b² - 4ac >= 0
    // 对于配方法，我们选择系数使得配方后右边的数是非负的
    const { a, b, c } = params;

    // 检查判别式
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) {
      // 调整 c 使判别式非负
      const maxC = Math.floor((b * b) / (4 * a));
      params.c = Math.max(c, maxC);
    }

    return params;
  },

  buildSteps: (params) => {
    const { a, b, c } = params;

    // 移项：把常数项移到右边
    // ax² + bx = -c
    const rightSideAfterMove = -c;

    // 化1：两边除以a
    // x² + (b/a)x = -c/a
    const bOverA = b / a;
    const cOverA = c / a;

    // 配方：添加 (b/2a)²
    const completeSquareTerm = (b / (2 * a)) ** 2;
    const rightSideAfterComplete = -cOverA + completeSquareTerm;

    // 开方求解
    const sqrtRightSide = Math.sqrt(rightSideAfterComplete);
    const x1 = (-bOverA + sqrtRightSide);
    const x2 = (-bOverA - sqrtRightSide);

    return [
      {
        stepId: 's1',
        type: StepType.SOLVE_COMPLETE_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '移项：把常数项移到等号右边',
          inputTarget: '移项后右边的常数',
          inputHint: `方程 ${a}x² ${formatSigned(b)}x ${formatSigned(c)} = 0 移项后右边的值`,
        },
      },
      {
        stepId: 's2',
        type: StepType.SOLVE_COMPLETE_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '化1：把二次项系数化为1',
          inputTarget: '化1后一次项的系数',
          inputHint: '两边同时除以二次项系数后，x 项的系数是多少',
        },
      },
      {
        stepId: 's3',
        type: StepType.SOLVE_COMPLETE_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '配方：两边同时加上"一次项系数一半的平方"',
          inputTarget: '需要加上的数',
          inputHint: '一次项系数一半的平方是多少',
        },
      },
      {
        stepId: 's4',
        type: StepType.SOLVE_COMPLETE_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '开方：写出方程的一个解',
          inputTarget: '方程的一个解',
          inputHint: '配方后开平方求出的一个解',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = formatSigned(b);
    const cStr = formatSigned(c);

    return {
      title: `用配方法解方程 ${a}x² ${bStr}x ${cStr} = 0`,
      description: '配方法',
      context: '通过配方把一元二次方程转化为 (x+m)²=n 的形式，然后直接开平方求解',
    };
  },
};
