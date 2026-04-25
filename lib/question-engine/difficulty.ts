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
      a: { type: 'int', min: 5, max: 10 },
      b: { type: 'int', min: 6, max: 12 },
    },
    3: {
      a: { type: 'int', min: 7, max: 14 },
      b: { type: 'int', min: 8, max: 16 },
    },
    4: {
      a: { type: 'int', min: 9, max: 18 },
      b: { type: 'int', min: 10, max: 20 },
    },
    5: {
      a: { type: 'int', min: 12, max: 24 },
      b: { type: 'int', min: 13, max: 26 },
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

  // 集中趋势测量（第20章）
  central_tendency: {
    1: {
      count: { type: 'int', min: 5, max: 7 },        // 5-7个数据
      value: { type: 'int', min: 1, max: 20 },       // 1-20的整数
    },
    2: {
      count: { type: 'int', min: 7, max: 10 },       // 7-10个数据
      value: { type: 'int', min: 1, max: 50 },       // 1-50的整数
    },
    3: {
      count: { type: 'int', min: 10, max: 15 },      // 10-15个数据
      value: { type: 'int', min: 1, max: 100 },      // 1-100的整数
    },
    4: {
      count: { type: 'int', min: 15, max: 20 },      // 15-20个数据
      value: { type: 'int', min: -50, max: 150 },    // -50到150的整数（包含负数）
    },
    5: {
      count: { type: 'int', min: 20, max: 30 },      // 20-30个数据
      value: { type: 'float', min: -100, max: 200 }, // -100到200的浮点数（一位小数）
    },
  },

  // 数据分析 - 标准差（第20章）
  data_stddev: {
    1: {
      count: { type: 'int', min: 5, max: 5 },       // 固定5个数据
      minVal: { type: 'int', min: 1, max: 10 },     // 数值范围小
      maxVal: { type: 'int', min: 11, max: 20 },
    },
    2: {
      count: { type: 'int', min: 5, max: 7 },       // 5-7个数据
      minVal: { type: 'int', min: 1, max: 15 },
      maxVal: { type: 'int', min: 16, max: 30 },
    },
    3: {
      count: { type: 'int', min: 6, max: 8 },       // 6-8个数据
      minVal: { type: 'int', min: 1, max: 20 },
      maxVal: { type: 'int', min: 21, max: 40 },
    },
    4: {
      count: { type: 'int', min: 7, max: 10 },      // 7-10个数据
      minVal: { type: 'int', min: 1, max: 25 },
      maxVal: { type: 'int', min: 26, max: 50 },
    },
    5: {
      count: { type: 'int', min: 8, max: 12 },      // 8-12个数据
      minVal: { type: 'int', min: 1, max: 30 },
      maxVal: { type: 'int', min: 31, max: 60 },
    },
  },

  // 数据分析 - 方差（第20章）
  data_variance: {
    1: {
      count: { type: 'int', min: 5, max: 5 },       // 固定5个数据
      minVal: { type: 'int', min: 1, max: 10 },     // 数值范围小
      maxVal: { type: 'int', min: 11, max: 20 },
    },
    2: {
      count: { type: 'int', min: 5, max: 7 },       // 5-7个数据
      minVal: { type: 'int', min: 1, max: 15 },
      maxVal: { type: 'int', min: 16, max: 30 },
    },
    3: {
      count: { type: 'int', min: 6, max: 8 },       // 6-8个数据
      minVal: { type: 'int', min: 1, max: 20 },
      maxVal: { type: 'int', min: 21, max: 40 },
    },
    4: {
      count: { type: 'int', min: 7, max: 10 },      // 7-10个数据
      minVal: { type: 'int', min: 1, max: 25 },
      maxVal: { type: 'int', min: 26, max: 50 },
    },
    5: {
      count: { type: 'int', min: 8, max: 12 },      // 8-12个数据
      minVal: { type: 'int', min: 1, max: 30 },
      maxVal: { type: 'int', min: 31, max: 60 },
    },
  },

  // 二次根式定义域（第16章）
  sqrt_concept: {
    1: {
      a: { type: 'int', min: -5, max: 10 },         // 包含负数和无意义的数
    },
    2: {
      a: { type: 'int', min: -10, max: 15 },
    },
    3: {
      a: { type: 'int', min: -15, max: 20 },
    },
    4: {
      a: { type: 'int', min: -20, max: 25 },
    },
    5: {
      a: { type: 'int', min: -25, max: 30 },
    },
  },

  // 最简二次根式（第16章）
  sqrt_simplify: {
    1: {
      radicand: { type: 'int', min: 4, max: 36 },    // 小的合数，有完全平方因子
      perfectSquare: { type: 'int', min: 1, max: 9 },
      remaining: { type: 'int', min: 2, max: 10 },
    },
    2: {
      radicand: { type: 'int', min: 4, max: 72 },
      perfectSquare: { type: 'int', min: 1, max: 16 },
      remaining: { type: 'int', min: 2, max: 15 },
    },
    3: {
      radicand: { type: 'int', min: 8, max: 144 },
      perfectSquare: { type: 'int', min: 1, max: 25 },
      remaining: { type: 'int', min: 2, max: 20 },
    },
    4: {
      radicand: { type: 'int', min: 12, max: 200 },
      perfectSquare: { type: 'int', min: 1, max: 36 },
      remaining: { type: 'int', min: 2, max: 25 },
    },
    5: {
      radicand: { type: 'int', min: 16, max: 300 },
      perfectSquare: { type: 'int', min: 1, max: 49 },
      remaining: { type: 'int', min: 2, max: 30 },
    },
  },

  // 二次根式性质 √(a²)=|a|（第16章）
  sqrt_property: {
    1: {
      a: { type: 'int', min: 0, max: 10 },           // 非负整数，简单
      varValue: { type: 'int', min: 0, max: 10 },
      exprA: { type: 'int', min: 0, max: 5 },
      exprB: { type: 'int', min: 0, max: 5 },
      base: { type: 'int', min: 1, max: 10 },
    },
    2: {
      a: { type: 'int', min: -10, max: 10 },         // 引入负数
      varValue: { type: 'int', min: -10, max: 10 },
      exprA: { type: 'int', min: -5, max: 5 },
      exprB: { type: 'int', min: -5, max: 5 },
      base: { type: 'int', min: 1, max: 15 },
    },
    3: {
      a: { type: 'int', min: -15, max: 15 },
      varValue: { type: 'int', min: -15, max: 15 },
      exprA: { type: 'int', min: -8, max: 8 },
      exprB: { type: 'int', min: -8, max: 8 },
      base: { type: 'int', min: 1, max: 20 },
    },
    4: {
      a: { type: 'int', min: -20, max: 20 },
      varValue: { type: 'int', min: -20, max: 20 },
      exprA: { type: 'int', min: -10, max: 10 },
      exprB: { type: 'int', min: -10, max: 10 },
      base: { type: 'int', min: 1, max: 25 },
    },
    5: {
      a: { type: 'int', min: -25, max: 25 },
      varValue: { type: 'int', min: -25, max: 25 },
      exprA: { type: 'int', min: -15, max: 15 },
      exprB: { type: 'int', min: -15, max: 15 },
      base: { type: 'int', min: 1, max: 30 },
    },
  },

  // 二次根式乘法（第16章）
  sqrt_multiply: {
    1: {
      a: { type: 'int', min: 1, max: 9 },           // 小的完全平方数
      b: { type: 'int', min: 1, max: 9 },
    },
    2: {
      a: { type: 'int', min: 1, max: 16 },          // 包含更多完全平方数
      b: { type: 'int', min: 1, max: 16 },
    },
    3: {
      a: { type: 'int', min: 1, max: 25 },
      b: { type: 'int', min: 1, max: 25 },
    },
    4: {
      a: { type: 'int', min: 2, max: 36 },
      b: { type: 'int', min: 2, max: 36 },
    },
    5: {
      a: { type: 'int', min: 2, max: 49 },
      b: { type: 'int', min: 2, max: 49 },
    },
  },

  // 二次根式除法（第16章）
  sqrt_divide: {
    1: {
      a: { type: 'int', min: 1, max: 9 },           // 被除数：小的完全平方数
      b: { type: 'int', min: 1, max: 4 },           // 除数：1, 2, 3, 4
    },
    2: {
      a: { type: 'int', min: 1, max: 16 },
      b: { type: 'int', min: 1, max: 9 },
    },
    3: {
      a: { type: 'int', min: 1, max: 25 },
      b: { type: 'int', min: 2, max: 16 },
    },
    4: {
      a: { type: 'int', min: 2, max: 36 },
      b: { type: 'int', min: 2, max: 25 },
    },
    5: {
      a: { type: 'int', min: 2, max: 49 },
      b: { type: 'int', min: 2, max: 36 },
    },
  },

  // 二次根式加减混合运算（第16章）
  sqrt_add_subtract: {
    1: {
      a: { type: 'int', min: 1, max: 3 },           // 第一个系数：1-3
      b: { type: 'int', min: 2, max: 3 },           // 根号内：2-3（最简单的）
      c: { type: 'int', min: 1, max: 3 },           // 第二个系数：1-3
    },
    2: {
      a: { type: 'int', min: 1, max: 5 },
      b: { type: 'int', min: 2, max: 7 },           // 扩大根号内范围
      c: { type: 'int', min: 1, max: 5 },
    },
    3: {
      a: { type: 'int', min: -3, max: 3 },          // 引入负数
      b: { type: 'int', min: 2, max: 10 },
      c: { type: 'int', min: -3, max: 3 },
    },
    4: {
      a: { type: 'int', min: -5, max: 5 },          // 更大范围的系数
      b: { type: 'int', min: 2, max: 15 },
      c: { type: 'int', min: -5, max: 5 },
    },
    5: {
      a: { type: 'int', min: -10, max: 10 },        // 最大范围的系数
      b: { type: 'int', min: 2, max: 30 },
      c: { type: 'int', min: -10, max: 10 },
    },
  },

  // 菱形性质计算（第18章）
  rhombus_property: {
    1: {
      side: { type: 'int', min: 3, max: 5 },           // 边长：3-5
      diagonal1: { type: 'int', min: 4, max: 6 },      // 对角线1：4-6（偶数）
      diagonal2: { type: 'int', min: 4, max: 6 },      // 对角线2：4-6（偶数）
    },
    2: {
      side: { type: 'int', min: 4, max: 8 },
      diagonal1: { type: 'int', min: 6, max: 10 },
      diagonal2: { type: 'int', min: 6, max: 10 },
    },
    3: {
      side: { type: 'int', min: 5, max: 10 },
      diagonal1: { type: 'int', min: 8, max: 14 },
      diagonal2: { type: 'int', min: 8, max: 14 },
    },
    4: {
      side: { type: 'int', min: 6, max: 15 },
      diagonal1: { type: 'int', min: 10, max: 20 },
      diagonal2: { type: 'int', min: 10, max: 20 },
    },
    5: {
      side: { type: 'int', min: 8, max: 20 },
      diagonal1: { type: 'int', min: 12, max: 30 },
      diagonal2: { type: 'int', min: 12, max: 30 },
    },
  },

  // 菱形判定（第18章）
  rhombus_verify: {
    1: {
      sideAB: { type: 'int', min: 3, max: 5 },        // 边长相等
      sideBC: { type: 'int', min: 3, max: 5 },
      sideCD: { type: 'int', min: 3, max: 5 },
      sideDA: { type: 'int', min: 3, max: 5 },
      isEqual: { type: 'int', min: 1, max: 1 },       // 四条边相等
      parallelogram: { type: 'int', min: 1, max: 1 }, // 是平行四边形
    },
    2: {
      sideAB: { type: 'int', min: 4, max: 7 },
      sideBC: { type: 'int', min: 4, max: 7 },
      sideCD: { type: 'int', min: 4, max: 7 },
      sideDA: { type: 'int', min: 4, max: 7 },
      isEqual: { type: 'int', min: 1, max: 1 },
      parallelogram: { type: 'int', min: 1, max: 1 },
    },
    3: {
      sideAB: { type: 'int', min: 5, max: 10 },
      sideBC: { type: 'int', min: 5, max: 10 },
      sideCD: { type: 'int', min: 5, max: 10 },
      sideDA: { type: 'int', min: 5, max: 10 },
      isEqual: { type: 'int', min: 1, max: 2 },       // 可能不相等
      parallelogram: { type: 'int', min: 1, max: 1 },
    },
    4: {
      sideAB: { type: 'int', min: 6, max: 15 },
      sideBC: { type: 'int', min: 6, max: 15 },
      sideCD: { type: 'int', min: 6, max: 15 },
      sideDA: { type: 'int', min: 6, max: 15 },
      isEqual: { type: 'int', min: 1, max: 2 },
      parallelogram: { type: 'int', min: 1, max: 2 }, // 可能不是平行四边形
    },
    5: {
      sideAB: { type: 'int', min: 8, max: 20 },
      sideBC: { type: 'int', min: 8, max: 20 },
      sideCD: { type: 'int', min: 8, max: 20 },
      sideDA: { type: 'int', min: 8, max: 20 },
      isEqual: { type: 'int', min: 0, max: 2 },       // 更多变化
      parallelogram: { type: 'int', min: 0, max: 2 },
    },
  },

  // 平行四边形判定（第18章）
  parallelogram_verify: {
    1: {
      side1: { type: 'int', min: 3, max: 6 },
      side2: { type: 'int', min: 4, max: 8 },
      sideAB: { type: 'int', min: 3, max: 6 },
      sideBC: { type: 'int', min: 4, max: 8 },
      sideCD: { type: 'int', min: 3, max: 6 },
      sideDA: { type: 'int', min: 4, max: 8 },
    },
    2: {
      side1: { type: 'int', min: 4, max: 10 },
      side2: { type: 'int', min: 5, max: 12 },
      sideAB: { type: 'int', min: 4, max: 10 },
      sideBC: { type: 'int', min: 5, max: 12 },
      sideCD: { type: 'int', min: 4, max: 10 },
      sideDA: { type: 'int', min: 5, max: 12 },
    },
    3: {
      side1: { type: 'int', min: 5, max: 15 },
      side2: { type: 'int', min: 6, max: 18 },
      sideAB: { type: 'int', min: 5, max: 15 },
      sideBC: { type: 'int', min: 6, max: 18 },
      sideCD: { type: 'int', min: 5, max: 15 },
      sideDA: { type: 'int', min: 6, max: 18 },
    },
    4: {
      side1: { type: 'int', min: 6, max: 20 },
      side2: { type: 'int', min: 8, max: 25 },
      side3: { type: 'int', min: 4, max: 22 },
      side4: { type: 'int', min: 6, max: 28 },
      sideAB: { type: 'int', min: 6, max: 20 },
      sideBC: { type: 'int', min: 8, max: 25 },
      sideCD: { type: 'int', min: 6, max: 20 },
      sideDA: { type: 'int', min: 8, max: 25 },
    },
    5: {
      side1: { type: 'int', min: 8, max: 30 },
      side2: { type: 'int', min: 10, max: 35 },
      side3: { type: 'int', min: 5, max: 32 },
      side4: { type: 'int', min: 8, max: 38 },
      sideAB: { type: 'int', min: 8, max: 30 },
      sideBC: { type: 'int', min: 10, max: 35 },
      sideCD: { type: 'int', min: 8, max: 30 },
      sideDA: { type: 'int', min: 10, max: 35 },
    },
  },

  // 矩形性质计算（第18章）
  rectangle_property: {
    1: {
      width: { type: 'int', min: 3, max: 5 },
      height: { type: 'int', min: 4, max: 6 },
    },
    2: {
      width: { type: 'int', min: 4, max: 8 },
      height: { type: 'int', min: 5, max: 10 },
    },
    3: {
      width: { type: 'int', min: 5, max: 12 },
      height: { type: 'int', min: 6, max: 15 },
    },
    4: {
      width: { type: 'int', min: 6, max: 16 },
      height: { type: 'int', min: 8, max: 20 },
    },
    5: {
      width: { type: 'int', min: 8, max: 24 },
      height: { type: 'int', min: 10, max: 30 },
    },
  },

  // 矩形判定（第18章）
  rectangle_verify: {
    1: {
      width: { type: 'int', min: 3, max: 5 },
      height: { type: 'int', min: 4, max: 6 },
    },
    2: {
      width: { type: 'int', min: 4, max: 8 },
      height: { type: 'int', min: 5, max: 10 },
    },
    3: {
      width: { type: 'int', min: 5, max: 12 },
      height: { type: 'int', min: 6, max: 15 },
    },
    4: {
      width: { type: 'int', min: 6, max: 16 },
      height: { type: 'int', min: 8, max: 20 },
    },
    5: {
      width: { type: 'int', min: 8, max: 24 },
      height: { type: 'int', min: 10, max: 30 },
    },
  },

  // 正方形性质计算（第18章）
  square_property: {
    1: {
      side: { type: 'int', min: 2, max: 5 },        // 边长：2-5，简单
    },
    2: {
      side: { type: 'int', min: 3, max: 8 },         // 边长：3-8
    },
    3: {
      side: { type: 'int', min: 4, max: 12 },        // 边长：4-12
    },
    4: {
      side: { type: 'int', min: 5, max: 15 },        // 边长：5-15
    },
    5: {
      side: { type: 'int', min: 6, max: 20 },        // 边长：6-20
    },
  },

  // 正方形判定（第18章）
  square_verify: {
    1: {
      side: { type: 'int', min: 2, max: 5 },        // 边长：2-5
    },
    2: {
      side: { type: 'int', min: 3, max: 8 },         // 边长：3-8
    },
    3: {
      side: { type: 'int', min: 4, max: 12 },        // 边长：4-12
    },
    4: {
      side: { type: 'int', min: 5, max: 15 },        // 边长：5-15
    },
    5: {
      side: { type: 'int', min: 6, max: 20 },        // 边长：6-20
    },
  },

  // 四边形周长计算（第18章）
  quadrilateral_perimeter: {
    1: {
      length: { type: 'int', min: 3, max: 6 },
      width: { type: 'int', min: 2, max: 5 },
      side: { type: 'int', min: 2, max: 5 },
      side1: { type: 'int', min: 3, max: 6 },
      side2: { type: 'int', min: 2, max: 5 },
    },
    2: {
      length: { type: 'int', min: 4, max: 10 },
      width: { type: 'int', min: 3, max: 8 },
      side: { type: 'int', min: 3, max: 8 },
      side1: { type: 'int', min: 4, max: 10 },
      side2: { type: 'int', min: 3, max: 8 },
    },
    3: {
      length: { type: 'int', min: 5, max: 15 },
      width: { type: 'int', min: 4, max: 12 },
      side: { type: 'int', min: 4, max: 12 },
      side1: { type: 'int', min: 5, max: 15 },
      side2: { type: 'int', min: 4, max: 12 },
    },
    4: {
      length: { type: 'int', min: 6, max: 20 },
      width: { type: 'int', min: 5, max: 16 },
      side: { type: 'int', min: 5, max: 15 },
      side1: { type: 'int', min: 6, max: 20 },
      side2: { type: 'int', min: 5, max: 16 },
    },
    5: {
      length: { type: 'int', min: 8, max: 30 },
      width: { type: 'int', min: 6, max: 24 },
      side: { type: 'int', min: 6, max: 20 },
      side1: { type: 'int', min: 8, max: 30 },
      side2: { type: 'int', min: 6, max: 24 },
    },
  },

  // 四边形面积计算（第18章）
  quadrilateral_area: {
    1: {
      length: { type: 'int', min: 3, max: 6 },
      width: { type: 'int', min: 2, max: 5 },
      side: { type: 'int', min: 2, max: 5 },
      base: { type: 'int', min: 4, max: 8 },
      height: { type: 'int', min: 3, max: 6 },
      diagonal1: { type: 'int', min: 4, max: 8 },
      diagonal2: { type: 'int', min: 4, max: 6 },
    },
    2: {
      length: { type: 'int', min: 4, max: 10 },
      width: { type: 'int', min: 3, max: 8 },
      side: { type: 'int', min: 3, max: 8 },
      base: { type: 'int', min: 5, max: 12 },
      height: { type: 'int', min: 4, max: 8 },
      diagonal1: { type: 'int', min: 5, max: 12 },
      diagonal2: { type: 'int', min: 4, max: 10 },
    },
    3: {
      length: { type: 'int', min: 5, max: 15 },
      width: { type: 'int', min: 4, max: 12 },
      side: { type: 'int', min: 4, max: 12 },
      base: { type: 'int', min: 6, max: 16 },
      height: { type: 'int', min: 5, max: 12 },
      diagonal1: { type: 'int', min: 6, max: 16 },
      diagonal2: { type: 'int', min: 5, max: 14 },
    },
    4: {
      length: { type: 'int', min: 6, max: 20 },
      width: { type: 'int', min: 5, max: 16 },
      side: { type: 'int', min: 5, max: 15 },
      base: { type: 'int', min: 8, max: 20 },
      height: { type: 'int', min: 6, max: 16 },
      diagonal1: { type: 'int', min: 8, max: 20 },
      diagonal2: { type: 'int', min: 6, max: 18 },
    },
    5: {
      length: { type: 'int', min: 8, max: 30 },
      width: { type: 'int', min: 6, max: 24 },
      side: { type: 'int', min: 6, max: 20 },
      base: { type: 'int', min: 10, max: 30 },
      height: { type: 'int', min: 8, max: 24 },
      diagonal1: { type: 'int', min: 10, max: 30 },
      diagonal2: { type: 'int', min: 8, max: 26 },
    },
  },

  // 梯形性质计算（第18章）
  trapezoid_property: {
    1: {
      upperBase: { type: 'int', min: 3, max: 6 },
      lowerBase: { type: 'int', min: 6, max: 12 },
      midsegment: { type: 'int', min: 5, max: 9 },
    },
    2: {
      upperBase: { type: 'int', min: 4, max: 10 },
      lowerBase: { type: 'int', min: 8, max: 18 },
      midsegment: { type: 'int', min: 6, max: 14 },
    },
    3: {
      upperBase: { type: 'int', min: 5, max: 14 },
      lowerBase: { type: 'int', min: 10, max: 24 },
      midsegment: { type: 'int', min: 8, max: 19 },
      leg: { type: 'int', min: 4, max: 10 },
      height: { type: 'int', min: 3, max: 8 },
    },
    4: {
      upperBase: { type: 'int', min: 6, max: 18 },
      lowerBase: { type: 'int', min: 12, max: 30 },
      midsegment: { type: 'int', min: 9, max: 24 },
      leg: { type: 'int', min: 5, max: 14 },
      height: { type: 'int', min: 4, max: 12 },
    },
    5: {
      upperBase: { type: 'int', min: 8, max: 24 },
      lowerBase: { type: 'int', min: 14, max: 40 },
      midsegment: { type: 'int', min: 11, max: 32 },
      leg: { type: 'int', min: 6, max: 18 },
      height: { type: 'int', min: 5, max: 16 },
    },
  },

  // 勾股定理折叠问题（第17章）
  pythagoras_folding: {
    1: {
      a: { type: 'int', min: 3, max: 5 },
      b: { type: 'int', min: 4, max: 6 },
    },
    2: {
      a: { type: 'int', min: 4, max: 8 },
      b: { type: 'int', min: 5, max: 10 },
    },
    3: {
      a: { type: 'int', min: 5, max: 12 },
      b: { type: 'int', min: 6, max: 15 },
    },
    4: {
      a: { type: 'int', min: 6, max: 15 },
      b: { type: 'int', min: 8, max: 20 },
    },
    5: {
      a: { type: 'int', min: 8, max: 20 },
      b: { type: 'int', min: 10, max: 25 },
    },
  },

  // 勾股定理逆定理（第17章）
  triangle_verify: {
    1: {
      side1: { type: 'int', min: 3, max: 5 },
      side2: { type: 'int', min: 4, max: 6 },
      side3: { type: 'int', min: 5, max: 8 },
    },
    2: {
      side1: { type: 'int', min: 4, max: 8 },
      side2: { type: 'int', min: 5, max: 10 },
      side3: { type: 'int', min: 6, max: 12 },
    },
    3: {
      side1: { type: 'int', min: 5, max: 12 },
      side2: { type: 'int', min: 6, max: 15 },
      side3: { type: 'int', min: 7, max: 18 },
    },
    4: {
      side1: { type: 'int', min: 6, max: 15 },
      side2: { type: 'int', min: 8, max: 20 },
      side3: { type: 'int', min: 10, max: 25 },
    },
    5: {
      side1: { type: 'int', min: 8, max: 20 },
      side2: { type: 'int', min: 10, max: 25 },
      side3: { type: 'int', min: 12, max: 30 },
    },
  },

  // 勾股定理应用题（第17章）
  pythagoras_word_problem: {
    1: {
      a: { type: 'int', min: 3, max: 5 },
      b: { type: 'int', min: 4, max: 6 },
    },
    2: {
      a: { type: 'int', min: 4, max: 8 },
      b: { type: 'int', min: 5, max: 10 },
    },
    3: {
      a: { type: 'int', min: 5, max: 12 },
      b: { type: 'int', min: 6, max: 15 },
    },
    4: {
      a: { type: 'int', min: 6, max: 15 },
      b: { type: 'int', min: 8, max: 20 },
    },
    5: {
      a: { type: 'int', min: 8, max: 20 },
      b: { type: 'int', min: 10, max: 25 },
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
