/**
 * 二次根式性质模板
 * √(a²) = |a| 性质
 * 学生化简√(a²)为|a|，考虑a的正负
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
type PropertyType = 'simple_square' | 'var_square' | 'expr_square' | 'with_sign';

/**
 * 生成表达式字符串
 */
function generateExpression(
  propertyType: PropertyType,
  params: Record<string, number>
): { expression: string; absValue: number; explanation: string } {
  switch (propertyType) {
    case 'simple_square':
      // 简单形式：√(a²)
      const a = params.a || 0;
      return {
        expression: `√(${a}²)`,
        absValue: Math.abs(a),
        explanation: `√(${a}²) = |${a}| = ${Math.abs(a)}`,
      };

    case 'var_square':
      // 变量形式：√(x²) = |x|
      const varBase = String.fromCharCode(120 + (params.varIndex || 0)); // x, y, z
      const varValue = params.varValue || 0;
      return {
        expression: `√(${varBase}²)`,
        absValue: Math.abs(varValue),
        explanation: `√(${varBase}²) = |${varBase}|，当${varBase}=${varValue}时，|${varBase}|=${Math.abs(varValue)}`,
      };

    case 'expr_square':
      // 表达式形式：√((a+b)²)
      const exprA = params.exprA || 0;
      const exprB = params.exprB || 0;
      const sum = exprA + exprB;
      const signB = exprB >= 0 ? `+ ${exprB}` : `- ${Math.abs(exprB)}`;
      return {
        expression: `√((${exprA}${signB})²)`,
        absValue: Math.abs(sum),
        explanation: `√((${exprA}${signB})²) = |${exprA}${signB}| = |${sum}| = ${Math.abs(sum)}`,
      };

    case 'with_sign':
      // 带符号形式：√((-a)²) 或 √((±a)²)
      const base = params.base || 0;
      const sign = params.sign || 1; // 1 = positive, -1 = negative
      const signedValue = sign * base;
      const signStr = sign >= 0 ? '' : '-';
      return {
        expression: `√((${signStr}${base})²)`,
        absValue: Math.abs(signedValue),
        explanation: `√((${signStr}${base})²) = |${signedValue}| = ${Math.abs(signedValue)}`,
      };

    default:
      return {
        expression: `√(${params.a}²)`,
        absValue: Math.abs(params.a || 0),
        explanation: `√(${params.a}²) = |${params.a}| = ${Math.abs(params.a || 0)}`,
      };
  }
}

/**
 * 二次根式性质模板
 */
export const SqrtPropertyTemplate: QuestionTemplate = {
  id: 'sqrt_property',
  knowledgePoint: 'sqrt_property',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.sqrt_property[level] ||
                   DIFFICULTY_CONFIG.sqrt_property[1];

    const params = generateRandomParams(config);

    // 确定表达式类型
    let propertyType: PropertyType;
    if (level <= 2) {
      propertyType = 'simple_square';
    } else if (level <= 3) {
      propertyType = Math.random() < 0.7 ? 'simple_square' : 'with_sign';
    } else if (level <= 4) {
      const rand = Math.random();
      if (rand < 0.4) propertyType = 'simple_square';
      else if (rand < 0.7) propertyType = 'with_sign';
      else propertyType = 'var_square';
    } else {
      const rand = Math.random();
      if (rand < 0.3) propertyType = 'simple_square';
      else if (rand < 0.5) propertyType = 'with_sign';
      else if (rand < 0.8) propertyType = 'var_square';
      else propertyType = 'expr_square';
    }

    // 根据类型生成参数
    switch (propertyType) {
      case 'simple_square':
        // 生成整数a，可以是负数
        if (level <= 2) {
          params.a = Math.floor(Math.random() * 11); // 0-10
        } else if (level <= 4) {
          params.a = Math.floor(Math.random() * 21) - 10; // -10到10
        } else {
          params.a = Math.floor(Math.random() * 31) - 15; // -15到15
        }
        params.propertyType = 0;
        break;

      case 'var_square':
        // 变量形式，给定变量的值
        params.varIndex = Math.floor(Math.random() * 3); // 0-2 -> x, y, z
        if (level <= 4) {
          params.varValue = Math.floor(Math.random() * 21) - 10; // -10到10
        } else {
          params.varValue = Math.floor(Math.random() * 31) - 15; // -15到15
        }
        params.propertyType = 1;
        break;

      case 'expr_square':
        // 表达式形式
        if (level <= 4) {
          params.exprA = Math.floor(Math.random() * 11) - 5; // -5到5
          params.exprB = Math.floor(Math.random() * 11) - 5; // -5到5
        } else {
          params.exprA = Math.floor(Math.random() * 16) - 8; // -8到8
          params.exprB = Math.floor(Math.random() * 16) - 8; // -8到8
        }
        params.propertyType = 2;
        break;

      case 'with_sign':
        // 带符号形式
        if (level <= 4) {
          params.base = Math.floor(Math.random() * 11) + 1; // 1-11
        } else {
          params.base = Math.floor(Math.random() * 16) + 1; // 1-16
        }
        params.sign = Math.random() < 0.5 ? 1 : -1;
        params.propertyType = 3;
        break;
    }

    // 计算答案：绝对值
    let answer: number;
    switch (propertyType) {
      case 'simple_square':
        answer = Math.abs(params.a);
        break;
      case 'var_square':
        answer = Math.abs(params.varValue);
        break;
      case 'expr_square':
        answer = Math.abs(params.exprA + params.exprB);
        break;
      case 'with_sign':
        answer = Math.abs(params.sign * params.base);
        break;
      default:
        answer = Math.abs(params.a || 0);
    }

    params.answer = answer;
    params.level = level;

    return params;
  },

  buildSteps: (params) => {
    const propertyType: PropertyType =
      params.propertyType === 1 ? 'var_square' :
      params.propertyType === 2 ? 'expr_square' :
      params.propertyType === 3 ? 'with_sign' : 'simple_square';

    const { expression, absValue, explanation } = generateExpression(propertyType, params);

    let instruction: string;
    if (propertyType === 'simple_square') {
      instruction = `化简${expression}（使用√(a²)=|a|性质）`;
    } else if (propertyType === 'var_square') {
      instruction = '化简变量形式的平方根';
    } else if (propertyType === 'expr_square') {
      instruction = '化简表达式形式的平方根';
    } else {
      instruction = '化简带符号的平方根';
    }

    return [
      {
        stepId: 's1',
        type: StepType.SQRT_PROPERTY,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0,
        ui: {
          instruction,
          inputTarget: '化简后的值',
          inputHint: '输入化简后的数值（绝对值）',
        },
      },
    ];
  },

  render: (params) => {
    const propertyType: PropertyType =
      params.propertyType === 1 ? 'var_square' :
      params.propertyType === 2 ? 'expr_square' :
      params.propertyType === 3 ? 'with_sign' : 'simple_square';

    const { expression, absValue, explanation } = generateExpression(propertyType, params);

    let context: string;
    if (propertyType === 'simple_square') {
      context = `化简：${expression} = ？`;
    } else if (propertyType === 'var_square') {
      const varBase = String.fromCharCode(120 + (params.varIndex || 0));
      context = `已知${varBase}=${params.varValue}，化简：${expression} = ？`;
    } else if (propertyType === 'expr_square') {
      context = `化简：${expression} = ？`;
    } else {
      context = `化简：${expression} = ？`;
    }

    return {
      title: '二次根式性质化简',
      description: '利用√(a²)=|a|性质化简',
      context,
    };
  },
};
