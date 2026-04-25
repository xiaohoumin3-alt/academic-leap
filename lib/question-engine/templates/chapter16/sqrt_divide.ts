/**
 * 二次根式除法模板
 * 使用公式 √a / √b = √(a/b)
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
 * 生成二次根式除法参数
 * 确保 b > 0 且结果有意义
 */
function generateSqrtDivideParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.sqrt_divide[level] ||
                 DIFFICULTY_CONFIG.sqrt_divide[1];

  let a = generateRandomParams({ a: config.a }).a;
  let b = generateRandomParams({ b: config.b }).b;

  // 确保非负且分母不为零
  a = Math.abs(a);
  b = Math.abs(b);
  if (b === 0) {
    b = 1;
  }

  // 对于低级别，确保能整除或简化
  if (level <= 2) {
    // a 和 b 的关系使得 a/b 是简单的数
    const simpleRatios = [
      { a: 4, b: 1 }, { a: 9, b: 4 }, { a: 16, b: 9 },
      { a: 25, b: 16 }, { a: 36, b: 25 }
    ];
    const ratio = simpleRatios[Math.floor(Math.random() * simpleRatios.length)];
    return { a: ratio.a, b: ratio.b };
  }

  return { a, b };
}

/**
 * 二次根式除法模板
 * √a / √b = √(a/b)
 */
export const SqrtDivideTemplate: QuestionTemplate = {
  id: 'sqrt_divide',
  knowledgePoint: 'sqrt_divide',

  generateParams: (level: number) => {
    return generateSqrtDivideParams(level);
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
          instruction: '应用二次根式除法法则：√a / √b = √(a/b)，计算商的被开方数',
          inputTarget: 'a/b 的值',
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
          inputHint: '将商化简为最简二次根式或有理数',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b } = params;

    return {
      title: `计算 √${a} / √${b}`,
      description: '二次根式除法',
      context: '除法法则：√a / √b = √(a/b)（a ≥ 0, b > 0）',
    };
  },
};
