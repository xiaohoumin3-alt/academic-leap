/**
 * 数据分析题目模板 - 标准差（第20章）
 *
 * 标准差 = √方差
 * 复用 variance 计算逻辑，最后一步开方
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
 * 最大数据点数量（用于参数命名）
 */
const MAX_DATA_POINTS = 12;

/**
 * 从 params 中提取数据数组
 */
function extractDataArray(params: Record<string, number>): number[] {
  const data: number[] = [];
  for (let i = 1; i <= MAX_DATA_POINTS; i++) {
    const key = `v${i}`;
    if (params[key] !== undefined) {
      data.push(params[key]);
    }
  }
  return data;
}

/**
 * 计算一组数据的均值
 */
function computeMean(data: number[]): number {
  const sum = data.reduce((acc, val) => acc + val, 0);
  return sum / data.length;
}

/**
 * 计算一组数据的方差
 */
function computeVariance(data: number[]): number {
  const mean = computeMean(data);
  const squaredDiffs = data.map(x => (x - mean) ** 2);
  return computeMean(squaredDiffs);
}

/**
 * 计算一组数据的标准差
 */
function computeStddev(data: number[]): number {
  return Math.sqrt(computeVariance(data));
}

/**
 * 标准差计算模板
 */
export const DataStddevTemplate: QuestionTemplate = {
  id: 'data_stddev_v1',
  knowledgePoint: 'data_stddev',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.data_stddev[level] ||
                   DIFFICULTY_CONFIG.data_stddev[1];

    // 生成数据集参数
    const baseParams = generateRandomParams(config);
    const { count, minVal, maxVal } = baseParams;

    const params: Record<string, number> = { ...baseParams };

    // 生成数据值，存储为 v1, v2, v3, ...
    const data: number[] = [];

    // 确保数据有一定离散度，避免标准差为0
    for (let i = 0; i < count; i++) {
      const value = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      data.push(value);
    }

    // 检查离散度，如果所有数据相同，重新生成
    if (new Set(data).size === 1) {
      // 强制增加一个不同的值
      data[0] = data[0] + 1;
    }

    // 存储为参数
    for (let i = 0; i < data.length; i++) {
      params[`v${i + 1}`] = data[i];
    }

    // 计算统计量
    const mean = computeMean(data);
    const variance = computeVariance(data);
    const stddev = computeStddev(data);

    params.mean = mean;
    params.variance = variance;
    params.stddev = stddev;

    return params;
  },

  buildSteps: (params) => {
    const { mean, variance, stddev } = params;

    return [
      {
        stepId: 's1',
        type: StepType.COMPUTE_MEAN,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '先计算这组数据的平均数',
          inputTarget: '平均数',
          inputHint: '输入平均数，保留两位小数',
        },
      },
      {
        stepId: 's2',
        type: StepType.COMPUTE_VARIANCE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '计算方差：先求每个数据与平均数的差的平方，再求平均数',
          inputTarget: '方差',
          inputHint: '输入方差，保留两位小数',
        },
      },
      {
        stepId: 's3',
        type: StepType.COMPUTE_STDDEV,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '计算标准差：方差的算术平方根',
          inputTarget: '标准差',
          inputHint: '输入标准差，保留两位小数',
        },
      },
    ];
  },

  render: (params) => {
    const data = extractDataArray(params);
    const dataStr = data.join(', ');
    return {
      title: `计算以下数据的标准差：${dataStr}`,
      description: '标准差计算',
      context: '标准差 = √方差，方差是各数据与平均数差的平方的平均数',
    };
  },
};
