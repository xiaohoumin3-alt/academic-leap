/**
 * 勾股定理应用题模板
 * 实际应用：梯子问题、最短路径问题等
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
type WordProblemType = 'ladder' | 'shortest_path' | 'pole_wire' | 'diagonal' | 'staircase';

/**
 * 应用题配置
 */
const WORD_PROBLEM_TYPES: { type: WordProblemType; weight: number; description: string }[] = [
  { type: 'ladder', weight: 0.3, description: '梯子靠墙问题' },
  { type: 'shortest_path', weight: 0.25, description: '最短路径问题' },
  { type: 'pole_wire', weight: 0.2, description: '电线杆拉线问题' },
  { type: 'diagonal', weight: 0.15, description: '对角线问题' },
  { type: 'staircase', weight: 0.1, description: '楼梯问题' },
];

/**
 * 生成勾股定理应用题数据
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
    case 'ladder':
      // 梯子靠墙问题
      // 已知梯子长度和墙高，求梯子底部到墙的距离
      if (type === 0) {
        // 求底部距离
        const c = Math.sqrt(a * a + b * b);
        return {
          problemType: 'ladder',
          knownValues: { a, b },
          unknown: '底部到墙的距离',
          description: '梯子靠墙',
          context: `一架梯子长 ${a} 米，底部靠在墙上，梯子顶部离地面 ${b} 米。求梯子底部到墙根的距离（保留两位小数）`,
          answer: Math.round(Math.sqrt(c * c - b * b) * 100) / 100,
        };
      } else {
        // 求梯子长度
        return {
          problemType: 'ladder',
          knownValues: { a, b },
          unknown: '梯子长度',
          description: '梯子靠墙',
          context: `一架梯子靠在墙上，梯子底部离墙根 ${a} 米，梯子顶部离地面 ${b} 米。求梯子的长度（保留两位小数）`,
          answer: Math.round(Math.sqrt(a * a + b * b) * 100) / 100,
        };
      }

    case 'shortest_path':
      // 最短路径问题
      // 长方形表面上两点间的最短路径
      if (type === 0) {
        // 沿表面展开求对角线
        return {
          problemType: 'shortest_path',
          knownValues: { a, b },
          unknown: '最短路径',
          description: '长方体表面最短路径',
          context: `一个长方体的长、宽、高分别为 ${a}、${b}、3（单位：米）。在长方体表面从点A（顶点）到点B（对面中点）的最短距离是多少？`,
          answer: Math.round(Math.sqrt(a * a + (b + 3) * (b + 3)) * 100) / 100,
        };
      } else {
        // 长方体对角线
        return {
          problemType: 'shortest_path',
          knownValues: { a, b },
          unknown: '体对角线长度',
          description: '长方体对角线',
          context: `一个长方体的长、宽、高分别为 ${a}、${b}、12（单位：厘米）。求长方体的体对角线长度（保留两位小数）`,
          answer: Math.round(Math.sqrt(a * a + b * b + 144) * 100) / 100,
        };
      }

    case 'pole_wire':
      // 电线杆拉线问题
      // 已知电线杆高度和拉线长度，求固定点到杆底的距离
      return {
        problemType: 'pole_wire',
        knownValues: { a, b },
        unknown: '固定点到杆底的距离',
        description: '电线杆拉线',
        context: `一根电线杆高 ${a} 米，用钢丝绳把它固定在地面上，钢丝绳长 ${b} 米。求固定点到电线杆底部的距离（保留两位小数）`,
        answer: Math.round(Math.sqrt(b * b - a * a) * 100) / 100,
      };

    case 'diagonal':
      // 对角线问题
      // 长方形或正方形的对角线
      return {
        problemType: 'diagonal',
        knownValues: { a, b },
        unknown: '对角线长度',
        description: '长方形对角线',
        context: `一个长方形的长为 ${a} 米，宽为 ${b} 米。求这个长方形的对角线长度（保留两位小数）`,
        answer: Math.round(Math.sqrt(a * a + b * b) * 100) / 100,
      };

    case 'staircase':
      // 楼梯问题
      // 已知楼梯的水平距离和垂直高度，求楼梯长度
      return {
        problemType: 'staircase',
        knownValues: { a, b },
        unknown: '楼梯长度',
        description: '楼梯长度',
        context: `一段楼梯的水平长度为 ${a} 米，垂直高度为 ${b} 米。求楼梯的长度（保留两位小数）`,
        answer: Math.round(Math.sqrt(a * a + b * b) * 100) / 100,
      };
  }
}

/**
 * 勾股定理应用题模板
 */
export const PythagorasWordProblemTemplate: QuestionTemplate = {
  id: 'pythagoras_word_problem',
  knowledgePoint: 'pythagoras_word_problem',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.pythagoras_word_problem[level] ||
                   DIFFICULTY_CONFIG.pythagoras_word_problem[1];

    const params = generateRandomParams(config);

    // 根据难度选择问题类型
    let problemType: WordProblemType;
    if (level <= 2) {
      // 基础：只用梯子和对角线问题
      problemType = Math.random() < 0.6 ? 'ladder' : 'diagonal';
      params.problemTypeIndex = problemType === 'ladder' ? 0 : 3;
    } else if (level <= 3) {
      // 中等：增加拉线和楼梯
      const rand = Math.random();
      if (rand < 0.4) {
        problemType = 'ladder';
        params.problemTypeIndex = 0;
      } else if (rand < 0.6) {
        problemType = 'diagonal';
        params.problemTypeIndex = 3;
      } else if (rand < 0.8) {
        problemType = 'pole_wire';
        params.problemTypeIndex = 2;
      } else {
        problemType = 'staircase';
        params.problemTypeIndex = 4;
      }
    } else {
      // 高级：包含所有类型
      const rand = Math.random();
      if (rand < 0.3) {
        problemType = 'ladder';
        params.problemTypeIndex = 0;
      } else if (rand < 0.5) {
        problemType = 'shortest_path';
        params.problemTypeIndex = 1;
      } else if (rand < 0.7) {
        problemType = 'diagonal';
        params.problemTypeIndex = 3;
      } else if (rand < 0.85) {
        problemType = 'pole_wire';
        params.problemTypeIndex = 2;
      } else {
        problemType = 'staircase';
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
    const c = Math.sqrt(a * a + b * b);

    const problemType: WordProblemType =
      params.problemTypeIndex === 4 ? 'staircase' :
      params.problemTypeIndex === 3 ? 'diagonal' :
      params.problemTypeIndex === 2 ? 'pole_wire' :
      params.problemTypeIndex === 1 ? 'shortest_path' : 'ladder';

    let context: string;
    let title: string;

    switch (problemType) {
      case 'ladder':
        title = '梯子靠墙问题';
        if (params.type === 0) {
          context = `一架梯子长 ${a} 米，底部靠在墙上，梯子顶部离地面 ${b} 米。求梯子底部到墙根的距离（结果保留两位小数）`;
        } else {
          context = `一架梯子靠在墙上，梯子底部离墙根 ${a} 米，梯子顶部离地面 ${b} 米。求梯子的长度（结果保留两位小数）`;
        }
        break;
      case 'shortest_path':
        title = '最短路径问题';
        context = `一个长方体的长、宽、高分别为 ${a}、${b}、12（单位：米）。在长方体表面从一点到另一点的最短距离是多少？（结果保留两位小数）`;
        break;
      case 'pole_wire':
        title = '电线杆拉线问题';
        context = `一根电线杆高 ${a} 米，用钢丝绳把它固定在地面上，钢丝绳长 ${b} 米。求固定点到电线杆底部的距离（结果保留两位小数）`;
        break;
      case 'diagonal':
        title = '长方形对角线问题';
        context = `一个长方形的长为 ${a} 米，宽为 ${b} 米。求这个长方形的对角线长度（结果保留两位小数）`;
        break;
      case 'staircase':
        title = '楼梯长度问题';
        context = `一段楼梯的水平长度为 ${a} 米，垂直高度为 ${b} 米。求楼梯的长度（结果保留两位小数）`;
        break;
    }

    return {
      title,
      description: '勾股定理实际应用',
      context,
    };
  },
};
