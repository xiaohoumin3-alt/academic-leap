/**
 * 学力跃迁核心算法
 * 包含等效分计算、知识点等级判定、推荐难度计算
 */

export interface AnswerRecord {
  knowledgePointId: string;
  knowledgePointName: string;
  isCorrect: boolean;
  duration?: number;
}

export interface KnowledgePointInfo {
  id: string;
  name: string;
  weight: number;
}

export interface KnowledgeLevelEntry {
  id: string;
  name: string;
  level: number;
}

export interface ScoreResult {
  score: number;
  range: [number, number];
  knowledgeLevels: Record<string, KnowledgeLevelEntry>; // ID -> { id, name, level }
}

export interface KnowledgeMastery {
  knowledgePointId: string;
  knowledgePointName: string;
  mastery: number; // 0-1
  correctCount: number;
  totalCount: number;
  level: number; // 0-4
}

/**
 * 计算考试等效分
 * 算法：预估分 = Σ(实测知识点分值 × 知识点掌握率) - 波动修正分(2-5分)
 *
 * 关键改进：
 * 1. 只基于实测知识点计算分数（不再把未测知识点算0%）
 * 2. 未测知识点标记为 L-1（未测试），不参与分数计算
 * 3. 对于有多个知识点的题目，答题结果计入所有相关知识点
 * 4. 使用知识点 ID 作为主键存储知识等级数据
 *
 * @param answers 答题记录（每条记录应包含该题覆盖的所有知识点）
 * @param knowledgePoints 知识点列表（含 ID 和权重）
 * @returns 等效分和波动区间
 */
export function calculateEquivalentScore(
  answers: AnswerRecord[],
  knowledgePoints: KnowledgePointInfo[]
): ScoreResult {
  // Handle empty answers
  if (answers.length === 0) {
    return {
      score: 0,
      range: [0, 0] as [number, number],
      knowledgeLevels: {},
    };
  }

  // 构建 name -> KnowledgePointInfo 映射
  const kpNameToInfo = new Map<string, KnowledgePointInfo>();
  for (const kp of knowledgePoints) {
    kpNameToInfo.set(kp.name, kp);
  }

  // 构建 ID -> KnowledgePointInfo 映射
  const kpIdToInfo = new Map<string, KnowledgePointInfo>();
  for (const kp of knowledgePoints) {
    kpIdToInfo.set(kp.id, kp);
  }

  // 获取实际被测试到的知识点名称（从答题记录中提取）
  const testedKpNames = new Set<string>(answers.map(a => a.knowledgePointName));
  const testedKpNamesArray = Array.from(testedKpNames);

  // 计算每个实测知识点的掌握率和等级
  const knowledgeMasteries: Record<string, KnowledgeMastery> = {};

  for (const kpName of testedKpNamesArray) {
    const kpAnswers = answers.filter(a => a.knowledgePointName === kpName);
    const totalCount = kpAnswers.length;
    const correctCount = kpAnswers.filter(a => a.isCorrect).length;
    const mastery = totalCount > 0 ? correctCount / totalCount : 0;

    // 尝试获取知识点 ID
    const kpInfo = kpNameToInfo.get(kpName);
    const kpId = kpInfo?.id ?? kpName; // 如果找不到，用名称作为 fallback

    knowledgeMasteries[kpId] = {
      knowledgePointId: kpId,
      knowledgePointName: kpName,
      mastery,
      correctCount,
      totalCount,
      level: getKnowledgeLevel(mastery),
    };
  }

  // 只基于实测知识点计算分数
  const testedKnowledgePoints = knowledgePoints.filter(kp => testedKpNames.has(kp.name));

  // 如果没有实测知识点（不应该发生），返回0
  if (testedKnowledgePoints.length === 0) {
    return {
      score: 0,
      range: [0, 0] as [number, number],
      knowledgeLevels: {},
    };
  }

  // 计算加权总分（只基于实测知识点）
  let totalWeightedScore = 0;
  const totalWeights = testedKnowledgePoints.reduce((sum, kp) => sum + kp.weight, 0);

  // 当总权重为0时（所有权重未设置），使用均匀分布
  const useEqualWeight = totalWeights === 0;
  const equalWeight = useEqualWeight ? 1.0 / testedKnowledgePoints.length : 0;

  for (const kp of testedKnowledgePoints) {
    const mastery = knowledgeMasteries[kp.id]?.mastery ?? 0;
    const normalizedWeight = useEqualWeight ? equalWeight : kp.weight / totalWeights;
    totalWeightedScore += normalizedWeight * mastery * 100;
  }

  // 波动修正（2-5分，根据答题稳定度）
  const volatility = calculateVolatility(answers);
  const baseScore = Math.max(0, Math.min(100, totalWeightedScore - volatility));

  // 波动区间±3分
  const rangeLow = Math.max(0, Math.round(baseScore - 3));
  const rangeHigh = Math.min(100, Math.round(baseScore + 3));

  // 提取知识点等级（使用 ID 作为主键）
  const knowledgeLevels: Record<string, KnowledgeLevelEntry> = {};
  for (const [kpId, data] of Object.entries(knowledgeMasteries)) {
    const kpInfo = kpIdToInfo.get(kpId);
    knowledgeLevels[kpId] = {
      id: kpId,
      name: kpInfo?.name ?? data.knowledgePointName,
      level: data.level,
    };
  }

  return {
    score: Math.round(baseScore),
    range: [rangeLow, rangeHigh],
    knowledgeLevels,
  };
}

/**
 * 计算波动修正分
 * 根据答题的稳定性和一致性计算修正值（2-5分）
 */
function calculateVolatility(answers: AnswerRecord[]): number {
  if (answers.length === 0) return 2;

  // 计算答题时长的标准差（反映答题稳定性）
  const durations = answers
    .map(a => a.duration)
    .filter((d): d is number => d !== undefined);

  if (durations.length < 2) return 2;

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  // 标准差越大，波动修正越大
  if (stdDev > 30000) return 5; // 答题时间差异大，不稳定
  if (stdDev > 15000) return 4;
  if (stdDev > 8000) return 3;
  return 2; // 答题时间稳定
}

/**
 * 计算知识点能力等级
 * Level0: 40%, Level1: 70%, Level2: 90%, Level3: 100%, Level4: 100%+拓展
 *
 * @param mastery 掌握率 (0-1)
 * @returns 能力等级 (0-4)
 */
export function getKnowledgeLevel(mastery: number): number {
  if (mastery < 0.4) return 0;
  if (mastery < 0.7) return 1;
  if (mastery < 0.9) return 2;
  if (mastery < 1.0) return 3;
  return 4;
}

/**
 * 获取等级名称
 */
export function getLevelName(level: number): string {
  const names = ['L0', 'L1', 'L2', 'L3', 'L4'];
  return names[level] ?? 'L0';
}

/**
 * 计算推荐难度倍数
 * 默认推送 当前等级+1（约+4%-8%难度）
 *
 * @param currentLevel 当前能力等级
 * @returns 推荐难度倍数
 */
export function getRecommendedDifficulty(currentLevel: number): {
  recommendedLevel: number;
  difficultyMultiplier: number;
} {
  // 推荐等级为当前等级+1，最高不超过4
  const recommendedLevel = Math.min(4, currentLevel + 1);

  // 难度倍数：等级越高，提升幅度越小
  const baseMultiplier = 1.04;
  const maxMultiplier = 1.08;

  const levelFactor = Math.max(0, 4 - currentLevel) / 4;
  const difficultyMultiplier = baseMultiplier + (maxMultiplier - baseMultiplier) * levelFactor;

  return {
    recommendedLevel,
    difficultyMultiplier,
  };
}

/**
 * 计算用户平均能力等级
 */
export function calculateAverageLevel(knowledgeMasteries: KnowledgeMastery[]): number {
  if (knowledgeMasteries.length === 0) return 0;

  const totalLevel = knowledgeMasteries.reduce((sum, km) => sum + km.level, 0);
  return totalLevel / knowledgeMasteries.length;
}

/**
 * 判断是否应该提升知识点等级
 * 规则：连续答对2题 → 等级+1
 */
export function shouldUpgradeLevel(correctStreak: number): boolean {
  return correctStreak >= 2;
}

/**
 * 判断是否应该降低知识点等级
 * 规则：答错1题 → 不降级，不惩罚（只记录）
 * 粗心错误（步骤对、结果错）→ 不调整难度
 */
export function shouldDowngradeLevel(isCarelessError: boolean): boolean {
  return false; // 永不降级，符合产品"失败安全化"理念
}

/**
 * 检查是否满足一轮复习完成条件
 * 1. 本学期必考知识点100%覆盖训练
 * 2. 单个知识点至少完成2道适配难度题目
 * 3. 所有错题完成订正重试
 */
export interface ReviewEligibilityCheck {
  eligible: boolean;
  progress: {
    knowledgeCoverage: number; // 知识点覆盖百分比
    totalRequired: number; // 需要完成的题目数
    totalCompleted: number; // 已完成的题目数
    allErrorsFixed: boolean; // 是否所有错题已订正
  };
  remainingTasks: string[];
}

export function checkReviewEligibility(
  knowledgePoints: KnowledgePointInfo[],
  userKnowledge: Map<string, { practiceCount: number; hasErrors: boolean }>
): ReviewEligibilityCheck {
  const totalKnowledgePoints = knowledgePoints.length;
  let coveredKnowledgePoints = 0;
  let totalRequiredQuestions = 0;
  let totalCompletedQuestions = 0;
  let allErrorsFixed = true;
  const remainingTasks: string[] = [];

  for (const kp of knowledgePoints) {
    const uk = userKnowledge.get(kp.name);
    const practiceCount = uk?.practiceCount ?? 0;
    const hasErrors = uk?.hasErrors ?? false;

    // 检查知识点覆盖
    if (practiceCount >= 2) {
      coveredKnowledgePoints++;
    }

    // 检查错题订正
    if (hasErrors) {
      allErrorsFixed = false;
      remainingTasks.push(`订正【${kp.name}】的错题`);
    }

    totalRequiredQuestions += 2; // 每个知识点至少2道题
    totalCompletedQuestions += practiceCount;
  }

  const knowledgeCoverage = Math.round(
    (coveredKnowledgePoints / totalKnowledgePoints) * 100
  );

  // 检查是否满足条件
  const eligible =
    knowledgeCoverage === 100 && totalCompletedQuestions >= totalRequiredQuestions && allErrorsFixed;

  if (knowledgeCoverage < 100) {
    remainingTasks.push(`完成剩余${totalKnowledgePoints - coveredKnowledgePoints}个知识点的练习`);
  }

  if (totalCompletedQuestions < totalRequiredQuestions) {
    remainingTasks.push(
      `完成更多练习题（还需${totalRequiredQuestions - totalCompletedQuestions}题）`
    );
  }

  return {
    eligible,
    progress: {
      knowledgeCoverage,
      totalRequired: totalRequiredQuestions,
      totalCompleted: totalCompletedQuestions,
      allErrorsFixed,
    },
    remainingTasks,
  };
}

/**
 * 计算提分明细
 */
export interface ImprovementReport {
  initialScore: number;
  reviewScore: number;
  improvement: number;
  knowledgeProgress: Array<{
    name: string;
    initialLevel: number;
    reviewLevel: number;
    improvement: number;
  }>;
}

export function calculateImprovement(
  initialAssessment: ScoreResult,
  reviewAssessment: ScoreResult
): ImprovementReport {
  const improvement = reviewAssessment.score - initialAssessment.score;

  const knowledgeProgress: ImprovementReport['knowledgeProgress'] = [];

  for (const [kpId, initialData] of Object.entries(initialAssessment.knowledgeLevels)) {
    const reviewData = reviewAssessment.knowledgeLevels[kpId];
    const reviewLevel = reviewData?.level ?? initialData.level;
    knowledgeProgress.push({
      name: initialData.name,
      initialLevel: initialData.level,
      reviewLevel,
      improvement: reviewLevel - initialData.level,
    });
  }

  return {
    initialScore: initialAssessment.score,
    reviewScore: reviewAssessment.score,
    improvement,
    knowledgeProgress,
  };
}
