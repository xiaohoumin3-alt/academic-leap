/**
 * Ability Estimator Module
 * Layer 2 Explanation Service - Estimates student ability for knowledge nodes
 *
 * Uses IRT standard scale: [-2, 2]
 * Conversion: ability_irt = (correct_rate - 0.5) * 4
 */

export interface Answer {
  correct: boolean;
  timestamp: number;
  knowledgeNodes: string[];
}

export interface AbilityEstimate {
  nodeId: string;           // 知识点 ID
  ability: number;         // 能力值 [-2, 2] (IRT 标准尺度)
  sampleSize: number;       // 样本数
  lastUpdated: number;      // 更新时间
  confidence: number;       // 估计置信度
}

export interface StudentAbilityProfile {
  studentId: string;
  abilities: AbilityEstimate[];
  overallAbility: number;   // 整体能力 [-2, 2]
  totalAnswers: number;
  recentCorrectRate: number;
}

export interface EstimateAbilityOptions {
  decayHalfLifeDays?: number;
}

/**
 * Estimates ability for a specific knowledge node based on student answers
 * Returns ability in IRT scale [-2, 2]
 */
export function estimateAbility(
  answers: Answer[],
  nodeId: string,
  options: EstimateAbilityOptions = {}
): AbilityEstimate {
  const { decayHalfLifeDays = 30 } = options;

  const relevantAnswers = answers.filter((a) =>
    a.knowledgeNodes.includes(nodeId)
  );

  // Default ability: 0 (average) in IRT scale
  if (relevantAnswers.length < 3) {
    return {
      nodeId,
      ability: 0,
      sampleSize: relevantAnswers.length,
      lastUpdated: Date.now(),
      confidence: 0.1
    };
  }

  const now = Date.now();
  let weightedSum = 0;
  let weightSum = 0;

  for (const answer of relevantAnswers) {
    const ageDays = (now - answer.timestamp) / (24 * 60 * 60 * 1000);
    const weight = Math.exp(-ageDays / decayHalfLifeDays);
    weightedSum += (answer.correct ? 1 : 0) * weight;
    weightSum += weight;
  }

  // Convert to IRT scale [-2, 2]: (rate - 0.5) * 4
  const rawRate = weightSum > 0 ? weightedSum / weightSum : 0.5;
  const ability = (rawRate - 0.5) * 4;

  return {
    nodeId,
    ability: Math.max(-2, Math.min(2, ability)),
    sampleSize: relevantAnswers.length,
    lastUpdated: now,
    confidence: Math.min(0.9, relevantAnswers.length / 20)
  };
}

/**
 * Estimates abilities for all knowledge nodes touched by the student's answers
 * Returns overallAbility in IRT scale [-2, 2]
 */
export function estimateAllAbilities(
  answers: Answer[],
  studentId: string
): StudentAbilityProfile {
  const allNodes = new Set<string>();
  for (const answer of answers) {
    for (const node of answer.knowledgeNodes) {
      allNodes.add(node);
    }
  }

  const abilities = Array.from(allNodes).map((nodeId) =>
    estimateAbility(answers, nodeId)
  );

  // Weighted average in IRT scale
  const overallAbility = abilities.length > 0
    ? abilities.reduce((sum, a) => sum + a.ability * a.confidence, 0) /
      abilities.reduce((sum, a) => sum + a.confidence, 0)
    : 0;

  const recentAnswers = answers.slice(-20);
  const recentCorrectRate = recentAnswers.length > 0
    ? recentAnswers.filter((a) => a.correct).length / recentAnswers.length
    : 0.5;

  return {
    studentId,
    abilities,
    overallAbility,
    totalAnswers: answers.length,
    recentCorrectRate
  };
}
