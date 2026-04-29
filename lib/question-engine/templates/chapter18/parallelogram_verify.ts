/**
 * 平行四边形判定模板
 * 判定方法：
 * 1. 两组对边分别平行
 * 2. 两组对边分别相等
 * 3. 一组对边平行且相等
 * 4. 对角线互相平分
 */

import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

/**
 * 判定方法类型
 */
type VerifyMethod = 'both_parallel' | 'both_equal' | 'one_parallel_equal' | 'diagonals_bisect';

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

  buildSteps: (params): StepProtocolV2[] => {
    const isParallelogram = params.isParallelogram === 1;
    const method: VerifyMethod =
      params.method === 1 ? 'both_equal' :
      params.method === 2 ? 'one_parallel_equal' :
      params.method === 3 ? 'diagonals_bisect' : 'both_parallel';

    // 根据判定方法生成不同的步骤
    switch (method) {
      case 'both_parallel':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形有两组对边分别平行吗？',
              hint: '题目中AB∥CD，BC∥DA',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '两组对边分别平行',
              no: '对边不平行',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '满足"两组对边分别平行"这个判定条件吗？',
              hint: '平行四边形判定定理1：两组对边分别平行的四边形是平行四边形',
            },
            expectedAnswer: { type: 'yes_no', value: isParallelogram },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
        ];

      case 'both_equal':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形有两组对边分别相等吗？',
              hint: '题目中AB=CD，BC=DA',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '两组对边分别相等',
              no: '对边不相等',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '满足"两组对边分别相等"这个判定条件吗？',
              hint: '平行四边形判定定理2：两组对边分别相等的四边形是平行四边形',
            },
            expectedAnswer: { type: 'yes_no', value: isParallelogram },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
        ];

      case 'one_parallel_equal':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中有一组对边平行且相等吗？',
              hint: '题目中AB∥CD且AB=CD',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '有一组对边平行且相等',
              no: '没有满足条件的对边',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '满足"一组对边平行且相等"这个判定条件吗？',
              hint: '平行四边形判定定理3：一组对边平行且相等的四边形是平行四边形',
            },
            expectedAnswer: { type: 'yes_no', value: isParallelogram },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
        ];

      case 'diagonals_bisect':
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形对角线互相平分吗？',
              hint: '题目中对角线AC和BD互相平分',
            },
            expectedAnswer: { type: 'yes_no', value: true },
            options: {
              yes: '对角线互相平分',
              no: '对角线不互相平分',
            },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '满足"对角线互相平分"这个判定条件吗？',
              hint: '平行四边形判定定理4：对角线互相平分的四边形是平行四边形',
            },
            expectedAnswer: { type: 'yes_no', value: isParallelogram },
            options: {
              yes: '是平行四边形',
              no: '不是平行四边形',
            },
          },
        ];

      default:
        return [];
    }
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
