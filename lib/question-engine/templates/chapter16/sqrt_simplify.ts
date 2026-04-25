/**
 * 最简二次根式模板
 * 化简√(a²b) = a√b形式
 * 学生提取完全平方因子
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
type SimplifyType = 'basic' | 'with_var' | 'fraction' | 'nested';

/**
 * 生成被开方数（确保有完全平方因子）
 */
function generateRadicand(level: number): { radicand: number; perfectSquare: number; remaining: number } {
  // 生成完全平方数（1, 4, 9, 16, 25, 36, 49, 64, 81, 100）
  const perfectSquares = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];

  // 根据难度选择完全平方因子
  let maxSquareIndex: number;
  if (level <= 2) maxSquareIndex = 3;  // 最多16
  else if (level <= 4) maxSquareIndex = 5;  // 最多36
  else maxSquareIndex = 9;  // 最多100

  const squareIndex = Math.floor(Math.random() * (maxSquareIndex + 1));
  const perfectSquare = perfectSquares[squareIndex];
  const sqrtPart = Math.sqrt(perfectSquare);

  // 生成剩余部分（不能是完全平方数）
  let remaining: number;
  let attempts = 0;
  do {
    if (level <= 2) {
      remaining = Math.floor(Math.random() * 10) + 2;  // 2-11
    } else if (level <= 4) {
      remaining = Math.floor(Math.random() * 20) + 2;  // 2-21
    } else {
      remaining = Math.floor(Math.random() * 30) + 2;  // 2-31
    }
    attempts++;
  } while (perfectSquares.includes(remaining * remaining) && attempts < 50);

  const radicand = perfectSquare * remaining;

  return { radicand, perfectSquare, remaining };
}

/**
 * 生成表达式字符串
 */
function generateExpression(
  simplifyType: SimplifyType,
  params: Record<string, number>
): { expression: string; outsideSqrt: number; insideSqrt: number } {
  switch (simplifyType) {
    case 'basic':
      // 基本形式：√n
      return {
        expression: `√${params.radicand}`,
        outsideSqrt: params.perfectSquareSqrt,
        insideSqrt: params.remaining,
      };

    case 'with_var':
      // 带变量形式：√(n·x²)
      const varExp = params.varExp || 2;
      const varBase = String.fromCharCode(97 + (params.varIndex || 0)); // a, b, c, ...
      return {
        expression: `√(${params.radicand}${varBase}²)`,
        outsideSqrt: params.perfectSquareSqrt,
        insideSqrt: params.remaining,
      };

    case 'fraction':
      // 分数形式：√(n/m)
      return {
        expression: `√(${params.numerator}/${params.denominator})`,
        outsideSqrt: params.perfectSquareSqrt,
        insideSqrt: params.remaining,
      };

    case 'nested':
      // 嵌套形式：√(n·√m) - 简化为外层提取
      return {
        expression: `√(${params.radicand}√${params.nested})`,
        outsideSqrt: params.perfectSquareSqrt,
        insideSqrt: params.remaining,
      };

    default:
      return {
        expression: `√${params.radicand}`,
        outsideSqrt: params.perfectSquareSqrt,
        insideSqrt: params.remaining,
      };
  }
}

/**
 * 最简二次根式模板
 */
export const SqrtSimplifyTemplate: QuestionTemplate = {
  id: 'sqrt_simplify',
  knowledgePoint: 'sqrt_simplify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.sqrt_simplify[level] ||
                   DIFFICULTY_CONFIG.sqrt_simplify[1];

    const params = generateRandomParams(config);

    // 生成被开方数
    const { radicand, perfectSquare, remaining } = generateRadicand(level);
    params.radicand = radicand;
    params.perfectSquare = perfectSquare;
    params.perfectSquareSqrt = Math.sqrt(perfectSquare);
    params.remaining = remaining;

    // 确定化简类型
    let simplifyType: SimplifyType;
    if (level <= 2) {
      simplifyType = 'basic';
    } else if (level <= 3) {
      simplifyType = Math.random() < 0.6 ? 'basic' : 'with_var';
    } else if (level <= 4) {
      const rand = Math.random();
      if (rand < 0.4) simplifyType = 'basic';
      else if (rand < 0.7) simplifyType = 'with_var';
      else simplifyType = 'fraction';
    } else {
      const rand = Math.random();
      if (rand < 0.3) simplifyType = 'basic';
      else if (rand < 0.5) simplifyType = 'with_var';
      else if (rand < 0.8) simplifyType = 'fraction';
      else simplifyType = 'nested';
    }

    // 根据类型生成额外参数
    switch (simplifyType) {
      case 'with_var':
        params.varExp = 2;
        params.varIndex = Math.floor(Math.random() * 3); // 0-2 -> a, b, c
        params.simplifyType = 1;
        break;

      case 'fraction':
        // 生成分数，确保分子有完全平方因子
        const { radicand: num, perfectSquare: numSq, remaining: numRem } = generateRadicand(level);
        params.numerator = num;
        params.denominator = Math.floor(Math.random() * 9) + 2; // 2-10
        params.perfectSquareSqrt = Math.sqrt(numSq);
        params.remaining = numRem;
        params.simplifyType = 2;
        break;

      case 'nested':
        params.nested = Math.floor(Math.random() * 10) + 2;
        params.simplifyType = 3;
        break;

      default:
        params.simplifyType = 0;
    }

    // 计算答案：根号外的数
    if (simplifyType !== 'fraction') {
      params.answer = params.perfectSquareSqrt;
    } else {
      params.answer = params.perfectSquareSqrt;
    }

    params.level = level;

    return params;
  },

  buildSteps: (params) => {
    const simplifyType: SimplifyType =
      params.simplifyType === 1 ? 'with_var' :
      params.simplifyType === 2 ? 'fraction' :
      params.simplifyType === 3 ? 'nested' : 'basic';

    const { expression, outsideSqrt, insideSqrt } = generateExpression(simplifyType, params);

    let instruction: string;
    if (simplifyType === 'basic') {
      instruction = `将√${params.radicand}化为最简二次根式（提取完全平方因子）`;
    } else if (simplifyType === 'with_var') {
      instruction = '将含变量的二次根式化为最简形式';
    } else if (simplifyType === 'fraction') {
      instruction = '将根号下的分数化为最简形式';
    } else {
      instruction = '化简嵌套的二次根式';
    }

    return [
      {
        stepId: 's1',
        type: StepType.SIMPLIFY_SQRT,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0,
        ui: {
          instruction,
          inputTarget: '根号外的系数',
          inputHint: '输入提取到根号外的整数系数',
        },
      },
    ];
  },

  render: (params) => {
    const simplifyType: SimplifyType =
      params.simplifyType === 1 ? 'with_var' :
      params.simplifyType === 2 ? 'fraction' :
      params.simplifyType === 3 ? 'nested' : 'basic';

    const { expression } = generateExpression(simplifyType, params);

    let context: string;
    if (simplifyType === 'basic') {
      context = `化简：${expression} = ___√${params.remaining}`;
    } else if (simplifyType === 'with_var') {
      const varBase = String.fromCharCode(97 + (params.varIndex || 0));
      context = `化简：${expression} = ___${varBase}√${params.remaining}`;
    } else if (simplifyType === 'fraction') {
      context = `化简：${expression} = ___√${params.remaining}/${params.denominator}`;
    } else {
      context = `化简：${expression}`;
    }

    return {
      title: '最简二次根式化简',
      description: '将二次根式化为最简形式',
      context,
    };
  },
};
