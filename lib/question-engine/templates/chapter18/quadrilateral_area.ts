/**
 * 四边形面积计算模板
 * 覆盖：平行四边形、矩形、菱形、正方形
 * 公式：平行四边形/矩形=底×高，菱形=对角线积/2，正方形=边²
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
 * 四边形类型
 */
type QuadrilateralType = 'parallelogram' | 'rectangle' | 'rhombus' | 'square';

/**
 * 生成四边形面积参数
 */
function generateQuadrilateralAreaParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadrilateral_area[level] ||
                 DIFFICULTY_CONFIG.quadrilateral_area[1];

  const params = generateRandomParams(config);
  params.level = level;

  // 确定四边形类型
  let types: QuadrilateralType[];
  if (level <= 2) {
    // 基础：矩形和正方形
    types = ['rectangle', 'square'];
  } else if (level <= 4) {
    // 中等：增加平行四边形
    types = ['parallelogram', 'rectangle', 'square'];
  } else {
    // 高级：全部类型
    types = ['parallelogram', 'rectangle', 'rhombus', 'square'];
  }

  const typeIndex = Math.floor(Math.random() * types.length);
  const quadrilateralType = types[typeIndex];
  params.typeIndex = typeIndex + 1;

  // 根据类型生成参数
  switch (quadrilateralType) {
    case 'rectangle':
      // 矩形：长和宽
      params.length = params.length || Math.floor(Math.random() * 8) + 3;
      params.width = params.width || Math.floor(Math.random() * 6) + 2;
      params.area = params.length * params.width;
      break;

    case 'square':
      // 正方形：边长
      params.side = params.side || Math.floor(Math.random() * 8) + 2;
      params.area = params.side * params.side;
      break;

    case 'parallelogram':
      // 平行四边形：底和高
      params.base = params.base || Math.floor(Math.random() * 10) + 4;
      params.height = params.height || Math.floor(Math.random() * 6) + 3;
      params.area = params.base * params.height;
      break;

    case 'rhombus':
      // 菱形：对角线（对角线互相垂直平分）
      params.diagonal1 = params.diagonal1 || Math.floor(Math.random() * 8) + 4;
      params.diagonal2 = params.diagonal2 || Math.floor(Math.random() * 6) + 4;
      params.area = (params.diagonal1 * params.diagonal2) / 2;
      break;
  }

  return params;
}

/**
 * 四边形面积计算模板
 */
export const QuadrilateralAreaTemplate: QuestionTemplate = {
  id: 'quadrilateral_area',
  knowledgePoint: 'quadrilateral_area',

  generateParams: (level: number) => {
    return generateQuadrilateralAreaParams(level);
  },

  buildSteps: (params) => {
    const typeIndex = params.typeIndex as number;

    // 矩形
    if (typeIndex === 1) {
      const length = params.length!;
      const width = params.width!;
      const area = params.area!;

      return [
        {
          stepId: 's1',
          type: StepType.COMPUTE_RECT_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用矩形面积公式',
            inputTarget: '长 × 宽',
            inputHint: `矩形面积 = 长 × 宽 = ${length} × ${width} = ?`,
          },
        },
        {
          stepId: 's2',
          type: StepType.COMPUTE_RECT_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '得出矩形面积',
            inputTarget: '矩形面积',
            inputHint: `面积 = ${area}`,
          },
        },
      ];
    }

    // 正方形
    if (typeIndex === 2) {
      const side = params.side!;
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
            inputTarget: '边长的平方',
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
            instruction: '得出正方形面积',
            inputTarget: '正方形面积',
            inputHint: `面积 = ${area}`,
          },
        },
      ];
    }

    // 平行四边形
    if (typeIndex === 3) {
      const base = params.base!;
      const height = params.height!;
      const area = params.area!;

      return [
        {
          stepId: 's1',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用平行四边形面积公式',
            inputTarget: '底 × 高',
            inputHint: `平行四边形面积 = 底 × 高 = ${base} × ${height} = ?`,
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
            instruction: '得出平行四边形面积',
            inputTarget: '平行四边形面积',
            inputHint: `面积 = ${area}`,
          },
        },
      ];
    }

    // 菱形
    if (typeIndex === 4) {
      const diagonal1 = params.diagonal1!;
      const diagonal2 = params.diagonal2!;
      const area = params.area!;

      return [
        {
          stepId: 's1',
          type: StepType.COMPUTE_RHOMBUS_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用菱形面积公式',
            inputTarget: '对角线之积的一半',
            inputHint: `菱形面积 = (对角线1 × 对角线2) ÷ 2 = (${diagonal1} × ${diagonal2}) ÷ 2`,
          },
        },
        {
          stepId: 's2',
          type: StepType.COMPUTE_RHOMBUS_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '得出菱形面积',
            inputTarget: '菱形面积',
            inputHint: `面积 = ${area}`,
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
        title: `矩形长为${params.length}，宽为${params.width}，求面积`,
        description: '四边形面积计算 - 矩形',
        context: `矩形面积公式：S = 长 × 宽`,
      };
    }

    if (typeIndex === 2) {
      return {
        title: `正方形边长为${params.side}，求面积`,
        description: '四边形面积计算 - 正方形',
        context: `正方形面积公式：S = 边长²`,
      };
    }

    if (typeIndex === 3) {
      return {
        title: `平行四边形底为${params.base}，高为${params.height}，求面积`,
        description: '四边形面积计算 - 平行四边形',
        context: `平行四边形面积公式：S = 底 × 高`,
      };
    }

    if (typeIndex === 4) {
      return {
        title: `菱形对角线分别为${params.diagonal1}和${params.diagonal2}，求面积`,
        description: '四边形面积计算 - 菱形',
        context: `菱形面积公式：S = (对角线1 × 对角线2) ÷ 2`,
      };
    }

    return {
      title: '四边形面积计算',
      description: '四边形面积计算',
      context: '计算平行四边形、矩形、菱形、正方形的面积',
    };
  },
};
