/**
 * 梯形性质计算模板
 * 覆盖：等腰梯形、直角梯形、梯形中位线
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
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
  // 注意：types数组顺序必须与buildSteps中的typeIndex检查顺序一致
  // typeIndex 1=isosceles, 2=right, 3=midsegment
  let types: TrapezoidType[];
  if (level <= 2) {
    // 基础：只有中位线（对应typeIndex=3）
    types = ['midsegment'];
  } else if (level <= 4) {
    // 中等：等腰梯形和直角梯形
    types = ['isosceles', 'right'];
  } else {
    // 高级：全部类型
    types = ['isosceles', 'right', 'midsegment'];
  }

  const typeIndex = Math.floor(Math.random() * types.length);
  const trapezoidType = types[typeIndex];
  // 由于types顺序与buildSteps一致，需要映射到正确的typeIndex
  const typeIndexMap: Record<TrapezoidType, number> = {
    isosceles: 1,
    right: 2,
    midsegment: 3
  };
  params.typeIndex = typeIndexMap[trapezoidType];

  // 根据类型生成参数
  switch (trapezoidType) {
    case 'isosceles':
      // 等腰梯形：上底、下底、腰长
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

  buildSteps: (params): StepProtocolV2[] => {
    const typeIndex = params.typeIndex as number;

    // 等腰梯形
    if (typeIndex === 1) {
      const upperBase = params.upperBase!;
      const lowerBase = params.lowerBase!;
      const leg = params.leg!;
      const perimeter = params.perimeter!;

      return [
        {
          stepId: 's1',
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '识别等腰梯形的性质',
            hint: `等腰梯形两腰相等，已知一条腰长为${leg}，另一条腰长为？`,
          },
          expectedAnswer: { type: 'number', value: leg },
          keyboard: { type: 'numeric' },
        },
        {
          stepId: 's2',
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '计算等腰梯形的周长',
            hint: `周长 = 上底 + 下底 + 2 × 腰 = ${upperBase} + ${lowerBase} + 2 × ${leg}`,
          },
          expectedAnswer: { type: 'number', value: perimeter },
          keyboard: { type: 'numeric' },
        },
      ];
    }

    // 直角梯形
    if (typeIndex === 2) {
      const upperBase = params.upperBase!;
      const lowerBase = params.lowerBase!;
      const height = params.height!;
      const leg = params.leg!;
      const perimeter = params.perimeter!;

      return [
        {
          stepId: 's1',
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '识别直角梯形的性质',
            hint: '直角梯形有几个直角？',
          },
          expectedAnswer: { type: 'number', value: 2 },
          keyboard: { type: 'numeric' },
        },
        {
          stepId: 's2',
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '计算直角梯形的周长',
            hint: `周长 = 上底 + 下底 + 高 + 斜腰 = ${upperBase} + ${lowerBase} + ${height} + ${leg}`,
          },
          expectedAnswer: { type: 'number', value: perimeter },
          keyboard: { type: 'numeric' },
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
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '应用梯形中位线定理',
            hint: `梯形中位线 = (上底 + 下底) ÷ 2，先算 ${upperBase} + ${lowerBase} = ?`,
          },
          expectedAnswer: { type: 'number', value: upperBase + lowerBase },
          keyboard: { type: 'numeric' },
        },
        {
          stepId: 's2',
          answerMode: AnswerMode.NUMBER,
          ui: {
            instruction: '计算中位线长度',
            hint: `中位线 = (${upperBase} + ${lowerBase}) ÷ 2`,
          },
          expectedAnswer: { type: 'number', value: midsegment },
          keyboard: { type: 'numeric' },
        },
      ];
    }

    return [];
  },

  render: (params) => {
    const typeIndex = params.typeIndex as number;

    if (typeIndex === 1) {
      return {
        title: `等腰梯形上底为${params.upperBase}，下底为${params.lowerBase}，腰长为${params.leg ?? '?'}，求周长`,
        description: '梯形性质计算 - 等腰梯形',
        context: `等腰梯形：两腰相等，周长 = 上底 + 下底 + 2 × 腰`,
      };
    }

    if (typeIndex === 2) {
      return {
        title: `直角梯形上底为${params.upperBase}，下底为${params.lowerBase}，高为${params.height}，斜腰为${params.leg ?? '?'}，求周长`,
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
