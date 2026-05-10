/**
 * 一元二次方程应用题模板
 * 实际应用：抛物运动、面积优化、利润最大等
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
 * 应用题类型
 */
type WordProblemType = 'projectile_motion' | 'area_optimization' | 'max_profit' | 'bridge_design' | 'water_flow';

/**
 * 应用题配置
 */
const WORD_PROBLEM_TYPES: { type: WordProblemType; weight: number; description: string }[] = [
  { type: 'projectile_motion', weight: 0.3, description: '抛物运动问题' },
  { type: 'area_optimization', weight: 0.25, description: '面积优化问题' },
  { type: 'max_profit', weight: 0.2, description: '最大利润问题' },
  { type: 'bridge_design', weight: 0.15, description: '桥梁设计问题' },
  { type: 'water_flow', weight: 0.1, description: '水流问题' },
];

/**
 * 生成一元二次方程应用题数据
 */
function generateWordProblemData(
  problemType: WordProblemType,
  params: Record<string, number>
): {
  problemType: WordProblemType;
  knownValues: { a: number; b: number; c?: number };
  unknown: string;
  description: string;
  context: string;
  answer: number;
} {
  const { a, b, type } = params;

  switch (problemType) {
    case 'projectile_motion':
      // 抛物运动问题
      // 使用二次函数 h(t) = -5t² + v₀t + h₀
      if (type === 0) {
        // 求最大高度（顶点纵坐标）
        const v0 = a; // 初速度
        const h0 = b; // 初始高度
        const tMax = v0 / 10; // 达到最大高度的时间
        const hMax = -5 * tMax * tMax + v0 * tMax + h0;
        return {
          problemType: 'projectile_motion',
          knownValues: { a: v0, b: h0 },
          unknown: '最大高度',
          description: '抛物运动',
          context: `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球能达到的最大高度（保留两位小数）`,
          answer: Math.round(hMax * 100) / 100,
        };
      } else {
        // 求落地时间
        const v0 = a;
        const h0 = b;
        // 解方程 -5t² + v0t + h0 = 0
        const delta = v0 * v0 + 20 * h0;
        const t = (v0 + Math.sqrt(delta)) / 10;
        return {
          problemType: 'projectile_motion',
          knownValues: { a: v0, b: h0 },
          unknown: '落地时间',
          description: '抛物运动',
          context: `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球落地所需的时间（保留两位小数）`,
          answer: Math.round(t * 100) / 100,
        };
      }

    case 'area_optimization':
      // 面积优化问题
      // 矩形周长固定，求最大面积
      if (type === 0) {
        // 已知周长，求最大面积
        const perimeter = a;
        const width = perimeter / 4; // 正方形时面积最大
        const maxArea = width * width;
        return {
          problemType: 'area_optimization',
          knownValues: { a: perimeter, b: 0 },
          unknown: '最大面积',
          description: '面积优化',
          context: `用 ${perimeter} 米长的篱笆围成一个矩形菜园（一边靠墙不需要篱笆）。求菜园的最大面积（保留两位小数）`,
          answer: Math.round(maxArea * 100) / 100,
        };
      } else {
        // 已知面积，求最小周长
        const area = a * b;
        const minPerimeter = 2 * (Math.sqrt(area) + Math.sqrt(area) / 2);
        return {
          problemType: 'area_optimization',
          knownValues: { a, b },
          unknown: '最小周长',
          description: '面积优化',
          context: `一个矩形菜园的面积为 ${area} 平方米（一边靠墙）。求所需篱笆的最小长度（保留两位小数）`,
          answer: Math.round(minPerimeter * 100) / 100,
        };
      }

    case 'max_profit':
      // 最大利润问题
      // 利润函数是价格的下凹二次函数
      const basePrice = a;
      const baseSales = b;
      const optimalPrice = basePrice + baseSales / 2;
      const maxProfit = -(optimalPrice - basePrice) * (optimalPrice - basePrice) + baseSales * baseSales;
      return {
        problemType: 'max_profit',
        knownValues: { a: basePrice, b: baseSales },
        unknown: '最大利润',
        description: '最大利润',
        context: `某商品售价为 ${basePrice} 元时，每天可售 ${baseSales} 件。每降价 1 元，每天多售 2 件。求定价为多少时利润最大（保留两位小数）`,
        answer: Math.round(optimalPrice * 100) / 100,
      };

    case 'bridge_design':
      // 桥梁设计问题
      // 抛物线拱形方程 y = ax²
      const span = a;
      const height = b;
      const a_coeff = -4 * height / (span * span);
      return {
        problemType: 'bridge_design',
        knownValues: { a: span, b: height },
        unknown: '抛物线系数',
        description: '桥梁设计',
        context: `一座拱桥的跨度为 ${span} 米，拱高为 ${height} 米。假设拱形为抛物线，建立合适的坐标系后，求抛物线的方程系数 a（保留两位小数）`,
        answer: Math.round(a_coeff * 100) / 100,
      };

    case 'water_flow':
      // 水流问题
      // 注水排水问题
      const inRate = a; // 注水速率
      const outRate = b; // 排水速率
      const netRate = inRate - outRate;
      return {
        problemType: 'water_flow',
        knownValues: { a: inRate, b: outRate },
        unknown: '净流速',
        description: '水流问题',
        context: `水箱以每分钟 ${inRate} 升的速度注水，同时以每分钟 ${outRate} 升的速度排水。求水箱中水量的净变化速度（保留两位小数，正数表示增加）`,
        answer: Math.round(netRate * 100) / 100,
      };
  }
}

/**
 * 勾股定理应用题模板
 */
export const QuadraticWordProblemTemplate: QuestionTemplate = {
  id: 'quadratic_word_problem',
  knowledgePoint: 'quadratic_word_problem',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_word_problem[level] ||
                   DIFFICULTY_CONFIG.quadratic_word_problem[1];

    const params = generateRandomParams(config);

    // 根据难度选择问题类型
    let problemType: WordProblemType;
    if (level <= 2) {
      // 基础：只用梯子和桥梁设计问题
      problemType = Math.random() < 0.6 ? 'projectile_motion' : 'bridge_design';
      params.problemTypeIndex = problemType === 'projectile_motion' ? 0 : 3;
    } else if (level <= 3) {
      // 中等：增加拉线和楼梯
      const rand = Math.random();
      if (rand < 0.4) {
        problemType = 'projectile_motion';
        params.problemTypeIndex = 0;
      } else if (rand < 0.6) {
        problemType = 'bridge_design';
        params.problemTypeIndex = 3;
      } else if (rand < 0.8) {
        problemType = 'max_profit';
        params.problemTypeIndex = 2;
      } else {
        problemType = 'water_flow';
        params.problemTypeIndex = 4;
      }
    } else {
      // 高级：包含所有类型
      const rand = Math.random();
      if (rand < 0.3) {
        problemType = 'projectile_motion';
        params.problemTypeIndex = 0;
      } else if (rand < 0.5) {
        problemType = 'area_optimization';
        params.problemTypeIndex = 1;
      } else if (rand < 0.7) {
        problemType = 'bridge_design';
        params.problemTypeIndex = 3;
      } else if (rand < 0.85) {
        problemType = 'max_profit';
        params.problemTypeIndex = 2;
      } else {
        problemType = 'water_flow';
        params.problemTypeIndex = 4;
      }
    }

    // 生成参数（根据难度调整）
    const pythagoreanPairs = [
      [3, 4], [5, 12], [8, 15], [7, 24], [6, 8],
      [9, 12], [5, 5], [9, 40], [12, 5],
    ];

    if (level <= 2) {
      // 基础难度使用简单勾股数
      const pair = pythagoreanPairs[Math.floor(Math.random() * 5)];
      params.a = pair[0];
      params.b = pair[1];
    } else {
      // 更高难度使用更复杂的勾股数
      const pair = pythagoreanPairs[Math.floor(Math.random() * pythagoreanPairs.length)];
      const multiplier = level === 5 ? 2 : (level === 4 ? 1.5 : 1);
      params.a = Math.round(pair[0] * multiplier);
      params.b = Math.round(pair[1] * multiplier);
    }

    // 确定要求解的类型（已知哪两个量）
    params.type = Math.floor(Math.random() * 2);

    params.level = level;

    return params;
  },

  buildSteps: (params: Record<string, number>) => {
    return [
      {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '应用勾股定理，计算 c²',
          inputTarget: '代入公式 c² = a² + b²',
          inputHint: '计算两边的平方和',
        },
      },
      {
        stepId: 's2',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '计算结果（保留两位小数）',
          inputTarget: '求解未知量',
          inputHint: '开平方并保留两位小数',
        },
      },
    ];
  },

  render: (params: Record<string, number>) => {
    const { a, b } = params;

    const problemType: WordProblemType =
      params.problemTypeIndex === 4 ? 'water_flow' :
      params.problemTypeIndex === 3 ? 'bridge_design' :
      params.problemTypeIndex === 2 ? 'max_profit' :
      params.problemTypeIndex === 1 ? 'area_optimization' : 'projectile_motion';

    let context: string;
    let title: string;

    switch (problemType) {
      case 'projectile_motion':
        title = '抛物运动问题';
        if (params.type === 0) {
          const v0 = a;
          const h0 = b;
          const tMax = v0 / 10;
          const hMax = -5 * tMax * tMax + v0 * tMax + h0;
          context = `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球能达到的最大高度（结果保留两位小数）`;
        } else {
          const v0 = a;
          const h0 = b;
          context = `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球落地所需的时间（结果保留两位小数）`;
        }
        break;
      case 'area_optimization':
        title = '面积优化问题';
        if (params.type === 0) {
          const perimeter = a;
          context = `用 ${perimeter} 米长的篱笆围成一个矩形菜园（一边靠墙不需要篱笆）。求菜园的最大面积（结果保留两位小数）`;
        } else {
          const area = a * b;
          context = `一个矩形菜园的面积为 ${area} 平方米（一边靠墙）。求所需篱笆的最小长度（结果保留两位小数）`;
        }
        break;
      case 'max_profit':
        title = '最大利润问题';
        const basePrice = a;
        const baseSales = b;
        context = `某商品售价为 ${basePrice} 元时，每天可售 ${baseSales} 件。每降价 1 元，每天多售 2 件。求定价为多少时利润最大（结果保留两位小数）`;
        break;
      case 'bridge_design':
        title = '抛物线桥梁设计问题';
        const span = a;
        const height = b;
        context = `一座拱桥的跨度为 ${span} 米，拱高为 ${height} 米。假设拱形为抛物线，建立合适的坐标系后，求抛物线的方程系数 a（结果保留两位小数）`;
        break;
      case 'water_flow':
        title = '水箱注水排水问题';
        const inRate = a;
        const outRate = b;
        context = `水箱以每分钟 ${inRate} 升的速度注水，同时以每分钟 ${outRate} 升的速度排水。求水箱中水量的净变化速度（结果保留两位小数，正数表示增加）`;
        break;
    }

    return {
      title,
      description: '一元二次方程实际应用',
      context,
    };
  },
};
