/**
 * 一元二次方程直接开平方法模板
 * 解形如 x² = a 或 (mx+n)² = a 的方程
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatSigned,
} from '../../difficulty';

/**
 * 判断是否为完全平方数
 */
function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const sqrt = Math.sqrt(n);
  return sqrt === Math.floor(sqrt);
}

/**
 * 生成完全平方数
 */
function generatePerfectSquare(min: number, max: number): number {
  const minSqrt = Math.ceil(Math.sqrt(min));
  const maxSqrt = Math.floor(Math.sqrt(max));
  const sqrt = Math.floor(Math.random() * (maxSqrt - minSqrt + 1)) + minSqrt;
  return sqrt * sqrt;
}

/**
 * 一元二次方程直接开平方法模板
 */
export const QuadraticDirectRootTemplate: QuestionTemplate = {
  id: 'quadratic_direct_root',
  knowledgePoint: 'quadratic_direct_root',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_direct_root[level] ||
                   DIFFICULTY_CONFIG.quadratic_direct_root[1];

    // Level 1-2: x² = a 形式（简单）
    // Level 3-5: 可能出现 (mx+n)² = a 形式（复杂）
    const useComplexForm = level >= 3 && Math.random() > 0.5;

    const params = generateRandomParams(config);

    if (useComplexForm) {
      // 确保解为有理数：a 必须为完全平方数
      const m = params.m;
      const n = params.n;
      // a = k² * m²，保证解为整数或简单分数
      const k = Math.floor(Math.random() * 5) + 1;
      params.a = k * k * m * m;
      params.formType = 1; // 复杂形式
    } else {
      // 简单形式：a 为完全平方数
      params.a = generatePerfectSquare(config.a.min, config.a.max);
      params.formType = 0; // 简单形式
      params.m = 1;
      params.n = 0;
    }

    return params;
  },

  buildSteps: (params) => {
    const { a, m, n, formType } = params;

    if (formType === 0) {
      // x² = a 形式
      const sqrtA = Math.sqrt(a);

      return [
        {
          stepId: 's1',
          type: StepType.SOLVE_DIRECT_ROOT,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.001,
          ui: {
            instruction: `方程 x² = ${a} 的一个解`,
            inputTarget: 'x 的值（正解）',
            inputHint: '输入正数解',
          },
        },
        {
          stepId: 's2',
          type: StepType.SOLVE_DIRECT_ROOT,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.001,
          ui: {
            instruction: '方程的另一个解',
            inputTarget: 'x 的值（负解）',
            inputHint: '输入负数解',
          },
        },
      ];
    } else {
      // (mx + n)² = a 形式
      const sqrtA = Math.sqrt(a);
      const x1 = (sqrtA - n) / m;
      const x2 = (-sqrtA - n) / m;

      return [
        {
          stepId: 's1',
          type: StepType.SOLVE_DIRECT_ROOT,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.001,
          ui: {
            instruction: `方程 (${m}x ${formatSigned(n)})² = ${a} 的一个解`,
            inputTarget: 'x 的值',
            inputHint: '先开平方，再解一次方程',
          },
        },
        {
          stepId: 's2',
          type: StepType.SOLVE_DIRECT_ROOT,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.001,
          ui: {
            instruction: '方程的另一个解',
            inputTarget: 'x 的值',
            inputHint: '别忘了负的平方根',
          },
        },
      ];
    }
  },

  render: (params) => {
    const { a, m, n, formType } = params;

    if (formType === 0) {
      return {
        title: `解方程 x² = ${a}`,
        description: '直接开平方法',
        context: '当方程一边是含未知数的平方式，另一边是非负数时，可以直接开平方求解',
      };
    } else {
      const inner = `${m}x ${formatSigned(n)}`;
      return {
        title: `解方程 (${inner})² = ${a}`,
        description: '直接开平方法（整体开方）',
        context: '把 mx+n 看作一个整体，直接开平方',
      };
    }
  },
};
