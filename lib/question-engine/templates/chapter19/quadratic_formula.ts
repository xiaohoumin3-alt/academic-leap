/**
 * 一元二次方程求根公式法模板
 * 使用公式 x = (-b ± √(b²-4ac)) / 2a
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
 * 生成判别式为完全平方数的参数
 * 保证方程有两个有理数解
 */
function generateParamsWithRationalRoots(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadratic_formula[level] ||
                 DIFFICULTY_CONFIG.quadratic_formula[1];

  const a = generateRandomParams({ a: config.a }).a;
  const b = generateRandomParams({ b: config.b }).b;

  // 选择判别式为完全平方数：Δ = k²
  // 设 x1 = p/q, x2 = r/s 为有理数
  // 则 a(x - x1)(x - x2) = ax² - a(x1+x2)x + ax1x2
  // b = -a(x1+x2), c = ax1x2

  // 简化：选择整数解 x1, x2
  const range = level <= 2 ? 3 : level <= 4 ? 5 : 8;
  const x1 = Math.floor(Math.random() * range * 2) - range;
  const x2 = Math.floor(Math.random() * range * 2) - range;

  // 确保两个解不同
  if (x1 === x2) {
    return generateParamsWithRationalRoots(level);
  }

  // 计算系数
  const b_calc = -a * (x1 + x2);
  const c_calc = a * x1 * x2;

  // 检查是否在约束范围内
  if (b_calc < config.b.min || b_calc > config.b.max ||
      c_calc < config.c.min || c_calc > config.c.max) {
    return generateParamsWithRationalRoots(level);
  }

  return { a, b: b_calc, c: c_calc };
}

/**
 * 一元二次方程求根公式法模板
 */
export const QuadraticFormulaTemplate: QuestionTemplate = {
  id: 'quadratic_formula',
  knowledgePoint: 'quadratic_formula',

  generateParams: (level: number) => {
    return generateParamsWithRationalRoots(level);
  },

  buildSteps: (params) => {
    const { a, b, c } = params;

    // 计算判别式
    const delta = b * b - 4 * a * c;

    // 计算两个解
    const sqrtDelta = Math.sqrt(delta);
    const x1 = (-b + sqrtDelta) / (2 * a);
    const x2 = (-b - sqrtDelta) / (2 * a);

    return [
      {
        stepId: 's1',
        type: StepType.SOLVE_QUADRATIC_FORMULA,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: `计算判别式 Δ = b² - 4ac 的值`,
          inputTarget: 'Δ 的值',
          inputHint: `其中 a=${a}, b=${b}, c=${c}`,
        },
      },
      {
        stepId: 's2',
        type: StepType.SOLVE_QUADRATIC_FORMULA,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '代入求根公式，计算方程的一个解',
          inputTarget: 'x₁ 的值',
          inputHint: '使用 x = (-b + √Δ) / 2a 或 x = (-b - √Δ) / 2a',
        },
      },
      {
        stepId: 's3',
        type: StepType.SOLVE_QUADRATIC_FORMULA,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '计算方程的另一个解',
          inputTarget: 'x₂ 的值',
          inputHint: '确保得到两个不同的解',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = formatSigned(b);
    const cStr = formatSigned(c);

    return {
      title: `用求根公式解方程 ${a}x² ${bStr}x ${cStr} = 0`,
      description: '求根公式法',
      context: '求根公式：x = (-b ± √(b²-4ac)) / 2a（Δ ≥ 0）',
    };
  },
};
