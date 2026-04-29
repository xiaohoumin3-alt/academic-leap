/**
 * 勾股定理折叠问题模板
 * 图形折叠后求线段长度问题
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
 * 折叠问题类型
 */
type FoldingType = 'right_triangle_fold' | 'rectangle_fold' | 'triangle_fold';

/**
 * 折叠问题配置
 */
const FOLDING_TYPES: { type: FoldingType; weight: number; description: string }[] = [
  { type: 'right_triangle_fold', weight: 0.4, description: '直角三角形的折叠' },
  { type: 'rectangle_fold', weight: 0.3, description: '矩形的折叠' },
  { type: 'triangle_fold', weight: 0.3, description: '一般三角形的折叠' },
];

/**
 * 生成折叠问题数据
 */
function generateFoldingData(
  foldingType: FoldingType,
  params: Record<string, number>
): {
  foldingType: FoldingType;
  originalLength: number;
  foldedLength: number;
  unknownSegment: number;
  description: string;
  foldDescription: string;
  modelDescription: string;
  a: number;
  b: number;
  c: number;
} {
  const { a, b } = params;
  const cSquared = a * a + b * b;
  const c = Math.sqrt(cSquared);

  switch (foldingType) {
    case 'right_triangle_fold':
      // 直角三角形的折叠问题
      // 例如：将直角三角形的直角顶点折叠到斜边上，求某段长度
      return {
        foldingType: 'right_triangle_fold',
        originalLength: c,
        foldedLength: a,
        unknownSegment: b / 2,
        description: '直角三角形折叠',
        foldDescription: `直角三角形ABC中，∠C=90°，AC=${a}，BC=${b}。将点C折叠到斜边AB上，求折叠后落点到A点的距离`,
        modelDescription: `设折叠后C落在AB上为D点，利用折叠性质：CD垂直AB且为折痕`,
        a,
        b,
        c: Math.round(c * 100) / 100,
      };

    case 'rectangle_fold':
      // 矩形的折叠问题
      // 例如：将矩形的顶点折叠到对边，求某段长度
      return {
        foldingType: 'rectangle_fold',
        originalLength: a,
        foldedLength: b,
        unknownSegment: Math.min(a, b) / 2,
        description: '矩形折叠',
        foldDescription: `矩形ABCD中，AB=${a}，BC=${b}。将点B折叠到边AD上，折叠后B落在E点，求BE的长度`,
        modelDescription: `利用折叠性质：BE垂直平分折痕，三角形ABE为直角三角形`,
        a,
        b,
        c: Math.round(c * 100) / 100,
      };

    case 'triangle_fold':
      // 一般三角形的折叠
      return {
        foldingType: 'triangle_fold',
        originalLength: c,
        foldedLength: a,
        unknownSegment: b / 3,
        description: '等腰三角形折叠',
        foldDescription: `等腰三角形ABC中，AB=AC=${c.toFixed(1)}，BC=${b}。将顶点A折叠到BC边上，落点为D，求AD的长度`,
        modelDescription: `折叠后A落在BC上为D点，利用对称性：AD垂直BC`,
        a,
        b,
        c: Math.round(c * 100) / 100,
      };
  }
}

/**
 * 勾股定理折叠问题模板
 */
export const PythagorasFoldingTemplate: QuestionTemplate = {
  id: 'pythagoras_folding',
  knowledgePoint: 'pythagoras_folding',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.pythagoras_folding[level] ||
                   DIFFICULTY_CONFIG.pythagoras_folding[1];

    const params = generateRandomParams(config);

    // 根据难度选择折叠类型
    let foldingType: FoldingType;
    if (level <= 2) {
      // 基础：只用直角三角形折叠
      foldingType = 'right_triangle_fold';
      params.foldingTypeIndex = 0;
    } else if (level <= 3) {
      // 中等：增加矩形折叠
      foldingType = Math.random() < 0.6 ? 'right_triangle_fold' : 'rectangle_fold';
      params.foldingTypeIndex = foldingType === 'right_triangle_fold' ? 0 : 1;
    } else {
      // 高级：包含所有类型
      const rand = Math.random();
      if (rand < 0.4) {
        foldingType = 'right_triangle_fold';
        params.foldingTypeIndex = 0;
      } else if (rand < 0.7) {
        foldingType = 'rectangle_fold';
        params.foldingTypeIndex = 1;
      } else {
        foldingType = 'triangle_fold';
        params.foldingTypeIndex = 2;
      }
    }

    // 生成勾股数（确保是整数勾股数）
    const pythagoreanPairs = [
      [3, 4], [5, 12], [8, 15], [7, 24], [6, 8], [9, 12], [5, 5],
      [5, 12], [8, 15], [9, 40], [11, 60], [12, 5],
    ];
    const pair = pythagoreanPairs[Math.floor(Math.random() * pythagoreanPairs.length)];
    params.a = pair[0];
    params.b = pair[1];

    params.level = level;

    return params;
  },

  buildSteps: (params: Record<string, number>) => {
    const foldingType: FoldingType =
      params.foldingTypeIndex === 2 ? 'triangle_fold' :
      params.foldingTypeIndex === 1 ? 'rectangle_fold' : 'right_triangle_fold';

    return [
      {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '根据折叠性质建立方程',
          inputTarget: '利用勾股定理建立等式',
          inputHint: '设未知量为x，建立勾股定理方程',
        },
      },
      {
        stepId: 's2',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '求解方程，得到答案',
          inputTarget: '所求线段长度',
          inputHint: '求解方程，保留三位小数',
        },
      },
    ];
  },

  render: (params: Record<string, number>) => {
    const { a, b } = params;
    const cSquared = a * a + b * b;
    const c = Math.sqrt(cSquared);

    const foldingType: FoldingType =
      params.foldingTypeIndex === 2 ? 'triangle_fold' :
      params.foldingTypeIndex === 1 ? 'rectangle_fold' : 'right_triangle_fold';

    let context: string;
    let title: string;

    switch (foldingType) {
      case 'right_triangle_fold':
        title = '直角三角形折叠问题';
        context = `直角三角形ABC中，∠C=90°，AC=${a}，BC=${b}。将点C沿AB边上的高翻折，使C落在斜边AB上点D处，求AD的距离（保留三位小数）`;
        break;
      case 'rectangle_fold':
        title = '矩形折叠问题';
        context = `矩形ABCD中，AB=${a}，BC=${b}。将点B沿折痕翻折到边AD上，恰好落在点E处，求折痕BE的长度（保留三位小数）`;
        break;
      case 'triangle_fold':
        title = '等腰三角形折叠问题';
        context = `等腰三角形ABC中，AB=AC=${c.toFixed(1)}，BC=${b}。将顶点A沿折痕翻折到边BC上，恰好落在点D处，求折痕AD的长度（保留三位小数）`;
        break;
    }

    return {
      title,
      description: '勾股定理折叠问题',
      context,
    };
  },
};
