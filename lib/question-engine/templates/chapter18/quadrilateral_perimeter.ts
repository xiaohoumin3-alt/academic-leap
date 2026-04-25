/**
 * 四边形周长计算模板
 * 覆盖：平行四边形、矩形、菱形、正方形
 * 公式：平行四边形/矩形=2(a+b)，菱形/正方形=4a
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
 * 生成四边形周长参数
 */
function generateQuadrilateralPerimeterParams(level: number): Record<string, number> {
  const config = DIFFICULTY_CONFIG.quadrilateral_perimeter[level] ||
                 DIFFICULTY_CONFIG.quadrilateral_perimeter[1];

  const params = generateRandomParams(config);

  // 确定四边形类型（根据难度增加类型多样性）
  let types: QuadrilateralType[];
  if (level <= 2) {
    // 基础：矩形和正方形（最简单）
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
  params.level = level;

  // 根据类型生成参数
  switch (quadrilateralType) {
    case 'rectangle':
      // 矩形：长和宽
      params.length = params.side1 || params.length || Math.floor(Math.random() * 8) + 3;
      params.width = params.side2 || params.width || Math.floor(Math.random() * 6) + 2;
      params.perimeter = 2 * (params.length + params.width);
      break;

    case 'square':
      // 正方形：边长
      params.side = params.side || Math.floor(Math.random() * 8) + 2;
      params.perimeter = 4 * params.side;
      break;

    case 'parallelogram':
      // 平行四边形：邻边长度
      params.side1 = params.side1 || Math.floor(Math.random() * 8) + 3;
      params.side2 = params.side2 || Math.floor(Math.random() * 6) + 2;
      params.perimeter = 2 * (params.side1 + params.side2);
      break;

    case 'rhombus':
      // 菱形：边长（四边相等）
      params.side = params.side || Math.floor(Math.random() * 6) + 3;
      params.perimeter = 4 * params.side;
      break;
  }

  return params;
}

/**
 * 四边形周长计算模板
 */
export const QuadrilateralPerimeterTemplate: QuestionTemplate = {
  id: 'quadrilateral_perimeter',
  knowledgePoint: 'quadrilateral_perimeter',

  generateParams: (level: number) => {
    return generateQuadrilateralPerimeterParams(level);
  },

  buildSteps: (params) => {
    const typeIndex = params.typeIndex as number;
    const level = params.level || 1;

    // 矩形
    if (typeIndex === 1) {
      const length = params.length!;
      const width = params.width!;
      const perimeter = params.perimeter!;

      return [
        {
          stepId: 's1',
          type: StepType.COMPUTE_RECT_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用矩形周长公式',
            inputTarget: '长 + 宽 的值',
            inputHint: `矩形周长 = 2 × (长 + 宽)，先算 ${length} + ${width} = ?`,
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
            instruction: '计算矩形周长',
            inputTarget: '矩形周长',
            inputHint: `周长 = 2 × ${length + width} = ${perimeter}`,
          },
        },
      ];
    }

    // 正方形
    if (typeIndex === 2) {
      const side = params.side!;
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
            inputHint: '正方形周长 = 4 × 边长，系数是？',
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
            instruction: '计算正方形周长',
            inputTarget: '正方形周长',
            inputHint: `周长 = 4 × ${side} = ${perimeter}`,
          },
        },
      ];
    }

    // 平行四边形
    if (typeIndex === 3) {
      const side1 = params.side1!;
      const side2 = params.side2!;
      const perimeter = params.perimeter!;

      return [
        {
          stepId: 's1',
          type: StepType.VERIFY_PARALLELOGRAM,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用平行四边形周长公式',
            inputTarget: '邻边之和',
            inputHint: `平行四边形周长 = 2 × (邻边1 + 邻边2)，先算 ${side1} + ${side2} = ?`,
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
            instruction: '计算平行四边形周长',
            inputTarget: '平行四边形周长',
            inputHint: `周长 = 2 × ${side1 + side2} = ${perimeter}`,
          },
        },
      ];
    }

    // 菱形
    if (typeIndex === 4) {
      const side = params.side!;
      const perimeter = params.perimeter!;

      return [
        {
          stepId: 's1',
          type: StepType.COMPUTE_RHOMBUS_PROPERTY,
          inputType: 'numeric',
          keyboard: 'numeric',
          answerType: 'number',
          tolerance: 0,
          ui: {
            instruction: '应用菱形周长公式',
            inputTarget: '周长系数',
            inputHint: '菱形四条边相等，周长 = 4 × 边长，系数是？',
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
            instruction: '计算菱形周长',
            inputTarget: '菱形周长',
            inputHint: `周长 = 4 × ${side} = ${perimeter}`,
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
        title: `矩形长为${params.length}，宽为${params.width}，求周长`,
        description: '四边形周长计算 - 矩形',
        context: `矩形周长公式：C = 2(a + b)`,
      };
    }

    if (typeIndex === 2) {
      return {
        title: `正方形边长为${params.side}，求周长`,
        description: '四边形周长计算 - 正方形',
        context: `正方形周长公式：C = 4a`,
      };
    }

    if (typeIndex === 3) {
      return {
        title: `平行四边形邻边分别为${params.side1}和${params.side2}，求周长`,
        description: '四边形周长计算 - 平行四边形',
        context: `平行四边形周长公式：C = 2(a + b)`,
      };
    }

    if (typeIndex === 4) {
      return {
        title: `菱形边长为${params.side}，求周长`,
        description: '四边形周长计算 - 菱形',
        context: `菱形周长公式：C = 4a`,
      };
    }

    return {
      title: '四边形周长计算',
      description: '四边形周长计算',
      context: '计算平行四边形、矩形、菱形、正方形的周长',
    };
  },
};
