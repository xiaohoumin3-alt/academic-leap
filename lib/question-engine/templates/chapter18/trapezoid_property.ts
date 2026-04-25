/**
 * 梯形性质计算模板
 * 覆盖：等腰梯形、直角梯形、梯形中位线
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
 * 梯形类型
 */
type TrapezoidType = 'isosceles' | 'right' | 'midsegment';

/**
 * 生成梯形性质参数
 */
function generateTrapezoidPropertyParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.trapezoid_property[level] ||
                 DIFFICULTY_CONFIG.trapezoid_property[1];

  const params = generateRandomParams(config);
  params.level = level;

  // 确定梯形类型
  let types: TrapezoidType[];
  if (level <= 2) {
    // 基础：梯形中位线（最直接）
    types = ['midsegment'];
  } else if (level <= 4) {
    // 中等：增加直角梯形
    types = ['midsegment', 'right'];
  } else {
    // 高级：全部类型
    types = ['isosceles', 'right', 'midsegment'];
  }

  const typeIndex = Math.floor(Math.random() * types.length);
  const trapezoidType = types[typeIndex];
  params.typeIndex = typeIndex + 1;

  // 根据类型生成参数
  switch (trapezoidType) {
    case 'isosceles':
      // 等腰梯形：上底、下底、腰长
      // 确保是合法等腰梯形
      params.upperBase = params.upperBase || Math.floor(Math.random() * 6) + 3;
      params.lowerBase = params.lowerBase || params.upperBase + Math.floor(Math.random() * 8) + 4;
      params.leg = params.leg || Math.floor(Math.random() * 5) + 4;
      // 高度（用于计算面积）
      params.height = params.height || Math.floor(Math.random() * 4) + 3;
      // 周长
      params.perimeter = params.upperBase + params.lowerBase + 2 * params.leg;
      // 腰长相等
      params.leg1 = params.leg;
      params.leg2 = params.leg;
      break;

    case 'right':
      // 直角梯形：上底、下底、高（也是一条腰）
      params.upperBase = params.upperBase || Math.floor(Math.random() * 6) + 3;
      params.lowerBase = params.lowerBase || params.upperBase + Math.floor(Math.random() * 8) + 4;
      params.height = params.height || Math.floor(Math.random() * 5) + 3;
      params.leg = params.leg || Math.floor(Math.random() * 6) + 4;
      // 周长
      params.perimeter = params.upperBase + params.lowerBase + params.height + params.leg;
      break;

    case 'midsegment':
      // 梯形中位线：中位线 = (上底 + 下底) / 2
      params.upperBase = params.upperBase || Math.floor(Math.random() * 8) + 4;
      params.lowerBase = params.lowerBase || params.upperBase + Math.floor(Math.random() * 10) + 6;
      params.midsegment = (params.upperBase + params.lowerBase) / 2;
      break;
  }

  return params;
}

/**
 * 梯形性质计算模板
 */
export const TrapezoidPropertyTemplate: QuestionTemplate = {
  id: 'trapezoid_property',
  knowledgePoint: 'trapezoid_property',

  generateParams: (level: number) => {
    return generateTrapezoidPropertyParams(level);
  },

  buildSteps: (params) => {
    const typeIndex = params.typeIndex as number;

    // 等腰梯形
    if (typeIndex === 1) {
      const upperBase = params.upperBase!;
      const lowerBase = params.lowerBase!;
      const leg = params.leg!;

      return [
        {
          stepId: 's1',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '识别等腰梯形的性质',
            inputTarget: '等腰梯形的腰长',
            inputHint: `等腰梯形两腰相等，已知一条腰长为${leg}，另一条腰长为？`,
          },
        },
        {
          stepId: 's2',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '计算等腰梯形的周长',
            inputTarget: '梯形周长',
            inputHint: `周长 = 上底 + 下底 + 2 × 腰 = ${upperBase} + ${lowerBase} + 2 × ${leg} = ${params.perimeter}`,
          },
        },
      ];
    }

    // 直角梯形
    if (typeIndex === 2) {
      const upperBase = params.upperBase!;
      const lowerBase = params.lowerBase!;
      const height = params.height!;
      const leg = params.leg!;

      return [
        {
          stepId: 's1',
          type: StepType.VERIFY_RECTANGLE,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '识别直角梯形的性质',
            inputTarget: '直角的数量',
            inputHint: '直角梯形有2个直角',
          },
        },
        {
          stepId: 's2',
          type: StepType.VERIFY_RECTANGLE,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '计算直角梯形的周长',
            inputTarget: '梯形周长',
            inputHint: `周长 = 上底 + 下底 + 高 + 斜腰 = ${upperBase} + ${lowerBase} + ${height} + ${leg} = ${params.perimeter}`,
          },
        },
      ];
    }

    // 梯形中位线
    if (typeIndex === 3) {
      const upperBase = params.upperBase!;
      const lowerBase = params.lowerBase!;
      const midsegment = params.midsegment!;

      return [
        {
          stepId: 's1',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用梯形中位线定理',
            inputTarget: '上底 + 下底',
            inputHint: `梯形中位线 = (上底 + 下底) ÷ 2，先算 ${upperBase} + ${lowerBase} = ?`,
          },
        },
        {
          stepId: 's2',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '计算中位线长度',
            inputTarget: '中位线长度',
            inputHint: `中位线 = (${upperBase} + ${lowerBase}) ÷ 2 = ${midsegment}`,
          },
        },
      ];
    }

    return [];
  },

  render: (params) => {
    const typeIndex = params.typeIndex as number;

    if (typeIndex === 1) {
      return {
        title: `等腰梯形上底为${params.upperBase}，下底为${params.lowerBase}，腰长为${params.leg}，求周长`,
        description: '梯形性质计算 - 等腰梯形',
        context: `等腰梯形：两腰相等，周长 = 上底 + 下底 + 2 × 腰`,
      };
    }

    if (typeIndex === 2) {
      return {
        title: `直角梯形上底为${params.upperBase}，下底为${params.lowerBase}，高为${params.height}，斜腰为${params.leg}，求周长`,
        description: '梯形性质计算 - 直角梯形',
        context: `直角梯形：有2个直角，周长 = 上底 + 下底 + 高 + 斜腰`,
      };
    }

    if (typeIndex === 3) {
      return {
        title: `梯形上底为${params.upperBase}，下底为${params.lowerBase}，求中位线长度`,
        description: '梯形性质计算 - 梯形中位线',
        context: `梯形中位线定理：中位线 = (上底 + 下底) ÷ 2`,
      };
    }

    return {
      title: '梯形性质计算',
      description: '梯形性质计算',
      context: '计算等腰梯形、直角梯形的周长，以及梯形中位线',
    };
  },
};
