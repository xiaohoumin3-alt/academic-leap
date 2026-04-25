/**
 * 平行四边形判定模板
 * 判定方法：
 * 1. 两组对边分别平行
 * 2. 两组对边分别相等
 * 3. 一组对边平行且相等
 * 4. 对角线互相平分
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
 * 判定方法类型
 */
type VerifyMethod = 'both_parallel' | 'both_equal' | 'one_parallel_equal' | 'diagonals_bisect';

/**
 * 生成四边形边长信息
 */
function generateQuadrilateralData(
  method: VerifyMethod,
  params: Record<string, number>
): {
  sideAB: number;
  sideBC: number;
  sideCD: number;
  sideDA: number;
  isParallelogram: boolean;
  method: VerifyMethod;
  description: string;
} {
  switch (method) {
    case 'both_parallel':
      // 两组对边分别平行（经典平行四边形）
      return {
        sideAB: params.side1,
        sideBC: params.side2,
        sideCD: params.side1,  // AB = CD
        sideDA: params.side2,  // BC = DA
        isParallelogram: true,
        method: 'both_parallel',
        description: '两组对边分别平行',
      };

    case 'both_equal':
      // 两组对边分别相等
      return {
        sideAB: params.side1,
        sideBC: params.side2,
        sideCD: params.side1,  // AB = CD
        sideDA: params.side2,   // BC = DA
        isParallelogram: true,
        method: 'both_equal',
        description: '两组对边分别相等',
      };

    case 'one_parallel_equal':
      // 一组对边平行且相等
      return {
        sideAB: params.side1,
        sideBC: params.side2,
        sideCD: params.side1,  // AB = CD 且平行
        sideDA: params.side2,
        isParallelogram: true,
        method: 'one_parallel_equal',
        description: '一组对边平行且相等',
      };

    case 'diagonals_bisect':
      // 对角线互相平分
      return {
        sideAB: params.side1,
        sideBC: params.side2,
        sideCD: params.side1,
        sideDA: params.side2,
        isParallelogram: true,
        method: 'diagonals_bisect',
        description: '对角线互相平分',
      };

    default:
      return {
        sideAB: params.side1,
        sideBC: params.side2,
        sideCD: params.side1,
        sideDA: params.side2,
        isParallelogram: true,
        method: 'both_parallel',
        description: '两组对边分别平行',
      };
  }
}

/**
 * 生成非平行四边形数据（用于干扰项）
 */
function generateNonParallelogram(
  params: Record<string, number>
): {
  sideAB: number;
  sideBC: number;
  sideCD: number;
  sideDA: number;
  isParallelogram: boolean;
  description: string;
} {
  return {
    sideAB: params.side1,
    sideBC: params.side2,
    sideCD: params.side3,
    sideDA: params.side4,
    isParallelogram: false,
    description: '四边不相等或对边不平行',
  };
}

/**
 * 平行四边形判定模板
 */
export const ParallelogramVerifyTemplate: QuestionTemplate = {
  id: 'parallelogram_verify',
  knowledgePoint: 'parallelogram_verify',

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.parallelogram_verify[level] ||
                   DIFFICULTY_CONFIG.parallelogram_verify[1];

    const params = generateRandomParams(config);

    // 确定判定方法类型
    let method: VerifyMethod;
    if (level <= 2) {
      // 基础：只用"两组对边分别平行"
      method = 'both_parallel';
      params.method = 0;
    } else if (level <= 3) {
      // 中等：增加"两组对边分别相等"
      const rand = Math.random();
      if (rand < 0.5) method = 'both_parallel';
      else method = 'both_equal';
      params.method = method === 'both_parallel' ? 0 : 1;
    } else {
      // 高级：包含所有判定方法
      const rand = Math.random();
      if (rand < 0.25) method = 'both_parallel';
      else if (rand < 0.5) method = 'both_equal';
      else if (rand < 0.75) method = 'one_parallel_equal';
      else method = 'diagonals_bisect';
      params.method = method === 'both_parallel' ? 0 :
                       method === 'both_equal' ? 1 :
                       method === 'one_parallel_equal' ? 2 : 3;
    }

    // 决定是否生成平行四边形或非平行四边形
    // 高难度时包含一些非平行四边形的题目
    if (level >= 4 && Math.random() < 0.3) {
      // 生成非平行四边形
      params.side1 = params.sideAB;
      params.side2 = params.sideBC;
      params.side3 = params.sideCD;
      params.side4 = params.sideDA;
      params.isParallelogram = 0;
    } else {
      // 生成平行四边形
      params.isParallelogram = 1;
    }

    params.level = level;

    return params;
  },

  buildSteps: (params) => {
    const isParallelogram = params.isParallelogram === 1;

    return [
      {
        stepId: 's1',
        type: StepType.VERIFY_PARALLELOGRAM,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0,
        ui: {
          instruction: '识别题目中给出的条件',
          inputTarget: '条件类型',
          inputHint: '输入数字：0=两组对边平行，1=两组对边相等，2=一对边平行相等，3=对角线平分',
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
          instruction: '应用平行四边形判定定理进行判断',
          inputTarget: '判定依据',
          inputHint: '根据条件选择判定方法',
        },
      },
      {
        stepId: 's3',
        type: StepType.VERIFY_PARALLELOGRAM,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0,
        ui: {
          instruction: '得出结论：是否为平行四边形',
          inputTarget: '结论',
          inputHint: '是平行四边形输入1，不是输入0',
        },
      },
    ];
  },

  render: (params) => {
    const isParallelogram = params.isParallelogram === 1;
    const method: VerifyMethod =
      params.method === 1 ? 'both_equal' :
      params.method === 2 ? 'one_parallel_equal' :
      params.method === 3 ? 'diagonals_bisect' : 'both_parallel';

    let context: string;
    if (isParallelogram) {
      switch (method) {
        case 'both_parallel':
          context = `四边形ABCD中，AB∥CD，BC∥DA，判断是否为平行四边形`;
          break;
        case 'both_equal':
          context = `四边形ABCD中，AB=CD，BC=DA，判断是否为平行四边形`;
          break;
        case 'one_parallel_equal':
          context = `四边形ABCD中，AB∥CD且AB=CD，判断是否为平行四边形`;
          break;
        case 'diagonals_bisect':
          context = `四边形ABCD中，对角线AC和BD互相平分，判断是否为平行四边形`;
          break;
        default:
          context = `四边形ABCD中，AB∥CD，BC∥DA，判断是否为平行四边形`;
      }
    } else {
      context = `四边形ABCD中，四边分别为${params.side1}、${params.side2}、${params.side3}、${params.side4}，判断是否为平行四边形`;
    }

    return {
      title: '平行四边形判定',
      description: '利用平行四边形判定定理进行判断',
      context,
    };
  },
};
