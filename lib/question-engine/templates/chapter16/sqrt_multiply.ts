/**
 * 二次根式乘法模板
 * 使用公式 √a · √b = √(ab)
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
 * 生成二次根式乘法参数
 * 确保结果可以简化为有意义的形式
 */
function generateSqrtMultiplyParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.sqrt_multiply[level] ||
                 DIFFICULTY_CONFIG.sqrt_multiply[1];

  // 对于低级别，选择能产生完全平方数的组合
  if (level <= 2) {
    // a 和 b 都是完全平方数或与完全平方数相乘
    const perfectSquares = [1, 4, 9, 16, 25, 36, 49];
    const a = perfectSquares[Math.floor(Math.random() * 4)]; // 1, 4, 9, 16
    const b = perfectSquares[Math.floor(Math.random() * 4)];
    // 计算 result = √(a*b)
    const result = Math.sqrt(a * b);
    return { a, b, result };
  }

  // 中高级别：更复杂的组合
  const a = generateRandomParams({ a: config.a }).a;
  let b = generateRandomParams({ b: config.b }).b;

  // 避免零值
  if (a === 0 || b === 0) {
    return generateSqrtMultiplyParams(level);
  }

  // 计算 result = √(a*b)
  const result = Math.sqrt(a * b);
  return { a, b, result };
}

/**
 * 二次根式乘法模板
 * √a · √b = √(ab)
 */
export const SqrtMultiplyTemplate: QuestionTemplate = {
  id: 'sqrt_multiply',
  knowledgePoint: 'sqrt_multiply',

  generateParams: (level: number) => {
    return generateSqrtMultiplyParams(level);
  },

  buildSteps: (params) => {
    const { a, b } = params;

    return [
      {
        stepId: 's1',
        type: StepType.SQRT_MIXED,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '应用二次根式乘法法则：√a · √b = √(ab)，计算被开方数的乘积',
          inputTarget: 'ab 的值',
          inputHint: `其中 a=${a}, b=${b}`,
        },
      },
      {
        stepId: 's2',
        type: StepType.SQRT_MIXED,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '化简二次根式（如果能化简）',
          inputTarget: '化简后的结果',
          inputHint: '将乘积化简为最简二次根式或整数',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b } = params;

    return {
      title: `计算 √${a} · √${b}`,
      description: '二次根式乘法',
      context: '乘法法则：√a · √b = √(ab)（a ≥ 0, b ≥ 0）',
    };
  },
};
