/**
 * 难度配置
 * 难度 = 参数空间复杂度
 */

import { ParamConstraint } from './protocol';

/**
 * 难度级别配置接口
 */
export interface DifficultyLevelConfig {
  [paramName: string]: ParamConstraint;
}

/**
 * 各题型难度配置
 */
export const DIFFICULTY_CONFIG: Record<string, Record<number, DifficultyLevelConfig>> = {
  // 二次函数-顶点
  quadratic_vertex: {
    1: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -4, max: 4, exclude: [0] },
      c: { type: 'int', min: -3, max: 3 },
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -6, max: 6, exclude: [0] },
      c: { type: 'int', min: -5, max: 5 },
    },
    3: {
      a: { type: 'int', min: 1, max: 2 },           // a开始变化
      b: { type: 'int', min: -8, max: 8, exclude: [0] },
      c: { type: 'int', min: -6, max: 6 },
    },
    4: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -10, max: 10, exclude: [0] },
      c: { type: 'int', min: -8, max: 8 },
    },
    5: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -12, max: 12, exclude: [0] },
      c: { type: 'int', min: -10, max: 10 },
    },
  },

  // 二次函数-求值
  quadratic_evaluate: {
    1: {
      a: { type: 'int', min: 1, max: 1 },
      b: { type: 'int', min: -4, max: 4 },
      c: { type: 'int', min: -3, max: 3 },
      x: { type: 'int', min: -2, max: 2 },
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },
      b: { type: 'int', min: -6, max: 6 },
      c: { type: 'int', min: -5, max: 5 },
      x: { type: 'int', min: -3, max: 3 },
    },
    3: {
      a: { type: 'int', min: 1, max: 2 },
      b: { type: 'int', min: -8, max: 8 },
      c: { type: 'int', min: -6, max: 6 },
      x: { type: 'int', min: -4, max: 4 },
    },
    4: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -10, max: 10 },
      c: { type: 'int', min: -8, max: 8 },
      x: { type: 'int', min: -5, max: 5 },
    },
    5: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -12, max: 12 },
      c: { type: 'int', min: -10, max: 10 },
      x: { type: 'int', min: -6, max: 6 },
    },
  },

  // 勾股定理
  pythagoras: {
    1: {
      a: { type: 'int', min: 3, max: 6 },
      b: { type: 'int', min: 4, max: 8 },
    },
    2: {
      a: { type: 'int', min: 3, max: 8 },
      b: { type: 'int', min: 4, max: 10 },
    },
    3: {
      a: { type: 'int', min: 3, max: 10 },
      b: { type: 'int', min: 4, max: 12 },
    },
    4: {
      a: { type: 'int', min: 3, max: 12 },
      b: { type: 'int', min: 4, max: 15 },
    },
    5: {
      a: { type: 'int', min: 3, max: 15 },
      b: { type: 'int', min: 4, max: 18 },
    },
  },

  // 概率统计
  probability: {
    1: {
      total: { type: 'int', min: 10, max: 20 },
      favorable: { type: 'int', min: 1, max: 10 },
    },
    2: {
      total: { type: 'int', min: 20, max: 50 },
      favorable: { type: 'int', min: 1, max: 25 },
    },
    3: {
      total: { type: 'int', min: 50, max: 100 },
      favorable: { type: 'int', min: 1, max: 50 },
    },
    4: {
      total: { type: 'int', min: 100, max: 200 },
      favorable: { type: 'int', min: 1, max: 100 },
    },
    5: {
      total: { type: 'int', min: 200, max: 500 },
      favorable: { type: 'int', min: 1, max: 250 },
    },
  },

  // 一元一次方程
  linear_equation: {
    1: {
      a: { type: 'int', min: 1, max: 5 },
      b: { type: 'int', min: -5, max: 5 },
      x: { type: 'int', min: -3, max: 3 },
    },
    2: {
      a: { type: 'int', min: 1, max: 8 },
      b: { type: 'int', min: -10, max: 10 },
      x: { type: 'int', min: -5, max: 5 },
    },
    3: {
      a: { type: 'int', min: 1, max: 10 },
      b: { type: 'int', min: -15, max: 15 },
      x: { type: 'int', min: -8, max: 8 },
    },
    4: {
      a: { type: 'int', min: 2, max: 12 },
      b: { type: 'int', min: -20, max: 20 },
      x: { type: 'int', min: -10, max: 10 },
    },
    5: {
      a: { type: 'int', min: 2, max: 15 },
      b: { type: 'int', min: -25, max: 25 },
      x: { type: 'int', min: -12, max: 12 },
    },
  },
};

/**
 * 根据约束生成随机参数
 */
export function generateRandomParams(
  config: DifficultyLevelConfig,
  overrides?: Record<string, number>
): Record<string, number> {
  const params: Record<string, number> = {};

  for (const [name, constraint] of Object.entries(config)) {
    if (overrides?.[name] !== undefined) {
      params[name] = overrides[name];
      continue;
    }

    let value: number;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      if (constraint.type === 'int') {
        value = Math.floor(Math.random() * (constraint.max - constraint.min + 1)) + constraint.min;
      } else {
        value = Math.random() * (constraint.max - constraint.min) + constraint.min;
      }
      attempts++;
    } while (
      constraint.exclude?.includes(value) &&
      attempts < maxAttempts
    );

    params[name] = value;
  }

  return params;
}

/**
 * 格式化带符号数字
 */
export function formatSigned(n: number): string {
  return n >= 0 ? `+ ${n}` : `${n}`;
}

/**
 * 格式化数字为字符串（去除不必要的小数点）
 */
export function formatNumber(n: number, decimals: number = 2): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return n.toFixed(decimals);
}
