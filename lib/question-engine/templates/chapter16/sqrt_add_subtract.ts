/**
 * 二次根式加减混合运算模板
 * 合并同类二次根式：a√b + c√b = (a+c)√b
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
 * 生成二次根式加减参数
 * 生成可以合并的同类二次根式
 */
function generateSqrtAddSubtractParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.sqrt_add_subtract[level] ||
                 DIFFICULTY_CONFIG.sqrt_add_subtract[1];

  // 选择一个共同的根号内数值
  const radicands = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30];
  const maxIndex = Math.min(level + 1, radicands.length);
  const b = radicands[Math.floor(Math.random() * maxIndex)];

  // 根据难度生成系数
  let a, c;

  if (level === 1) {
    // 最简单：正整数系数
    a = Math.floor(Math.random() * 3) + 1; // 1-3
    c = Math.floor(Math.random() * 3) + 1; // 1-3
  } else if (level === 2) {
    a = Math.floor(Math.random() * 5) + 1; // 1-5
    c = Math.floor(Math.random() * 5) + 1; // 1-5
  } else if (level === 3) {
    // 引入负数
    a = Math.floor(Math.random() * 7) - 3; // -3 到 3
    c = Math.floor(Math.random() * 7) - 3; // -3 到 3
    if (a === 0) a = 1;
    if (c === 0) c = 1;
  } else if (level === 4) {
    a = Math.floor(Math.random() * 11) - 5; // -5 到 5
    c = Math.floor(Math.random() * 11) - 5; // -5 到 5
    if (a === 0) a = 2;
    if (c === 0) c = -2;
  } else {
    // 最复杂：更大的系数
    a = Math.floor(Math.random() * 21) - 10; // -10 到 10
    c = Math.floor(Math.random() * 21) - 10; // -10 到 10
    if (a === 0) a = 3;
    if (c === 0) c = -3;
  }

  return { a, b, c };
}

/**
 * 二次根式加减混合运算模板
 * a√b + c√b = (a+c)√b
 */
export const SqrtAddSubtractTemplate: QuestionTemplate = {
  id: 'sqrt_add_subtract',
  knowledgePoint: 'sqrt_add_subtract',

  generateParams: (level: number) => {
    return generateSqrtAddSubtractParams(level);
  },

  buildSteps: (params) => {
    const { a, b, c } = params;

    // 构建表达式字符串
    const aStr = a === 1 ? '' : a === -1 ? '-' : a.toString();
    const cStr = c >= 0 ? (c === 1 ? ' + ' : ` + ${c}`) : (c === -1 ? ' - ' : ` - ${Math.abs(c)}`);

    return [
      {
        stepId: 's1',
        type: StepType.SQRT_MIXED,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '识别同类二次根式，判断是否可以合并',
          inputTarget: '根号内的数（判断是否为同类根式）',
          inputHint: '同类二次根式的根号内数字相同',
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
          instruction: '合并同类二次根式：a√b + c√b = (a+c)√b',
          inputTarget: '合并后的系数',
          inputHint: `计算 ${a} + (${c})`,
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;

    // 构建表达式
    let expr = '';
    if (a === 1) {
      expr = `√${b}`;
    } else if (a === -1) {
      expr = `-√${b}`;
    } else {
      expr = `${a}√${b}`;
    }

    if (c >= 0) {
      if (c === 1) {
        expr += ` + √${b}`;
      } else {
        expr += ` + ${c}√${b}`;
      }
    } else {
      if (c === -1) {
        expr += ` - √${b}`;
      } else {
        expr += ` - ${Math.abs(c)}√${b}`;
      }
    }

    return {
      title: `计算 ${expr}`,
      description: '二次根式加减混合运算',
      context: '合并同类二次根式：a√b + c√b = (a+c)√b',
    };
  },
};
