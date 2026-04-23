/**
 * 概率统计题目模板
 */

import {
  QuestionTemplate,
  StepType,
} from '../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../difficulty';

/**
 * 概率计算模板
 */
export const ProbabilityTemplate: QuestionTemplate = {
  id: 'probability_v1',
  knowledgePoint: 'probability',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.probability[level] ||
                   DIFFICULTY_CONFIG.probability[1];

    // 确保 favorable < total
    let params: Record<string, number>;
    let attempts = 0;
    do {
      params = generateRandomParams(config);
      attempts++;
    } while (params.favorable >= params.total && attempts < 100);

    return params;
  },

  buildSteps: (params) => {
    const { total, favorable } = params;
    const probability = favorable / total;

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_PROBABILITY,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '用有利结果数除以总结果数，求概率（用小数表示）',
          inputTarget: '概率（小数）',
          inputHint: '输入0-1之间的小数，保留两位',
        },
      },
    ];
  },

  render: (params) => {
    const { total, favorable } = params;
    return {
      title: `一个袋子里有 ${total} 个球，其中 ${favorable} 个是红球。随机取出一个球，是红球的概率是多少？（用小数表示，保留两位）`,
      description: '概率计算',
      context: '概率 = 有利结果数 / 总结果数',
    };
  },
};

/**
 * 一元一次方程模板
 */
export const LinearEquationTemplate: QuestionTemplate = {
  id: 'linear_equation_v1',
  knowledgePoint: 'linear_equation',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.linear_equation[level] ||
                   DIFFICULTY_CONFIG.linear_equation[1];

    // 生成参数：ax + b = c，其中 x 是已知解
    const params = generateRandomParams(config);
    const { a, b, x } = params;
    const c = a * x + b;

    return { a, b, c, x };
  },

  buildSteps: (params) => {
    const { a, b, c, x } = params;

    return [
      {
        stepId: 's1',
        type: StepType.SOLVE_LINEAR_EQUATION,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '解方程，求 x 的值',
          inputTarget: 'x 的值',
          inputHint: '输入数字',
        },
      },
    ];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = b >= 0 ? `+ ${b}` : `${b}`;
    return {
      title: `${a}x ${bStr} = ${c}，求 x 的值`,
      description: '一元一次方程',
      context: `${a}x = ${c - b}, x = ${(c - b) / a}`,
    };
  },
};
