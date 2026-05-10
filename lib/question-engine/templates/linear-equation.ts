/**
 * 一次方程题目模板
 * 支持: one-step, two-step, multi-step, fraction
 */

import { QuestionTemplate, StepType } from '../protocol';
import { DIFFICULTY_CONFIG, generateRandomParams, formatNumber } from '../difficulty';

/**
 * 方程类型
 */
export type EquationType =
  | 'one-step'      // ax = b
  | 'two-step'      // ax + b = c
  | 'multi-step'    // ax + b = cx + d
  | 'fraction';     // (a/b)x = c

/**
 * 生成参数接口
 */
interface LinearEquationParams {
  a: number;        // x的系数
  b: number;        // 常数项(在one-step中为b, 在two-step中为移项后的常数)
  c: number;        // 等号右侧常数
  d?: number;       // 右边的cx系数(multi-step)
  x: number;        // 解
  equationType: EquationType;
}

/**
 * 格式化带符号的系数显示
 */
function formatCoeff(n: number, isFirst: boolean = false): string {
  if (n === 0) return '0';
  if (n === 1) return isFirst ? 'x' : '+ x';
  if (n === -1) return '- x';
  if (n > 0) return isFirst ? `${n}x` : `+ ${n}x`;
  return `${n}x`;
}

/**
 * 格式化常数显示
 */
function formatConst(n: number, showSign: boolean = true): string {
  if (showSign) {
    return n >= 0 ? `+ ${n}` : `${n}`;
  }
  return `${n}`;
}

/**
 * 生成一次方程参数
 * 支持多种方程类型，有理解析
 */
function generateLinearEquationParams(
  level: number,
  equationType?: EquationType
): LinearEquationParams {
  const config = DIFFICULTY_CONFIG.linear_equation[level] ||
                 DIFFICULTY_CONFIG.linear_equation[1];

  // 确定方程类型
  let type = equationType;
  if (!type) {
    const types: EquationType[] = ['one-step', 'two-step', 'multi-step', 'fraction'];
    // 根据难度选择类型
    if (level <= 2) {
      type = types[Math.floor(Math.random() * 2)]; // one-step 或 two-step
    } else if (level <= 4) {
      type = types[Math.floor(Math.random() * 3)]; // 不含 fraction
    } else {
      type = types[Math.floor(Math.random() * types.length)];
    }
  }

  // 生成目标解 x，范围 [-20, 20]
  const xMin = config.x?.min ?? -12;
  const xMax = config.x?.max ?? 12;
  const x = Math.floor(Math.random() * (xMax - xMin + 1)) + xMin;

  // Generate coefficient a, range [-10, 10], non-zero
  const aMin = config.a?.min ?? 1;
  const aMax = config.a?.max ?? 10;
  let a = Math.floor(Math.random() * (aMax - aMin + 1)) + aMin;
  if (Math.random() > 0.5) a = -a;
  if (a === 0) a = 1;

  let b: number, c: number, d: number | undefined;
  let attempts = 0;

  switch (type) {
    case 'one-step': {
      // ax = b 形式，b = a * x
      b = a * x;
      c = b; // 右侧常数
      break;
    }

    case 'two-step': {
      // ax + b = c 形式
      // x = (c - b) / a，所以 c = a * x + b
      const bMin = config.b?.min ?? -10;
      const bMax = config.b?.max ?? 10;
      b = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;
      if (b === 0) b = 1; // 避免零
      c = a * x + b;
      break;
    }

    case 'multi-step': {
      // ax + b = cx + d 形式
      // 移项: (a - c)x = d - b
      // x = (d - b) / (a - c)
      // 确保 (a - c) != 0
      const cMin = config.a?.min ?? 1;
      const cMax = config.a?.max ?? 10;
      const bMin = config.b?.min ?? -10;
      const bMax = config.b?.max ?? 10;

      // 确保解在合理范围内
      do {
        d = Math.floor(Math.random() * (cMax - cMin + 1)) + cMin;
        if (Math.random() > 0.5) d = -d;
        if (d === 0) d = 1;

        b = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;
        if (b === 0 && d === 0) b = 1;

        attempts++;
      } while ((a === d || (d - b) % (a - d) !== 0) && attempts < 100);

      // 计算 c (右侧常数)
      c = d; // 使用 d 作为右侧的 x 系数
      // 确保有整数解
      const diff = a - d;
      if (diff !== 0) {
        c = d;
      } else {
        // 退回到 two-step
        type = 'two-step';
        b = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;
        if (b === 0) b = 1;
        c = a * x + b;
      }
      break;
    }

    case 'fraction': {
      // (a/b)x = c 形式，或 a/b * x = c
      // 解: x = b * c / a
      const bMin = config.a?.min ?? 2;
      const bMax = config.a?.max ?? 10;
      let denominator = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;
      if (denominator === 0) denominator = 1;
      if (Math.random() > 0.5) denominator = -denominator;
      if (Math.abs(denominator) === 1) denominator = denominator > 0 ? 2 : -2;

      // 确保 c = (denominator / numerator) * x 是整数
      // 即 denominator * x 必须被 numerator 整除
      let numerator = Math.floor(Math.random() * (aMax - aMin + 1)) + aMin;
      if (numerator === 0) numerator = 1;
      if (Math.random() > 0.5) numerator = -numerator;
      if (Math.abs(numerator) === 1) numerator = numerator > 0 ? 2 : -2;

      // c = (denominator / numerator) * x，结果应为整数
      // 重新选择分子分母，确保 x 是整数解
      attempts = 0;
      do {
        denominator = Math.floor(Math.random() * 8) + 2;
        if (Math.random() > 0.5) denominator = -denominator;

        numerator = Math.floor(Math.random() * 8) + 2;
        if (Math.random() > 0.5) numerator = -numerator;

        attempts++;
      } while ((denominator * x) % numerator !== 0 && attempts < 100);

      // 对于 fraction 类型，a 表示分子，b 表示分母
      // (a/b)x = c，所以 a/b * x = c
      // 即 x = b * c / a，c 应为整数
      b = denominator; // 分母
      a = numerator;   // 分子
      c = (denominator * x) / numerator; // 右侧常数
      break;
    }

    default:
      // 默认使用 two-step
      type = 'two-step';
      const bMin = config.b?.min ?? -10;
      const bMax = config.b?.max ?? 10;
      b = Math.floor(Math.random() * (bMax - bMin + 1)) + bMin;
      if (b === 0) b = 1;
      c = a * x + b;
  }

  return { a, b, c, d, x, equationType: type };
}

/**
 * 根据参数生成方程字符串
 */
function buildEquationString(params: LinearEquationParams): string {
  const { a, b, c, d, equationType } = params;

  switch (equationType) {
    case 'one-step':
      return `${formatCoeff(a, true)} = ${c}`;

    case 'two-step':
      return `${formatCoeff(a, true)} ${formatConst(b)} = ${c}`;

    case 'multi-step':
      if (d !== undefined) {
        return `${formatCoeff(a, true)} ${formatConst(b)} = ${formatCoeff(d)}${formatConst(c)}`;
      }
      return `${formatCoeff(a, true)} ${formatConst(b)} = ${c}`;

    case 'fraction':
      const aStr = Math.abs(a) === 1 ? '' : Math.abs(a).toString();
      const bStr = Math.abs(b) === 1 ? '' : Math.abs(b).toString();
      const sign = a * b > 0 ? '-' : '+';
      return `${aStr}/${Math.abs(b)}x ${sign} ${Math.abs(a) * Math.abs(c) / Math.abs(b)} = 0`;

    default:
      return `${formatCoeff(a, true)} ${formatConst(b)} = ${c}`;
  }
}

/**
 * 计算标准解法步骤
 */
function getSolutionSteps(params: LinearEquationParams): string[] {
  const { a, b, c, d, x, equationType } = params;
  const steps: string[] = [];

  switch (equationType) {
    case 'one-step':
      steps.push(`ax = b`);
      steps.push(`x = b / a`);
      steps.push(`x = ${c} / ${a} = ${formatNumber(x)}`);
      break;

    case 'two-step':
      steps.push(`${formatCoeff(a, true)} ${formatConst(b)} = ${c}`);
      steps.push(`${formatCoeff(a, true)} = ${c} ${b >= 0 ? `- ${b}` : `+ ${Math.abs(b)}`}`);
      steps.push(`x = ${(c - b).toString()} / ${a} = ${formatNumber(x)}`);
      break;

    case 'multi-step':
      if (d !== undefined) {
        steps.push(`${formatCoeff(a, true)} ${formatConst(b)} = ${formatCoeff(d)} ${formatConst(c)}`);
        steps.push(`${formatCoeff(a - d)} ${formatConst(b - c)} = 0`);
        steps.push(`${a - d}x = ${c - b}`);
        steps.push(`x = ${c - b} / ${a - d} = ${formatNumber(x)}`);
      }
      break;

    case 'fraction':
      steps.push(`(${a}/${b})x = ${c}`);
      steps.push(`x = ${c} * (${b}/${a})`);
      steps.push(`x = ${c * b} / ${a} = ${formatNumber(x)}`);
      break;
  }

  return steps;
}

/**
 * 一次方程模板
 */
export const LinearEquationTemplate: QuestionTemplate = {
  id: 'linear_equation_v2',
  knowledgePoint: 'linear-equation',

  generateParams: (level: number): Record<string, number> => {
    const params = generateLinearEquationParams(level);
    // Convert to plain record for compatibility
    return {
      a: params.a,
      b: params.b,
      c: params.c,
      d: params.d ?? 0,
      x: params.x,
      // Store equationType as numeric code for regeneration
      equationTypeCode: ['one-step', 'two-step', 'multi-step', 'fraction'].indexOf(params.equationType),
    };
  },

  buildSteps: (params) => {
    const linearParams = params as unknown as LinearEquationParams;

    return [
      {
        stepId: 'solve',
        type: StepType.SOLVE_LINEAR_EQUATION,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '解方程',
          inputTarget: 'x 的值',
          inputHint: '输入数字，保留三位小数',
        },
      },
    ];
  },

  render: (params) => {
    const linearParams = params as unknown as LinearEquationParams;
    const equation = buildEquationString(linearParams);
    const steps = getSolutionSteps(linearParams);

    return {
      title: `解方程: ${equation}`,
      description: '一元一次方程求解',
      context: steps.join(' → '),
    };
  },
};

/**
 * 便利函数：生成指定类型的一次方程题目
 */
export function generateLinearEquation(
  difficulty: number,
  equationType?: EquationType
): LinearEquationParams {
  return generateLinearEquationParams(difficulty, equationType);
}

/**
 * 验证答案
 */
export function validateAnswer(
  question: { params: Record<string, number> },
  studentAnswer: string
): boolean {
  const params = question.params as unknown as LinearEquationParams;
  const expectedX = params.x;

  // 解析学生答案
  const studentX = parseFloat(studentAnswer.trim());

  if (isNaN(studentX)) {
    return false;
  }

  // 容差比较
  const tolerance = 0.001;
  return Math.abs(studentX - expectedX) < tolerance;
}

/**
 * 获取方程类型的显示名称
 */
export function getEquationTypeName(type: EquationType): string {
  const names: Record<EquationType, string> = {
    'one-step': '一步方程 (ax = b)',
    'two-step': '两步方程 (ax + b = c)',
    'multi-step': '多步方程 (ax + b = cx + d)',
    'fraction': '分式方程 (a/b)x = c',
  };
  return names[type];
}