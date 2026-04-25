/**
 * 二次根式定义域模板
 * 判断√a是否有意义（被开方数a ≥ 0）
 * 学生判断二次根式是否定义
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
 * 表达式类型
 */
type ExpressionType = 'simple' | 'variable' | 'complex';

/**
 * 生成表达式字符串
 */
function generateExpression(
  exprType: ExpressionType,
  params: Record<string, number>
): string {
  switch (exprType) {
    case 'simple':
      // 简单数值：√a
      return `√${params.a}`;

    case 'variable':
      // 变量表达式：√(x + a)
      const b = params.b || 0;
      if (b >= 0) {
        return `√(x + ${b})`;
      } else if (b < 0) {
        return `√(x - ${Math.abs(b)})`;
      }
      return '√x';

    case 'complex':
      // 复杂表达式：√(ax + b)
      const coef = params.coef || 1;
      const constant = params.constant || 0;
      if (coef === 1) {
        if (constant > 0) {
          return `√(x + ${constant})`;
        } else if (constant < 0) {
          return `√(x - ${Math.abs(constant)})`;
        }
        return '√x';
      } else if (coef === -1) {
        if (constant > 0) {
          return `√(-x + ${constant})`;
        } else if (constant < 0) {
          return `√(-x - ${Math.abs(constant)})`;
        }
        return '√(-x)';
      } else {
        if (constant > 0) {
          return `√(${coef}x + ${constant})`;
        } else if (constant < 0) {
          return `√(${coef}x - ${Math.abs(constant)})`;
        }
        return `√(${coef}x)`;
      }

    default:
      return `√${params.a}`;
  }
}

/**
 * 判断表达式是否有意义
 */
function isDefined(exprType: ExpressionType, params: Record<string, number>): boolean {
  switch (exprType) {
    case 'simple':
      return params.a >= 0;

    case 'variable':
      // √(x + b): x + b ≥ 0 => x ≥ -b，对于实数x总有解
      return true;  // 变量表达式总有定义域

    case 'complex':
      // √(ax + b): ax + b ≥ 0
      // 如果 a > 0，x ≥ -b/a 有解
      // 如果 a < 0，x ≤ -b/a 有解
      // 如果 a = 0，需要 b ≥ 0
      const coef = params.coef || 1;
      const constant = params.constant || 0;
      if (coef === 0) {
        return constant >= 0;
      }
      return true;  // 线性表达式总有定义域

    default:
      return params.a >= 0;
  }
}

/**
 * 二次根式定义域模板
 */
export const SqrtConceptTemplate: QuestionTemplate = {
  id: 'sqrt_concept',
  knowledgePoint: 'sqrt_concept',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.sqrt_concept[level] ||
                   DIFFICULTY_CONFIG.sqrt_concept[1];

    const params = generateRandomParams(config);

    // 确定表达式类型
    let exprType: ExpressionType;
    if (level <= 2) {
      exprType = 'simple';
    } else if (level <= 4) {
      exprType = Math.random() < 0.5 ? 'simple' : 'variable';
    } else {
      const rand = Math.random();
      if (rand < 0.33) exprType = 'simple';
      else if (rand < 0.66) exprType = 'variable';
      else exprType = 'complex';
    }

    // 对于variable和complex类型，生成额外参数
    if (exprType === 'variable') {
      params.b = Math.floor(Math.random() * 11) - 5; // -5 到 5
      params.exprType = 1;
    } else if (exprType === 'complex') {
      params.coef = Math.floor(Math.random() * 5) - 2; // -2 到 2
      if (params.coef === 0) params.coef = 1;
      params.constant = Math.floor(Math.random() * 11) - 5; // -5 到 5
      params.exprType = 2;
    } else {
      params.exprType = 0;
    }

    // 计算答案：1=有意义，0=无意义
    params.answer = isDefined(exprType, params) ? 1 : 0;
    params.level = level;

    return params;
  },

  buildSteps: (params) => {
    const exprType: ExpressionType =
      params.exprType === 1 ? 'variable' :
      params.exprType === 2 ? 'complex' : 'simple';

    const expression = generateExpression(exprType, params);
    const hasMeaning = params.answer === 1;

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_SQRT,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0,
        ui: {
          instruction: '判断该二次根式是否有意义（被开方数必须≥0）',
          inputTarget: '是否有意义',
          inputHint: '输入 1 表示有意义，输入 0 表示无意义',
        },
      },
    ];
  },

  render: (params) => {
    const exprType: ExpressionType =
      params.exprType === 1 ? 'variable' :
      params.exprType === 2 ? 'complex' : 'simple';

    const expression = generateExpression(exprType, params);
    const hasMeaning = params.answer === 1;

    let context: string;
    if (hasMeaning) {
      context = `判断以下二次根式是否有意义：${expression}`;
    } else {
      context = `判断以下二次根式是否有意义：${expression}`;
    }

    return {
      title: '二次根式定义域判断',
      description: '判断二次根式是否有意义',
      context,
    };
  },
};
