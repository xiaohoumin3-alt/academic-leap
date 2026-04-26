/**
 * Explanation Generator Module
 *
 * Generates human-readable explanations for prediction results.
 */

export interface Explanation {
  primaryReason: string;           // 主要原因
  supportingFactors: string[];     // 支持因素
  confidence: number;              // 解释置信度
  caveats: string[];              // 注意事项
  metadata: {
    predictionProbability: number;
    predictionConfidence: number;
    studentAbility: number;
    questionDifficulty: number;
  };
}

export interface GenerateExplanationInput {
  predictionProbability: number;
  predictionConfidence: number;
  studentAbility: number;
  studentAbilityProfile: {
    overallAbility: number;
    abilities: Array<{ nodeId: string; ability: number; confidence: number }>;
    totalAnswers: number;
    recentCorrectRate: number;
  };
  questionFeatures: {
    difficulty: number;
    knowledgeNodes: string[];
  };
}

/**
 * Generate the primary reason explanation based on prediction probability,
 * student ability, and question difficulty.
 */
export function generatePrimaryReason(
  probability: number,
  ability: number,
  difficulty: number
): string {
  if (probability > 0.7) {
    if (ability > difficulty + 0.2) {
      return `学生能力(${ability.toFixed(2)})高于题目难度(${difficulty.toFixed(2)})，预测正确概率较高`;
    }
    return `基于历史表现，预测该生在此类题目上有较好的正确率`;
  } else if (probability < 0.4) {
    if (ability < difficulty - 0.1) {
      return `学生能力(${ability.toFixed(2)})低于题目难度(${difficulty.toFixed(2)})，预测正确概率较低`;
    }
    return `历史数据显示该生在此难度区间正确率不高`;
  }
  return `预测结果接近临界，需要更多数据`;
}

/**
 * Generate supporting factors based on student ability profile and question features.
 */
export function generateSupportingFactors(
  profile: {
    overallAbility: number;
    abilities: Array<{ nodeId: string; ability: number; confidence: number }>;
    totalAnswers: number;
    recentCorrectRate: number;
  },
  questionFeatures: { knowledgeNodes: string[] }
): string[] {
  const factors: string[] = [];

  // Sample size
  factors.push(`基于 ${profile.totalAnswers} 道题的历史数据`);

  // Recent trend
  const trend = profile.recentCorrectRate > 0.6 ? '上升' :
                profile.recentCorrectRate < 0.4 ? '下降' : '平稳';
  factors.push(`最近表现趋势：${trend}`);

  // Relevant knowledge nodes
  const relevantAbilities = profile.abilities.filter(a =>
    questionFeatures.knowledgeNodes.includes(a.nodeId)
  );
  if (relevantAbilities.length > 0) {
    const avgAbility = relevantAbilities.reduce((s, a) => s + a.ability, 0) / relevantAbilities.length;
    factors.push(`相关知识点平均能力：${(avgAbility * 100).toFixed(0)}%`);
  }

  return factors;
}

/**
 * Generate a comprehensive explanation for a prediction.
 */
export function generateExplanation(input: GenerateExplanationInput): Explanation {
  const {
    predictionProbability,
    predictionConfidence,
    studentAbility,
    studentAbilityProfile,
    questionFeatures
  } = input;

  // Generate primary reason
  const primaryReason = generatePrimaryReason(
    predictionProbability,
    studentAbility,
    questionFeatures.difficulty
  );

  // Generate supporting factors
  const supportingFactors = generateSupportingFactors(studentAbilityProfile, questionFeatures);

  // Generate disclaimers
  const caveats = [
    '能力估计基于统计相关性，不构成因果结论',
    '样本量较小时估计不稳定',
    '解释仅供参考，不影响预测决策'
  ];

  return {
    primaryReason,
    supportingFactors,
    confidence: predictionConfidence * studentAbilityProfile.overallAbility,
    caveats,
    metadata: {
      predictionProbability,
      predictionConfidence,
      studentAbility,
      questionDifficulty: questionFeatures.difficulty
    }
  };
}
