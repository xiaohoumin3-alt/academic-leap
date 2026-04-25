/**
 * 正方形性质计算模板
 * 正方形 = 矩形 + 菱形，因此具有两者所有性质
 * 应用正方形对角线性质、周长、面积等
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
 * 正方形问题类型
 */
type SquareProblemType = 'diagonal_length' | 'area' | 'perimeter' | 'diagonal_property';

/**
 * 生成正方形参数
 */
function generateSquarePropertyParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.square_property[level] ||
                 DIFFICULTY_CONFIG.square_property[1];

  // 生成边长
  const side = generateRandomParams({ side: config.side }).side;

  // 随机选择问题类型
  const problemTypes: SquareProblemType[] = ['diagonal_length', 'area', 'perimeter', 'diagonal_property'];
  const typeIndex = Math.floor(Math.random() * problemTypes.length);
  const problemType = problemTypes[typeIndex];

  const params: Record<string, number> = {
    side,
    problemType: typeIndex + 1, // 1-4
  };

  // 根据问题类型计算答案
  switch (problemType) {
    case 'diagonal_length':
      // 对角线长度 = side * √2
      params.diagonal = side * Math.SQRT2;
      break;

    case 'area':
      // 面积 = side²
      params.area = side * side;
      break;

    case 'perimeter':
      // 周长 = 4 * side
      params.perimeter = 4 * side;
      break;

    case 'diagonal_property':
      // 对角线与边长的关系：对角线/边 = √2
      params.ratio = Math.SQRT2;
      params.diagonal = side * Math.SQRT2;
      params.side = side;
      break;
  }

  return params;
}

/**
 * 正方形性质计算模板
 */
export const SquarePropertyTemplate: QuestionTemplate = {
  id: 'square_property',
  knowledgePoint: 'square_property',

  generateParams: (level: number) => {
    return generateSquarePropertyParams(level);
  },

  buildSteps: (params) => {
    const problemType = params.problemType as unknown as SquareProblemType;
    const side = params.side!;
    const level = params.level || 1;

    switch (problemType) {
      case 'diagonal_length': {
        // 第一步：应用正方形对角线性质
        // 正方形的对角线长度 = 边长 × √2
        const diagonal = params.diagonal!;

        return [
          {
            stepId: 's1',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.01,
            ui: {
              instruction: '应用正方形对角线性质',
              inputTarget: '对角线与边长的比值',
              inputHint: `正方形对角线 = 边长 × √2，对角线/边长 = √2 ≈ ${Math.SQRT2.toFixed(4)}`,
            },
          },
          {
            stepId: 's2',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.01,
            ui: {
              instruction: '计算对角线的精确长度',
              inputTarget: '对角线长度（保留整数）',
              inputHint: `对角线 = ${side} × √2 ≈ ${diagonal.toFixed(2)}，取整数部分`,
            },
          },
        ];
      }

      case 'area': {
        // 第一步：应用正方形面积性质
        const area = params.area!;

        return [
          {
            stepId: 's1',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '应用正方形面积公式',
              inputTarget: '边长的平方值',
              inputHint: `正方形面积 = 边长² = ${side}² = ?`,
            },
          },
          {
            stepId: 's2',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '得出面积结果',
              inputTarget: '正方形面积',
              inputHint: `面积 = ${side} × ${side} = ${area}`,
            },
          },
        ];
      }

      case 'perimeter': {
        // 第一步：应用正方形周长性质
        const perimeter = params.perimeter!;

        return [
          {
            stepId: 's1',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '应用正方形周长公式',
              inputTarget: '周长系数',
              inputHint: `正方形周长 = 4 × 边长，周长/边长 = ?`,
            },
          },
          {
            stepId: 's2',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0,
            ui: {
              instruction: '计算周长',
              inputTarget: '正方形周长',
              inputHint: `周长 = 4 × ${side} = ${perimeter}`,
            },
          },
        ];
      }

      case 'diagonal_property': {
        // 第一步：分析对角线性质
        // 正方形对角线互相垂直且平分
        return [
          {
            stepId: 's1',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.01,
            ui: {
              instruction: '分析正方形对角线性质',
              inputTarget: '对角线与边长的比值',
              inputHint: `正方形对角线与边长的比值 = √2 ≈ ${Math.SQRT2.toFixed(4)}`,
            },
          },
          {
            stepId: 's2',
            type: StepType.COMPUTE_SQUARE_PROPERTY,
            inputType: 'numeric',
            keyboard: 'numeric',
            answerType: 'number',
            tolerance: 0.01,
            ui: {
              instruction: '验证对角线长度',
              inputTarget: '对角线长度（约）',
              inputHint: `已知边长为${side}，对角线 = ${side} × √2 ≈ ${params.diagonal!.toFixed(2)}`,
            },
          },
        ];
      }

      default:
        return [];
    }
  },

  render: (params) => {
    const problemType = params.problemType as unknown as SquareProblemType;
    const side = params.side!;

    switch (problemType) {
      case 'diagonal_length':
        return {
          title: `正方形边长为${side}，求对角线长度`,
          description: '正方形性质 - 对角线',
          context: `正方形对角线长度 = 边长 × √2。边长 = ${side}，求对角线。`,
        };

      case 'area':
        return {
          title: `正方形边长为${side}，求面积`,
          description: '正方形性质 - 面积',
          context: `正方形面积 = 边长²。边长 = ${side}，求面积。`,
        };

      case 'perimeter':
        return {
          title: `正方形边长为${side}，求周长`,
          description: '正方形性质 - 周长',
          context: `正方形周长 = 4 × 边长。边长 = ${side}，求周长。`,
        };

      case 'diagonal_property':
        return {
          title: `正方形边长为${side}，分析对角线性质`,
          description: '正方形性质 - 对角线关系',
          context: `正方形对角线互相垂直且平分，夹角为90°。边长 = ${side}，求对角线长度。`,
        };

      default:
        return {
          title: '正方形性质计算',
          description: '正方形性质',
          context: '计算正方形的周长、面积、对角线等',
        };
    }
  },
};