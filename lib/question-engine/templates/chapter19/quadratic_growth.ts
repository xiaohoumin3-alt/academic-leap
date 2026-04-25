/**
 * 一元二次方程应用题 - 平均增长率模板
 * 问题类型：连续两年平均增长率，建立一元二次方程求解
 *
 * 公式：终值 = 初值 × (1 + r)²
 * 其中 r 为平均增长率
 */

import {
  QuestionTemplate,
  StepType,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
  formatNumber,
} from '../../difficulty';

/**
 * 问题场景类型（作为数字索引）
 */
export type GrowthScenario = 0 | 1 | 2 | 3 | 4;

/**
 * 场景配置
 */
interface ScenarioConfig {
  unit: string;              // 单位
  subject: string;           // 主体
  verb: string;              // 动词
  initialLabel: string;      // 初值标签
  finalLabel: string;        // 终值标签
}

/**
 * 场景配置映射（数组形式，索引对应 GrowthScenario）
 */
const SCENARIO_CONFIGS: ScenarioConfig[] = [
  {  // 0: business_revenue - 营业收入增长
    unit: '万元',
    subject: '某企业',
    verb: '营业收入',
    initialLabel: '去年',
    finalLabel: '今年',
  },
  {  // 1: population - 人口增长
    unit: '万人',
    subject: '某地区',
    verb: '人口数量',
    initialLabel: '去年年初',
    finalLabel: '今年年初',
  },
  {  // 2: investment - 投资收益
    unit: '万元',
    subject: '某投资',
    verb: '价值',
    initialLabel: '两年前',
    finalLabel: '现在',
  },
  {  // 3: production - 产量增长
    unit: '件',
    subject: '某工厂',
    verb: '产品产量',
    initialLabel: '去年',
    finalLabel: '今年',
  },
  {  // 4: sales - 销售额增长
    unit: '万元',
    subject: '某商店',
    verb: '月销售额',
    initialLabel: '去年同月',
    finalLabel: '今年同月',
  },
];

/**
 * 生成增长率问题参数
 * 约束：增长率 r 应该使得方程有合理的解
 */
function generateGrowthParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadratic_growth[level] ||
                 DIFFICULTY_CONFIG.quadratic_growth[1];

  // 选择增长率 r（作为百分比，如 10 表示 10%）
  const r = generateRandomParams({ r: config.r }).r;

  // 选择初始值
  const initialValue = generateRandomParams({ initialValue: config.initialValue }).initialValue;

  // 计算终值：final = initial × (1 + r)²
  const rDecimal = r / 100;
  const finalValue = Math.round(initialValue * Math.pow(1 + rDecimal, 2));

  // 选择场景（0-4）
  const scenario: GrowthScenario = Math.floor(Math.random() * 5) as GrowthScenario;

  return {
    r,
    initialValue,
    finalValue,
    scenario,
  };
}

/**
 * 一元二次方程应用题 - 平均增长率模板
 */
export const QuadraticGrowthTemplate: QuestionTemplate = {
  id: 'quadratic_growth',
  knowledgePoint: 'quadratic_application',

  generateParams: (level: number) => {
    return generateGrowthParams(level);
  },

  buildSteps: (params) => {
    const { r } = params;

    return [
      {
        stepId: 's1',
        type: StepType.QUADRATIC_APPLICATION,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.1,  // 允许 0.1% 的误差
        ui: {
          instruction: '设平均增长率为 x，根据题意建立方程',
          inputTarget: '增长率 x（用百分数表示，如 10 表示 10%）',
          inputHint: '利用公式：终值 = 初值 × (1 + x)²',
        },
      },
    ];
  },

  render: (params) => {
    const { r, initialValue, finalValue, scenario } = params;
    const config = SCENARIO_CONFIGS[scenario];

    const title = `${config.subject}${config.initialLabel}${config.verb}为 ${initialValue}${config.unit}，${config.finalLabel}达到 ${finalValue}${config.unit}，求平均增长率`;

    return {
      title,
      description: '平均增长率问题',
      context: `设平均增长率为 x，则有：${config.initialLabel}值 × (1 + x)² = ${config.finalLabel}值。这是一个关于 x 的一元二次方程，可用求根公式或配方法求解。`,
    };
  },
};
