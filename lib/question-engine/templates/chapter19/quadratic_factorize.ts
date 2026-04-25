/**
 * 一元二次方程因式分解法模板
 * 解可因式分解的方程 ax² + bx + c = 0（十字相乘法）
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatSigned,
} from '../../difficulty';

/**
 * 生成可因式分解的一元二次方程参数
 * 使用十字相乘法原理：找到 p, q 使得 p*q = c 且 p+q = b
 *
 * 对于方程 ax² + bx + c = 0：
 * - 若 a=1，则找 p, q 使得 p*q = c 且 p+q = b
 * - 若 a≠1，则分解 a 和 c，通过十字相乘找到组合
 */
function generateFactorableParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadratic_factorize[level] ||
                 DIFFICULTY_CONFIG.quadratic_factorize[1];

  // Level 1-3: a = 1，找 p, q 使得 p*q = c 且 p+q = b
  // Level 4-5: a 可能 > 1，需要更复杂的十字相乘

  const a = level <= 3 ? 1 : Math.floor(Math.random() * (config.a.max - config.a.min + 1)) + config.a.min;

  let p: number | undefined;
  let q: number | undefined;
  let b: number | undefined;
  let c: number | undefined;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    if (a === 1) {
      // 简单情况：找两个整数 p, q
      const pMin = config.p?.min ?? -Math.abs(config.c.max);
      const pMax = config.p?.max ?? Math.abs(config.c.max);
      const qMin = config.q?.min ?? -Math.abs(config.c.max);
      const qMax = config.q?.max ?? Math.abs(config.c.max);

      p = Math.floor(Math.random() * (pMax - pMin + 1)) + pMin;
      q = Math.floor(Math.random() * (qMax - qMin + 1)) + qMin;

      // 避免 p=0 或 q=0
      if (p === 0 || q === 0) {
        attempts++;
        continue;
      }

      c = p * q;
      b = p + q;

      // 检查 b 是否在范围内
      if (b < config.b.min || b > config.b.max) {
        attempts++;
        continue;
      }

      // 检查 c 是否在范围内
      if (c < config.c.min || c > config.c.max) {
        attempts++;
        continue;
      }
    } else {
      // 复杂情况：a > 1，需要十字相乘
      // 分解 a = a1 * a2，分解 c = c1 * c2
      // 使得 a1*c2 + a2*c1 = b

      // 找 a 的因数对
      const aFactors: [number, number][] = [];
      for (let i = 1; i <= Math.abs(a); i++) {
        if (a % i === 0) {
          aFactors.push([i, a / i]);
          aFactors.push([-i, -a / i]);
        }
      }

      // 随机选择一个 c 值范围
      const cAbsMax = Math.max(Math.abs(config.c.min), Math.abs(config.c.max));
      const cFactors: [number, number][] = [];

      for (let i = 1; i <= cAbsMax; i++) {
        for (let j = -cAbsMax; j <= cAbsMax; j++) {
          if (i * j !== 0 && Math.abs(i * j) <= cAbsMax) {
            cFactors.push([i, j]);
          }
        }
      }

      // 尝试组合
      let found = false;
      for (const [a1, a2] of aFactors) {
        for (const [c1, c2] of cFactors) {
          b = a1 * c2 + a2 * c1;
          c = c1 * c2;

          // 检查 b 是否在范围内
          if (b >= config.b.min && b <= config.b.max &&
              c >= config.c.min && c <= config.c.max) {
            p = c1;
            q = c2;
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        attempts++;
        continue;
      }
    }

    // 验证确实可以因式分解
    const discriminant = b! * b! - 4 * a * c!;
    if (discriminant < 0) {
      attempts++;
      continue;
    }

    // 验证解为有理数（判别式为完全平方数）
    const sqrtD = Math.sqrt(discriminant);
    if (sqrtD !== Math.floor(sqrtD)) {
      attempts++;
      continue;
    }

    break;
  } while (attempts < maxAttempts);

  // 如果无法生成，使用简单默认值
  if (attempts >= maxAttempts || p === undefined || q === undefined || b === undefined || c === undefined) {
    return {
      a: 1,
      b: -5,
      c: 6,
      p: -2,
      q: -3,
    };
  }

  return { a, b, c, p, q };
}

/**
 * 一元二次方程因式分解法模板
 */
export const QuadraticFactorizeTemplate: QuestionTemplate = {
  id: 'quadratic_factorize',
  knowledgePoint: 'quadratic_factorize',

  generateParams: (level: number) => {
    return generateFactorableParams(level);
  },

  buildSteps: (params) => {
    const { a, b, c, p, q } = params;

    // 计算两个根
    // 对于 ax² + bx + c = (mx + p)(nx + q) = 0
    // 根为 x1 = -p/m, x2 = -q/n
    let x1: number, x2: number;

    if (a === 1) {
      // x² + bx + c = (x + p)(x + q) = 0
      x1 = -p;
      x2 = -q;
    } else {
      // ax² + bx + c = 0
      // 使用求根公式或十字相乘结果
      const discriminant = b * b - 4 * a * c;
      const sqrtD = Math.sqrt(discriminant);
      x1 = (-b + sqrtD) / (2 * a);
      x2 = (-b - sqrtD) / (2 * a);
    }

    // 确保顺序一致（小的在前）
    if (x1 > x2) {
      [x1, x2] = [x2, x1];
    }

    return [
      {
        stepId: 's1',
        type: StepType.SOLVE_FACTORIZE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '用因式分解法（十字相乘法）解方程，求出一个解',
          inputTarget: 'x 的值（较小解）',
          inputHint: '先因式分解，再令每个因式为0',
        },
      },
      {
        stepId: 's2',
        type: StepType.SOLVE_FACTORIZE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '方程的另一个解',
          inputTarget: 'x 的值（较大解）',
          inputHint: '别忘了第二个因式',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = formatSigned(b);
    const cStr = formatSigned(c);

    return {
      title: `解方程 ${a}x² ${bStr}x ${cStr} = 0（因式分解法）`,
      description: '十字相乘法',
      context: '对于可因式分解的一元二次方程，先分解因式，再令各因式为0求解',
    };
  },
};
