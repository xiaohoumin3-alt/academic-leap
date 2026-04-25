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

  // 一元二次方程识别（第19章）
  quadratic_identify: {
    1: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1，降低难度
      b: { type: 'int', min: -3, max: 3 },
      c: { type: 'int', min: -2, max: 2 },
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -5, max: 5 },
      c: { type: 'int', min: -4, max: 4 },
    },
    3: {
      a: { type: 'int', min: 1, max: 2 },           // a开始变化
      b: { type: 'int', min: -7, max: 7 },
      c: { type: 'int', min: -6, max: 6 },
    },
    4: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -10, max: 10 },
      c: { type: 'int', min: -8, max: 8 },
    },
    5: {
      a: { type: 'int', min: 1, max: 4 },
      b: { type: 'int', min: -12, max: 12 },
      c: { type: 'int', min: -10, max: 10 },
    },
  },

  // 一元二次方程直接开平方法（第19章）
  quadratic_direct_root: {
    1: {
      a: { type: 'int', min: 1, max: 9 },           // 完全平方数：1, 4, 9
      m: { type: 'int', min: 1, max: 1 },           // 仅 x² = a 形式
      n: { type: 'int', min: 0, max: 0 },
    },
    2: {
      a: { type: 'int', min: 1, max: 16 },          // 完全平方数：1, 4, 9, 16
      m: { type: 'int', min: 1, max: 1 },           // 仅 x² = a 形式
      n: { type: 'int', min: 0, max: 0 },
    },
    3: {
      a: { type: 'int', min: 1, max: 25 },          // 完全平方数：1, 4, 9, 16, 25
      m: { type: 'int', min: 1, max: 2 },           // 可能出现 (mx+n)² = a
      n: { type: 'int', min: -4, max: 4 },
    },
    4: {
      a: { type: 'int', min: 1, max: 36 },          // 完全平方数：1, 4, 9, 16, 25, 36
      m: { type: 'int', min: 1, max: 3 },
      n: { type: 'int', min: -6, max: 6 },
    },
    5: {
      a: { type: 'int', min: 1, max: 49 },          // 完全平方数：1, 4, 9, 16, 25, 36, 49
      m: { type: 'int', min: 1, max: 4 },
      n: { type: 'int', min: -8, max: 8 },
    },
  },

  // 一元二次方程配方法（第19章）
  quadratic_complete_square: {
    1: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1，简化配方
      b: { type: 'int', min: 2, max: 4, exclude: [0] },  // b为偶数，配方简单
      c: { type: 'int', min: -3, max: 0 },          // c为负数或零
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: 2, max: 6, exclude: [0] },  // b为偶数
      c: { type: 'int', min: -5, max: 1 },
    },
    3: {
      a: { type: 'int', min: 1, max: 2 },           // a可能为2
      b: { type: 'int', min: 2, max: 8, exclude: [0] },  // b为偶数
      c: { type: 'int', min: -8, max: 2 },
    },
    4: {
      a: { type: 'int', min: 1, max: 3 },           // a可能为3
      b: { type: 'int', min: -10, max: 10, exclude: [0] },  // b可能为奇数
      c: { type: 'int', min: -10, max: 3 },
    },
    5: {
      a: { type: 'int', min: 1, max: 4 },
      b: { type: 'int', min: -12, max: 12, exclude: [0] },
      c: { type: 'int', min: -12, max: 4 },
    },
  },

  // 一元二次方程求根公式法（第19章）
  quadratic_formula: {
    1: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1，简化计算
      b: { type: 'int', min: -4, max: 4, exclude: [0] },
      c: { type: 'int', min: -3, max: 3 },
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -6, max: 6, exclude: [0] },
      c: { type: 'int', min: -5, max: 5 },
    },
    3: {
      a: { type: 'int', min: 1, max: 2 },           // a可能为2
      b: { type: 'int', min: -8, max: 8, exclude: [0] },
      c: { type: 'int', min: -6, max: 6 },
    },
    4: {
      a: { type: 'int', min: 1, max: 3 },
      b: { type: 'int', min: -10, max: 10, exclude: [0] },
      c: { type: 'int', min: -8, max: 8 },
    },
    5: {
      a: { type: 'int', min: 1, max: 4 },
      b: { type: 'int', min: -12, max: 12, exclude: [0] },
      c: { type: 'int', min: -10, max: 10 },
    },
  },

  // 一元二次方程因式分解法（第19章）
  quadratic_factorize: {
    1: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -5, max: 5 },          // b = p + q
      c: { type: 'int', min: -6, max: 6 },          // c = p * q
      p: { type: 'int', min: -3, max: 3 },          // 因式分解因子
      q: { type: 'int', min: -3, max: 3 },
    },
    2: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -8, max: 8 },
      c: { type: 'int', min: -12, max: 12 },
      p: { type: 'int', min: -6, max: 6 },
      q: { type: 'int', min: -6, max: 6 },
    },
    3: {
      a: { type: 'int', min: 1, max: 1 },           // a固定为1
      b: { type: 'int', min: -12, max: 12 },
      c: { type: 'int', min: -20, max: 20 },
      p: { type: 'int', min: -10, max: 10 },
      q: { type: 'int', min: -10, max: 10 },
    },
    4: {
      a: { type: 'int', min: 1, max: 2 },           // a可能为2
      b: { type: 'int', min: -15, max: 15 },
      c: { type: 'int', min: -25, max: 25 },
      p: { type: 'int', min: -12, max: 12 },
      q: { type: 'int', min: -12, max: 12 },
    },
    5: {
      a: { type: 'int', min: 1, max: 3 },           // a可能为2或3
      b: { type: 'int', min: -20, max: 20 },
      c: { type: 'int', min: -30, max: 30 },
      p: { type: 'int', min: -15, max: 15 },
      q: { type: 'int', min: -15, max: 15 },
    },
  },

  // 一元二次方程应用题 - 平均增长率（第19章）
  quadratic_growth: {
    1: {
      r: { type: 'int', min: 5, max: 15 },          // 增长率 5%-15%
      initialValue: { type: 'int', min: 100, max: 200 },  // 初值 100-200
    },
    2: {
      r: { type: 'int', min: 8, max: 20 },          // 增长率 8%-20%
      initialValue: { type: 'int', min: 100, max: 500 },  // 初值 100-500
    },
    3: {
      r: { type: 'int', min: 10, max: 25 },         // 增长率 10%-25%
      initialValue: { type: 'int', min: 100, max: 1000 }, // 初值 100-1000
    },
    4: {
      r: { type: 'int', min: 12, max: 30 },         // 增长率 12%-30%
      initialValue: { type: 'int', min: 200, max: 2000 }, // 初值 200-2000
    },
    5: {
      r: { type: 'int', min: 15, max: 40 },         // 增长率 15%-40%
      initialValue: { type: 'int', min: 500, max: 5000 }, // 初值 500-5000
    },
  },

  // 一元二次方程面积应用题（第19章）
  quadratic_area: {
    1: {
      width: { type: 'int', min: 2, max: 5 },              // 宽：2-5
      length: { type: 'int', min: 3, max: 8 },             // 长：3-8
      lengthRelation: { type: 'int', min: 2, max: 2 },     // 长是宽的2倍
      side: { type: 'int', min: 3, max: 6 },               // 边长：3-6
      increase: { type: 'int', min: 1, max: 2 },           // 增加1-2
      decrease: { type: 'int', min: 1, max: 2 },           // 减少1-2
    },
    2: {
      width: { type: 'int', min: 2, max: 8 },
      length: { type: 'int', min: 4, max: 12 },
      lengthRelation: { type: 'int', min: 2, max: 3 },     // 长是宽的2-3倍
      side: { type: 'int', min: 4, max: 10 },
      increase: { type: 'int', min: 1, max: 3 },
      decrease: { type: 'int', min: 1, max: 3 },
    },
    3: {
      width: { type: 'int', min: 3, max: 12 },
      length: { type: 'int', min: 5, max: 18 },
      lengthRelation: { type: 'int', min: 2, max: 4 },     // 长是宽的2-4倍
      side: { type: 'int', min: 5, max: 15 },
      increase: { type: 'int', min: 2, max: 4 },
      decrease: { type: 'int', min: 2, max: 4 },
    },
    4: {
      width: { type: 'int', min: 4, max: 15 },
      length: { type: 'int', min: 6, max: 24 },
      lengthRelation: { type: 'int', min: 2, max: 5 },     // 长是宽的2-5倍
      side: { type: 'int', min: 6, max: 20 },
      increase: { type: 'int', min: 2, max: 5 },
      decrease: { type: 'int', min: 2, max: 5 },
    },
    5: {
      width: { type: 'int', min: 5, max: 20 },
      length: { type: 'int', min: 8, max: 30 },
      lengthRelation: { type: 'int', min: 2, max: 6 },     // 长是宽的2-6倍
      side: { type: 'int', min: 8, max: 25 },
      increase: { type: 'int', min: 3, max: 6 },
      decrease: { type: 'int', min: 3, max: 6 },
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
