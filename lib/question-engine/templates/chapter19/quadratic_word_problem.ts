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
 * 一元二次方程应用题模板
 */
export const QuadraticWordProblemTemplate: QuestionTemplate = {
  id: 'quadratic_word_problem',
  knowledgePoint: 'quadratic_word_problem',
  weight: 3, // 场景化题目权重更高，提高覆盖率

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_word_problem[level] ||
                   DIFFICULTY_CONFIG.quadratic_word_problem[1];

    const params = generateRandomParams(config);

    // 根据难度选择问题类型
    // index 映射：0=projectile, 1=area, 2=profit, 3=bridge, 4=water
    if (level <= 2) {
      // 基础：只用抛物运动和桥梁设计
      params.problemTypeIndex = Math.random() < 0.6 ? 0 : 3;
    } else if (level <= 3) {
      // 中等：增加利润和流水
      const rand = Math.random();
      if (rand < 0.35) params.problemTypeIndex = 0;
      else if (rand < 0.55) params.problemTypeIndex = 3;
      else if (rand < 0.75) params.problemTypeIndex = 2;
      else params.problemTypeIndex = 4;
    } else {
      // 高级：包含所有类型
      const rand = Math.random();
      if (rand < 0.25) params.problemTypeIndex = 0;       // 25%
      else if (rand < 0.45) params.problemTypeIndex = 1;   // 20%
      else if (rand < 0.65) params.problemTypeIndex = 3;   // 20%
      else if (rand < 0.85) params.problemTypeIndex = 2;   // 20%
      else params.problemTypeIndex = 4;                   // 15%
    }

    // 根据难度调整参数范围
    // params.a 和 params.b 已在 generateRandomParams 中根据 config 生成

    // 确定子类型（0=第一类问题，1=第二类问题）
    params.type = Math.floor(Math.random() * 2);

    params.level = level;

    return params;
  },

  buildSteps: (params: Record<string, number>) => {
    const problemType = params.problemTypeIndex;

    // 根据问题类型返回不同的步骤
    if (problemType === 0 || problemType === 1) {
      // projectile_motion 或 area_optimization：求最值
      return [
        {
          stepId: 's1',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '找到顶点对应的值',
            inputTarget: '代入顶点公式 y = -b/2a',
            inputHint: '求导或用配方法求最值',
          },
        },
        {
          stepId: 's2',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '计算结果（保留两位小数）',
            inputTarget: '求解最值',
            inputHint: '代入计算并保留两位小数',
          },
        },
      ];
    } else if (problemType === 2) {
      // max_profit：求最优价格
      return [
        {
          stepId: 's1',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '建立价格-销量关系式',
            inputTarget: '设降价 x 元，列出利润函数',
            inputHint: '利润 = (定价)(销量)，求顶点',
          },
        },
        {
          stepId: 's2',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '求最优定价（保留两位小数）',
            inputTarget: '计算使利润最大的 x',
            inputHint: '代入公式或配方求顶点',
          },
        },
      ];
    } else if (problemType === 3) {
      // bridge_design：求抛物线系数
      return [
        {
          stepId: 's1',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '建立抛物线方程',
            inputTarget: '设 y = ax²，利用 (span/2, height) 求解',
            inputHint: '代入拱顶坐标求系数',
          },
        },
        {
          stepId: 's2',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '计算系数 a（保留两位小数）',
            inputTarget: '解方程求 a',
            inputHint: 'a = -4h/span²',
          },
        },
      ];
    } else {
      // water_flow：求净流速
      return [
        {
          stepId: 's1',
          type: StepType.QUADRATIC_APPLICATION,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0.01,
          ui: {
            instruction: '计算净流速',
            inputTarget: '净流速 = 注入速率 - 排出速率',
            inputHint: '单位一致，直接相减',
          },
        },
      ];
    }
  },

  render: (params: Record<string, number>) => {
    const { a, b } = params;

    const problemType = params.problemTypeIndex;

    let context: string;
    let title: string;

    switch (problemType) {
      case 0: // projectile_motion
        title = '抛物运动问题';
        if (params.type === 0) {
          const v0 = a;
          const h0 = b;
          context = `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球能达到的最大高度（结果保留两位小数）`;
        } else {
          const v0 = a;
          const h0 = b;
          context = `一个球以 ${v0} m/s 的速度被垂直向上抛出，初始高度为 ${h0} 米。重力加速度 g=10m/s²。求球落地所需的时间（结果保留两位小数）`;
        }
        break;
      case 1: // area_optimization
        title = '面积优化问题';
        if (params.type === 0) {
          const perimeter = a;
          context = `用 ${perimeter} 米长的篱笆围成一个矩形菜园（一边靠墙不需要篱笆）。求菜园的最大面积（结果保留两位小数）`;
        } else {
          const area = a * b;
          context = `一个矩形菜园的面积为 ${area} 平方米（一边靠墙）。求所需篱笆的最小长度（结果保留两位小数）`;
        }
        break;
      case 2: // max_profit
        title = '最大利润问题';
        const basePrice = a;
        const baseSales = b;
        context = `某商品售价为 ${basePrice} 元时，每天可售 ${baseSales} 件。每降价 1 元，每天多售 2 件。求定价为多少时利润最大（结果保留两位小数）`;
        break;
      case 3: // bridge_design
        title = '抛物线桥梁设计问题';
        const span = a;
        const height = b;
        context = `一座拱桥的跨度为 ${span} 米，拱高为 ${height} 米。假设拱形为抛物线，建立合适的坐标系后，求抛物线的方程系数 a（结果保留两位小数）`;
        break;
      case 4: // water_flow
        title = '水箱注水排水问题';
        const inRate = a;
        const outRate = b;
        context = `水箱以每分钟 ${inRate} 升的速度注水，同时以每分钟 ${outRate} 升的速度排水。求水箱中水量的净变化速度（结果保留两位小数，正数表示增加）`;
        break;
      default:
        // 兜底（理论上不会到达）
        title = '应用题';
        context = '请根据题意计算';
    }

    return {
      title: title!,
      description: '一元二次方程实际应用',
      context: context!,
    };
  },
};