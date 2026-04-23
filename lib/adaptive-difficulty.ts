/**
 * 自适应难度系统
 * 根据用户答题表现动态调整题目难度
 */

/**
 * 帮助强度级别
 * L0: 完全独立完成
 * L1: 使用了提示
 * L2: 使用了步骤辅助
 */
export type HelpLevel = 'L0' | 'L1' | 'L2';

export interface HelpUsage {
  level: HelpLevel;
  hintUsed: boolean;
  stepUsed: boolean;
  timeToFirstHint: number | null;  // 毫秒
  retryCount: number;
}

export interface DifficultyConfig {
  level: number;        // 当前难度等级 1-5
  consecutiveCorrect: number;  // 连续正确次数
  consecutiveWrong: number;    // 连续错误次数
  recentAccuracy: number;      // 最近准确率
  totalAnswered: number;       // 总答题数
}

export interface DifficultyAdjustment {
  newLevel: number;
  reason: string;
  shouldAdjust: boolean;
}

/**
 * 难度调整规则
 */
const DIFFICULTY_RULES = {
  // 提升难度条件
  promote: {
    minConsecutiveCorrect: 3,  // 连续正确3题
    minRecentAccuracy: 0.8,    // 最近准确率80%
    minTotalAnswered: 5,       // 至少答5题
  },
  // 降低难度条件
  demote: {
    maxConsecutiveWrong: 2,    // 连续错误2题
    maxRecentAccuracy: 0.4,    // 最近准确率低于40%
    minTotalAnswered: 5,       // 至少答5题
  },
};

/**
 * 计算是否需要调整难度
 */
export function calculateDifficultyAdjustment(
  config: DifficultyConfig,
  isCorrect: boolean
): DifficultyAdjustment {
  const { level, consecutiveCorrect, consecutiveWrong, recentAccuracy, totalAnswered } = config;

  // 初始化状态
  let newConsecutiveCorrect = isCorrect ? consecutiveCorrect + 1 : 0;
  let newConsecutiveWrong = !isCorrect ? consecutiveWrong + 1 : 0;
  let newTotalAnswered = totalAnswered + 1;
  let newRecentAccuracy = recentAccuracy;

  // 更新最近准确率（简单移动平均）
  if (newTotalAnswered > 0) {
    newRecentAccuracy = (recentAccuracy * totalAnswered + (isCorrect ? 1 : 0)) / newTotalAnswered;
  }

  // 检查是否应该提升难度
  if (
    level < 5 &&
    newConsecutiveCorrect >= DIFFICULTY_RULES.promote.minConsecutiveCorrect &&
    newRecentAccuracy >= DIFFICULTY_RULES.promote.minRecentAccuracy &&
    newTotalAnswered >= DIFFICULTY_RULES.promote.minTotalAnswered
  ) {
    return {
      newLevel: level + 1,
      reason: `连续答对${newConsecutiveCorrect}题，准确率${Math.round(newRecentAccuracy * 100)}%，提升难度！`,
      shouldAdjust: true,
    };
  }

  // 检查是否应该降低难度
  if (
    level > 1 &&
    newConsecutiveWrong >= DIFFICULTY_RULES.demote.maxConsecutiveWrong &&
    newRecentAccuracy <= DIFFICULTY_RULES.demote.maxRecentAccuracy &&
    newTotalAnswered >= DIFFICULTY_RULES.demote.minTotalAnswered
  ) {
    return {
      newLevel: level - 1,
      reason: `连续答错${newConsecutiveWrong}题，准确率${Math.round(newRecentAccuracy * 100)}%，降低难度以巩固基础`,
      shouldAdjust: true,
    };
  }

  // 不需要调整
  return {
    newLevel: level,
    reason: '',
    shouldAdjust: false,
  };
}

/**
 * 获取难度描述
 */
export function getDifficultyDescription(level: number): string {
  const descriptions = {
    1: '入门 - 基础练习',
    2: '简单 - 逐步提升',
    3: '中等 - 正式挑战',
    4: '困难 - 综合运用',
    5: '专家 - 极限挑战',
  };
  return descriptions[level as keyof typeof descriptions] || '中等';
}

/**
 * 根据难度获取知识点推荐
 */
export function getKnowledgePointsByDifficulty(
  difficulty: number,
  subject: 'calculation' | 'geometry' | 'algebra'
): string[] {
  const knowledgeMap: Record<number, Record<string, string[]>> = {
    1: {
      calculation: ['整数加减法', '简单乘法', '基础除法'],
      geometry: ['图形识别', '周长计算', '面积入门'],
      algebra: ['简单方程', '代数式化简', '正负数运算'],
    },
    2: {
      calculation: ['分数加减法', '小数运算', '混合运算'],
      geometry: ['三角形面积', '平行四边形', '组合图形'],
      algebra: ['一元一次方程', '不等式入门', '因式分解'],
    },
    3: {
      calculation: ['分数乘除法', '百分数运算', '复杂混合运算'],
      geometry: ['圆的面积', '体积计算', '相似图形'],
      algebra: ['方程组', '二次方程', '函数入门'],
    },
    4: {
      calculation: ['根式运算', '指数运算', '复杂分数运算'],
      geometry: ['勾股定理', '三角函数', '立体几何'],
      algebra: ['函数与方程', '不等式组', '解析几何'],
    },
    5: {
      calculation: ['复数运算', '矩阵运算', '微积分预备'],
      geometry: ['向量运算', '空间解析几何', '立体几何综合'],
      algebra: ['高次方程', '数列与极限', '综合应用'],
    },
  };

  return knowledgeMap[difficulty]?.[subject] || knowledgeMap[3][subject];
}

/**
 * 计算行为标签
 */
export function calculateBehaviorTag(duration: number, isCorrect: boolean): string {
  if (!isCorrect) return '错误';
  if (duration < 5000) return '秒解';
  if (duration < 10000) return '流畅';
  if (duration < 20000) return '稳住';
  return '偏慢';
}

/**
 * 自适应难度系统Hook（React版本）
 */
export interface AdaptiveDifficultyState {
  level: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  recentAccuracy: number;
  totalAnswered: number;
  adjustmentHistory: Array<{
    timestamp: number;
    fromLevel: number;
    toLevel: number;
    reason: string;
  }>;
}

export function createAdaptiveDifficultySystem(
  initialState: Partial<AdaptiveDifficultyState> = {}
) {
  const state: AdaptiveDifficultyState = {
    level: initialState.level ?? 2,
    consecutiveCorrect: initialState.consecutiveCorrect ?? 0,
    consecutiveWrong: initialState.consecutiveWrong ?? 0,
    recentAccuracy: initialState.recentAccuracy ?? 0.5,
    totalAnswered: initialState.totalAnswered ?? 0,
    adjustmentHistory: initialState.adjustmentHistory ?? [],
  };

  return {
    getState: () => state,

    recordAnswer: (isCorrect: boolean, duration: number) => {
      const adjustment = calculateDifficultyAdjustment(state, isCorrect);

      // 更新状态
      if (isCorrect) {
        state.consecutiveCorrect++;
        state.consecutiveWrong = 0;
      } else {
        state.consecutiveWrong++;
        state.consecutiveCorrect = 0;
      }

      state.totalAnswered++;
      state.recentAccuracy = (state.recentAccuracy * (state.totalAnswered - 1) + (isCorrect ? 1 : 0)) / state.totalAnswered;

      // 应用难度调整
      if (adjustment.shouldAdjust) {
        state.adjustmentHistory.push({
          timestamp: Date.now(),
          fromLevel: state.level,
          toLevel: adjustment.newLevel,
          reason: adjustment.reason,
        });
        state.level = adjustment.newLevel;
        state.consecutiveCorrect = 0;
        state.consecutiveWrong = 0;
      }

      return {
        behaviorTag: calculateBehaviorTag(duration, isCorrect),
        adjustment: adjustment.shouldAdjust ? adjustment : null,
        currentState: { ...state },
      };
    },

    reset: () => {
      state.level = 2;
      state.consecutiveCorrect = 0;
      state.consecutiveWrong = 0;
      state.recentAccuracy = 0.5;
      state.totalAnswered = 0;
      state.adjustmentHistory = [];
    },

    setLevel: (newLevel: number) => {
      if (newLevel >= 1 && newLevel <= 5) {
        state.level = newLevel;
      }
    },
  };
}

/**
 * 独立性评估系统：根据帮助使用情况计算得分
 */
export interface ScoreCalculation {
  finalScore: number;
  breakdown: {
    baseScore: number;
    hintPenalty: number;
    stepPenalty: number;
    retryPenalty: number;
  };
  independenceLabel: string;
  independenceEmoji: string;
}

/**
 * 计算独立性得分
 * @param baseScore 基础分（通常100）
 * @param helpUsage 帮助使用情况
 * @param retryCount 重试次数
 */
export function calculateIndependenceScore(
  baseScore: number = 100,
  helpUsage: HelpUsage,
  retryCount: number = 0
): ScoreCalculation {
  const hintPenalty = helpUsage.hintUsed ? 15 : 0;
  const stepPenalty = helpUsage.stepUsed ? 30 : 0;
  const retryPenalty = retryCount * 10;

  const finalScore = Math.max(0, baseScore - hintPenalty - stepPenalty - retryPenalty);

  // 确定独立性标签
  let independenceLabel = '独立完成';
  let independenceEmoji = '🟢';

  if (helpUsage.stepUsed) {
    independenceLabel = '步骤辅助';
    independenceEmoji = '🔴';
  } else if (helpUsage.hintUsed) {
    independenceLabel = '提示辅助';
    independenceEmoji = '🟡';
  }

  return {
    finalScore,
    breakdown: {
      baseScore,
      hintPenalty,
      stepPenalty,
      retryPenalty,
    },
    independenceLabel,
    independenceEmoji,
  };
}

/**
 * 根据帮助使用情况确定帮助级别
 */
export function determineHelpLevel(
  hintUsed: boolean,
  stepUsed: boolean
): HelpLevel {
  if (stepUsed) return 'L2';
  if (hintUsed) return 'L1';
  return 'L0';
}

/**
 * 获取独立性描述
 */
export function getIndependenceDescription(level: HelpLevel): string {
  const descriptions = {
    'L0': '完全独立完成，展现了扎实的知识掌握',
    'L1': '在提示下完成，建议加强练习以提高独立性',
    'L2': '需要步骤辅助，建议回顾基础知识',
  };
  return descriptions[level];
}
