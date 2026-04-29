/**
 * 集中趋势测量模板
 * 平均数(mean)、中位数(median)、众数(mode)
 * 单一模板通过 measureType 参数控制类型
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
 * 测量类型
 */
export type MeasureType = 'mean' | 'median' | 'mode';

/**
 * 最大数据点数量（用于参数命名）
 */
const MAX_DATA_POINTS = 30;

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
 * 生成数据集（用于平均数和中位数）
 */
function generateDataSet(level: number, count: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.central_tendency[level] ||
                 DIFFICULTY_CONFIG.central_tendency[1];

  const params: Record<string, number> = { count };

  // 生成数据值，存储为 v1, v2, v3, ...
  for (let i = 0; i < count; i++) {
    const valueConstraint = config.value;
    let value: number;

    if (valueConstraint.type === 'int') {
      value = Math.floor(Math.random() * (valueConstraint.max - valueConstraint.min + 1)) + valueConstraint.min;
    } else {
      value = Math.random() * (valueConstraint.max - valueConstraint.min) + valueConstraint.min;
      // 保留两位小数
      value = Math.round(value * 100) / 100;
    }

    params[`v${i + 1}`] = value;
  }

  return params;
}

/**
 * 生成众数数据集（确保存在明确的众数）
 */
function generateModeDataSet(level: number, count: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.central_tendency[level] ||
                 DIFFICULTY_CONFIG.central_tendency[1];

  const valueConstraint = config.value;
  const params: Record<string, number> = { count };

  // 选择众数值
  let mode: number;
  if (valueConstraint.type === 'int') {
    mode = Math.floor(Math.random() * (valueConstraint.max - valueConstraint.min + 1)) + valueConstraint.min;
  } else {
    mode = Math.random() * (valueConstraint.max - valueConstraint.min) + valueConstraint.min;
    mode = Math.round(mode * 100) / 100;
  }

  // 计算众数出现次数（至少出现3次，或至少占总数的30%）
  const modeFrequency = Math.max(3, Math.ceil(count * 0.3));

  const dataValues: number[] = [];

  // 添加众数
  for (let i = 0; i < modeFrequency; i++) {
    dataValues.push(mode);
  }

  // 添加其他不同的值（确保不与mode重复）
  const remainingCount = count - modeFrequency;
  for (let i = 0; i < remainingCount; i++) {
    let otherValue: number;
    let attempts = 0;

    do {
      if (valueConstraint.type === 'int') {
        otherValue = Math.floor(Math.random() * (valueConstraint.max - valueConstraint.min + 1)) + valueConstraint.min;
      } else {
        otherValue = Math.random() * (valueConstraint.max - valueConstraint.min) + valueConstraint.min;
        otherValue = Math.round(otherValue * 100) / 100;
      }
      attempts++;
    } while (otherValue === mode && attempts < 100);

    dataValues.push(otherValue);
  }

  // 打乱数据顺序
  for (let i = dataValues.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [dataValues[i], dataValues[j]] = [dataValues[j], dataValues[i]];
  }

  // 存储为参数
  for (let i = 0; i < dataValues.length; i++) {
    params[`v${i + 1}`] = dataValues[i];
  }

  params.expectedAnswer = mode;

  return params;
}

/**
 * 集中趋势测量模板
 */
export const CentralTendencyTemplate: QuestionTemplate = {
  id: 'central_tendency',
  knowledgePoint: 'central_tendency',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.central_tendency[level] ||
                   DIFFICULTY_CONFIG.central_tendency[1];

    const countConfig = config.count;
    const count = Math.floor(Math.random() * (countConfig.max - countConfig.min + 1)) + countConfig.min;

    // 随机选择测量类型: 1=mean, 2=median, 3=mode
    const measureType = Math.floor(Math.random() * 3) + 1;

    let params: Record<string, number>;

    if (measureType === 3) {
      // mode
      params = generateModeDataSet(level, count);
    } else {
      // mean or median
      params = generateDataSet(level, count);

      const data = extractDataArray(params);

      if (measureType === 1) {
        // mean
        const sum = data.reduce((a, b) => a + b, 0);
        params.expectedAnswer = Math.round((sum / count) * 100) / 100;
      } else {
        // median
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(count / 2);
        const median = count % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        params.expectedAnswer = Math.round(median * 100) / 100;
      }
    }

    params.measureType = measureType;
    params.level = level;

    return params;
  },

  buildSteps: (params) => {
    const { measureType } = params;

    let stepType: StepType;
    let measureName: string;
    let instruction: string;

    switch (measureType) {
      case 1: // mean
        stepType = StepType.COMPUTE_MEAN;
        measureName = '平均数';
        instruction = '计算这组数据的平均数（所有数据的和除以数据的个数）';
        break;
      case 2: // median
        stepType = StepType.COMPUTE_MEDIAN;
        measureName = '中位数';
        instruction = '计算这组数据的中位数（将数据从小到大排列后，位于中间位置的数）';
        break;
      case 3: // mode
        stepType = StepType.COMPUTE_MODE;
        measureName = '众数';
        instruction = '找出这组数据的众数（出现次数最多的数据）';
        break;
      default:
        stepType = StepType.COMPUTE_MEAN;
        measureName = '平均数';
        instruction = '计算这组数据的平均数';
    }

    return [
      {
        stepId: 's1',
        type: stepType,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction,
          inputTarget: `${measureName}的值`,
          inputHint: '输入数字（保留两位小数）',
        },
      },
    ];
  },

  render: (params) => {
    const { measureType } = params;
    const data = extractDataArray(params);

    let measureName: string;
    let title: string;

    switch (measureType) {
      case 1:
        measureName = '平均数';
        title = `计算一组数据的平均数`;
        break;
      case 2:
        measureName = '中位数';
        title = `计算一组数据的中位数`;
        break;
      case 3:
        measureName = '众数';
        title = `找出一组数据的众数`;
        break;
      default:
        measureName = '平均数';
        title = `计算一组数据的平均数`;
    }

    const dataStr = data.join(', ');

    return {
      title,
      description: `集中趋势测量 - ${measureName}`,
      context: `数据集：${dataStr}`,
    };
  },
};
