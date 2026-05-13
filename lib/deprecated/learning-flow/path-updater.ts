/**
 * Learning Flow Path Updater
 *
 * 实现动态路径更新逻辑，根据学生答题表现实时调整学习路径。
 *
 * 核心功能：
 * 1. 答题后更新路径状态
 * 2. 重新计算知识点掌握度
 * 3. 调整后续题目难度
 * 4. 确定下一个学习点
 */

import { prisma } from '@/lib/prisma';
import { estimateAbilityEAP, deltaCToDifficulty, thetaToDeltaC, type IRTResponse } from '@/lib/rl/irt/estimator';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

// ============================================================================
// Types
// ============================================================================

export interface AnswerRecord {
  questionId: string;
  knowledgePointId: string;
  isCorrect: boolean;
  deltaC: number; // 题目难度 [0, 10]
  duration?: number; // 答题时长（毫秒）
  timestamp: Date;
}

export interface MasteryState {
  knowledgePointId: string;
  mastery: number; // 0-1
  attempts: number;
  correctCount: number;
  recentPerformance: number[]; // 最近10次表现，1=正确，0=错误
  consecutiveCorrect: number;
  consecutiveWrong: number;
  lastAttemptAt?: Date;
}

export interface PathUpdateResult {
  updatedMastery: Map<string, number>;
  nextKnowledgePoint?: string;
  recommendedDifficulty: number;
  reason: string;
}

export interface DifficultyAdjustmentResult {
  newDifficulty: number;
  oldDifficulty: number;
  reason: string;
}

export interface UpdatePathOptions {
  pathId: string;
  userId: string;
  answer: AnswerRecord;
  currentDifficulty?: number;
}

// ============================================================================
// Constants
// ============================================================================

const MASTERY_DECAY = 0.05; // 每次答题的掌握度衰减因子
const MASTERY_GAIN_CORRECT = 0.15; // 正确答题的掌握度增益
const MASTERY_LOSS_WRONG = 0.1; // 错误答题的掌握度损失

const RECENT_PERFORMANCE_WINDOW = 10; // 保留最近N次表现记录

const CONSECUTIVE_CORRECT_THRESHOLD = 3; // 连续正确N次可跳过
const CONSECUTIVE_WRONG_THRESHOLD = 2; // 连续错误N次需要复习

const MASTERY_THRESHOLD_LEARNED = 0.8; // 掌握度达到此值视为已学会
const MASTERY_THRESHOLD_STRUGGLING = 0.4; // 掌握度低于此值需要额外关注

const DIFFICULTY_ADJUSTMENT = {
  MIN_CONSECUTIVE_CORRECT: 3, // 连续正确3题提升难度
  MIN_CONSECUTIVE_WRONG: 2, // 连续错误2题降低难度
  MIN_RECENT_ACCURACY: 0.7, // 最近准确率70%
  STEP: 1, // 难度调整步长
};

// ============================================================================
// Main Export: Update Path After Answer
// ============================================================================

/**
 * 答题后更新路径
 *
 * 核心流程：
 * 1. 获取当前路径状态
 * 2. 更新知识点掌握度
 * 3. 更新IRT能力估计
 * 4. 调整题目难度
 * 5. 确定下一个学习点
 * 6. 持久化更新结果
 */
export async function updatePathAfterAnswer(
  options: UpdatePathOptions
): Promise<PathUpdateResult> {
  const { pathId, userId, answer, currentDifficulty = 5 } = options;

  // Step 1: 获取当前路径和掌握度状态
  const path = await getCurrentPath(pathId);
  const masteryStates = await getMasteryStates(userId);

  // Step 2: 更新该知识点的掌握度
  const updatedMastery = await recalculateMastery(
    masteryStates,
    answer.knowledgePointId,
    answer.isCorrect
  );

  // Step 3: 更新IRT能力估计
  const irtState = await updateIRTAbility(userId, answer);

  // Step 4: 调整后续题目难度
  const difficultyResult = await adjustDifficulty(
    currentDifficulty,
    updatedMastery.get(answer.knowledgePointId) || 0.5,
    answer.isCorrect,
    irtState.theta
  );

  // Step 5: 确定下一个学习点
  const nextPoint = await getNextKnowledgePoint(
    path,
    updatedMastery,
    answer.knowledgePointId
  );

  // Step 6: 持久化更新
  await persistPathUpdate(pathId, userId, {
    answer,
    masteryStates: updatedMastery,
    irtState,
    difficultyResult,
  });

  // 构建更新原因
  const reason = buildUpdateReason(
    answer,
    updatedMastery.get(answer.knowledgePointId) || 0.5,
    difficultyResult,
    nextPoint
  );

  return {
    updatedMastery,
    nextKnowledgePoint: nextPoint?.nodeId,
    recommendedDifficulty: difficultyResult.newDifficulty,
    reason,
  };
}

// ============================================================================
// Mastery Calculation
// ============================================================================

/**
 * 重新计算知识点掌握度
 *
 * 规则：
 * - 正确答案 → 提高掌握度
 * - 错误答案 → 降低掌握度
 * - 使用指数移动平均平滑变化
 * - 连续正确/错误有额外加成/惩罚
 */
export async function recalculateMastery(
  currentStates: Map<string, MasteryState>,
  knowledgePointId: string,
  isCorrect: boolean
): Promise<Map<string, number>> {
  const updatedMastery = new Map<string, number>();

  // 获取或初始化该知识点状态
  const currentState = currentStates.get(knowledgePointId) || {
    knowledgePointId,
    mastery: 0.5,
    attempts: 0,
    correctCount: 0,
    recentPerformance: [],
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
  };

  // 更新状态
  currentState.attempts++;
  currentState.recentPerformance.push(isCorrect ? 1 : 0);
  currentState.lastAttemptAt = new Date();

  // 保留最近N次表现
  if (currentState.recentPerformance.length > RECENT_PERFORMANCE_WINDOW) {
    currentState.recentPerformance.shift();
  }

  // 更新连续计数
  if (isCorrect) {
    currentState.correctCount++;
    currentState.consecutiveCorrect++;
    currentState.consecutiveWrong = 0;
  } else {
    currentState.consecutiveWrong++;
    currentState.consecutiveCorrect = 0;
  }

  // 计算基础掌握度（基于历史表现的指数移动平均）
  const recentAvg =
    currentState.recentPerformance.reduce((a, b) => a + b, 0) /
    currentState.recentPerformance.length;

  // 应用增益/损失
  let newMastery: number;
  if (isCorrect) {
    // 连续正确加成
    const consecutiveBonus = Math.min(0.1, currentState.consecutiveCorrect * 0.02);
    newMastery = currentState.mastery * (1 - MASTERY_DECAY) + MASTERY_GAIN_CORRECT + consecutiveBonus;
  } else {
    // 连续错误惩罚
    const consecutivePenalty = Math.min(0.15, currentState.consecutiveWrong * 0.05);
    newMastery = currentState.mastery * (1 - MASTERY_DECAY) - MASTERY_LOSS_WRONG - consecutivePenalty;
  }

  // 混合历史平均和即时表现
  newMastery = newMastery * 0.6 + recentAvg * 0.4;

  // 限制在 [0, 1] 范围内
  newMastery = Math.max(0, Math.min(1, newMastery));
  currentState.mastery = newMastery;

  // 更新所有知识点的掌握度
  for (const [id, state] of currentStates) {
    updatedMastery.set(id, state.mastery);
  }
  updatedMastery.set(knowledgePointId, newMastery);

  return updatedMastery;
}

/**
 * 获取用户所有知识点的掌握度状态
 */
async function getMasteryStates(userId: string): Promise<Map<string, MasteryState>> {
  const states = await prisma.lEKnowledgePointState.findMany({
    where: { userId },
  });

  const masteryMap = new Map<string, MasteryState>();

  for (const state of states) {
    masteryMap.set(state.knowledgePointId, {
      knowledgePointId: state.knowledgePointId,
      mastery: state.accuracy,
      attempts: state.total,
      correctCount: state.correct,
      recentPerformance: [], // Not stored in DB, will be empty on load
      consecutiveCorrect: 0, // Not tracked in DB, reset on load
      consecutiveWrong: 0, // Not tracked in DB, reset on load
      lastAttemptAt: state.lastUpdatedAt,
    });
  }

  return masteryMap;
}

// ============================================================================
// IRT Ability Estimation
// ============================================================================

/**
 * 更新IRT能力估计
 *
 * 使用EAP（期望后验概率）方法估计学生能力theta
 */
async function updateIRTAbility(
  userId: string,
  answer: AnswerRecord
): Promise<{ theta: number; confidence: number }> {
  // 获取历史答题记录
  // 由于数据模型限制，我们使用简化版本：
  // 只获取最近的IRT状态并基于当前答题进行增量更新
  const existingState = await prisma.iRTStudentState.findUnique({
    where: { userId },
  });

  // 构建IRT响应记录（基于当前答题）
  const responses: IRTResponse[] = [{
    correct: answer.isCorrect,
    deltaC: answer.deltaC,
  }];

  // 如果有历史状态，我们可以模拟一些历史响应
  // 在生产环境中，应该从AttemptStep表中完整获取历史记录
  if (existingState) {
    // 使用现有的theta作为基准
    // 这里做简化的增量更新
  }

  // 估计能力
  const result = estimateAbilityEAP(responses);

  // 更新数据库（混合历史和当前结果）
  const newTheta = existingState
    ? (existingState.theta * 0.7 + result.theta * 0.3) // 70%历史权重，30%新数据权重
    : result.theta;

  const newConfidence = existingState
    ? Math.max(0.1, existingState.confidence * 0.95) // 随时间增加confidence
    : result.confidence;

  await prisma.iRTStudentState.upsert({
    where: { userId },
    create: {
      userId,
      theta: newTheta,
      confidence: newConfidence,
    },
    update: {
      theta: newTheta,
      confidence: newConfidence,
    },
  });

  return { theta: newTheta, confidence: newConfidence };
}

// ============================================================================
// Difficulty Adjustment
// ============================================================================

/**
 * 调整后续题目难度
 *
 * 规则：
 * - 连续正确 → 提高难度
 * - 连续错误 → 降低难度
 * - 基于IRT能力估计进行校准
 */
export async function adjustDifficulty(
  currentDifficulty: number,
  currentMastery: number,
  isCorrect: boolean,
  irtTheta: number
): Promise<DifficultyAdjustmentResult> {
  // 获取最近答题表现
  const recentAccuracy = await getRecentAccuracy(irtTheta);

  let newDifficulty = currentDifficulty;
  let reason = '';

  // 检查是否应该提升难度
  if (
    isCorrect &&
    currentMastery >= MASTERY_THRESHOLD_LEARNED &&
    recentAccuracy >= DIFFICULTY_ADJUSTMENT.MIN_RECENT_ACCURACY
  ) {
    newDifficulty = Math.min(10, currentDifficulty + DIFFICULTY_ADJUSTMENT.STEP);
    reason = `掌握度${Math.round(currentMastery * 100)}%且准确率${Math.round(recentAccuracy * 100)}%，提升难度`;
  }
  // 检查是否应该降低难度
  else if (
    !isCorrect &&
    currentMastery <= MASTERY_THRESHOLD_STRUGGLING &&
    currentDifficulty > 1
  ) {
    newDifficulty = Math.max(1, currentDifficulty - DIFFICULTY_ADJUSTMENT.STEP);
    reason = `掌握度${Math.round(currentMastery * 100)}%较低，降低难度巩固基础`;
  }
  // 根据IRT能力微调
  else {
    // 将theta映射到deltaC并做平滑调整
    const targetDifficulty = thetaToDeltaC(irtTheta);
    const adjustment = (targetDifficulty - currentDifficulty) * 0.3; // 30%向目标调整
    newDifficulty = Math.max(1, Math.min(10, currentDifficulty + adjustment));

    if (Math.abs(newDifficulty - currentDifficulty) > 0.5) {
      reason = `根据能力估计${irtTheta.toFixed(2)}微调难度`;
    } else {
      reason = '保持当前难度';
    }
  }

  return {
    newDifficulty: Math.round(newDifficulty * 10) / 10,
    oldDifficulty: currentDifficulty,
    reason,
  };
}

/**
 * 获取最近答题准确率（基于IRT预测）
 */
async function getRecentAccuracy(irtTheta: number): Promise<number> {
  // 简化版本：使用theta计算理论准确率
  // 实际应该从数据库获取真实历史表现
  const p = 1 / (1 + Math.exp(-irtTheta)); // sigmoid
  return Math.max(0.1, Math.min(0.9, p));
}

// ============================================================================
// Next Knowledge Point Selection
// ============================================================================

/**
 * 确定下一个学习点
 *
 * 策略：
 * 1. 如果当前知识点未掌握 → 继续练习
 * 2. 如果当前知识点已掌握 → 查找相邻知识点
 * 3. 优先推荐最近发展区（ZPD）内的知识点
 */
export async function getNextKnowledgePoint(
  path: { knowledgeData: unknown },
  masteryStates: Map<string, number>,
  currentKnowledgePointId: string
): Promise<PathKnowledgeNode | undefined> {
  // knowledgeData is now Json type
  const rawData = path.knowledgeData;
  const nodes: PathKnowledgeNode[] = Array.isArray(rawData)
    ? rawData as PathKnowledgeNode[]
    : typeof rawData === 'string'
      ? JSON.parse(rawData)
      : [];

  const currentMastery = masteryStates.get(currentKnowledgePointId) || 0;

  // 如果当前知识点未掌握，继续练习
  if (currentMastery < MASTERY_THRESHOLD_LEARNED) {
    const currentNode = nodes.find((n) => n.nodeId === currentKnowledgePointId);
    if (currentNode) {
      return currentNode;
    }
  }

  // 查找下一个知识点
  const currentIndex = nodes.findIndex((n) => n.nodeId === currentKnowledgePointId);

  // 按优先级排序未掌握的知识点
  const unmasteredNodes = nodes
    .filter((n) => (masteryStates.get(n.nodeId) || 0) < MASTERY_THRESHOLD_LEARNED)
    .sort((a, b) => b.priority - a.priority);

  if (unmasteredNodes.length > 0) {
    return unmasteredNodes[0];
  }

  // 如果都已掌握，返回下一个节点
  if (currentIndex >= 0 && currentIndex < nodes.length - 1) {
    return nodes[currentIndex + 1];
  }

  // 默认返回优先级最高的
  return nodes.sort((a, b) => b.priority - a.priority)[0];
}

// ============================================================================
// Persistence
// ============================================================================

/**
 * 持久化路径更新
 */
async function persistPathUpdate(
  pathId: string,
  userId: string,
  update: {
    answer: AnswerRecord;
    masteryStates: Map<string, number>;
    irtState: { theta: number; confidence: number };
    difficultyResult: DifficultyAdjustmentResult;
  }
): Promise<void> {
  // 更新知识点掌握度状态
  const kpId = update.answer.knowledgePointId;
  const newAccuracy = update.masteryStates.get(kpId) || 0.5;

  const existingState = await prisma.lEKnowledgePointState.findUnique({
    where: {
      userId_knowledgePointId: {
        userId,
        knowledgePointId: kpId,
      },
    },
  });

  const currentCorrect = existingState?.correct || 0;
  const currentTotal = existingState?.total || 0;

  const newCorrect = currentCorrect + (update.answer.isCorrect ? 1 : 0);
  const newTotal = currentTotal + 1;

  await prisma.lEKnowledgePointState.upsert({
    where: {
      userId_knowledgePointId: {
        userId,
        knowledgePointId: kpId,
      },
    },
    create: {
      userId,
      knowledgePointId: kpId,
      correct: update.answer.isCorrect ? 1 : 0,
      total: 1,
      accuracy: newAccuracy,
      lastUpdatedAt: new Date(),
    },
    update: {
      correct: newCorrect,
      total: newTotal,
      accuracy: newAccuracy,
      lastUpdatedAt: new Date(),
    },
  });

  // 记录路径调整历史
  await prisma.pathAdjustment.create({
    data: {
      pathId,
      type: 'micro',
      trigger: 'practice_completed',
      changes: JSON.stringify({
        knowledgePointId: kpId,
        isCorrect: update.answer.isCorrect,
        newMastery: newAccuracy,
        irtTheta: update.irtState.theta,
        difficultyAdjustment: {
          from: update.difficultyResult.oldDifficulty,
          to: update.difficultyResult.newDifficulty,
        },
      }),
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 获取当前路径
 */
async function getCurrentPath(pathId: string) {
  const path = await prisma.learningPath.findUnique({
    where: { id: pathId },
  });

  if (!path) {
    throw new Error(`Path not found: ${pathId}`);
  }

  return path;
}

/**
 * 构建更新原因说明
 */
function buildUpdateReason(
  answer: AnswerRecord,
  newMastery: number,
  difficultyResult: DifficultyAdjustmentResult,
  nextPoint?: PathKnowledgeNode
): string {
  const parts: string[] = [];

  // 答题结果
  parts.push(
    answer.isCorrect ? '回答正确' : '回答错误',
    `，掌握度更新为${Math.round(newMastery * 100)}%`
  );

  // 难度调整
  if (difficultyResult.newDifficulty !== difficultyResult.oldDifficulty) {
    parts.push(
      `，难度从${difficultyResult.oldDifficulty.toFixed(1)}调整至${difficultyResult.newDifficulty.toFixed(1)}`
    );
  }

  // 下一个知识点
  if (nextPoint) {
    parts.push(`，推荐学习：【${nextPoint.nodeId}】`);
  }

  return parts.join('');
}

// ============================================================================
// Real-time Path Adjustment Support
// ============================================================================

/**
 * 获取实时学习路径状态
 *
 * 返回当前路径的完整状态，包括：
 * - 所有知识点的掌握度
 * - 推荐的下一个知识点
 * - 推荐的题目难度
 */
export async function getRealtimePathState(
  pathId: string,
  userId: string
): Promise<{
  masteryStates: Map<string, MasteryState>;
  nextKnowledgePoint?: string;
  recommendedDifficulty: number;
  irtTheta: number;
}> {
  const path = await getCurrentPath(pathId);
  const masteryStates = await getMasteryStates(userId);
  const irtState = await prisma.iRTStudentState.findUnique({
    where: { userId },
  });

  // knowledgeData is now Json type
  const rawData = path.knowledgeData;
  const nodes: PathKnowledgeNode[] = Array.isArray(rawData)
    ? rawData as PathKnowledgeNode[]
    : typeof rawData === 'string'
      ? JSON.parse(rawData)
      : [];

  // 找到优先级最高的未掌握知识点
  const unmasteredNodes = nodes
    .filter((n) => (masteryStates.get(n.nodeId)?.mastery || 0) < MASTERY_THRESHOLD_LEARNED)
    .sort((a, b) => b.priority - a.priority);

  const nextKnowledgePoint = unmasteredNodes[0]?.nodeId;

  // 根据IRT theta计算推荐难度
  const recommendedDifficulty = irtState
    ? thetaToDeltaC(irtState.theta)
    : 5.0;

  return {
    masteryStates,
    nextKnowledgePoint,
    recommendedDifficulty,
    irtTheta: irtState?.theta || 0,
  };
}

/**
 * 检查是否应该跳过已掌握内容
 *
 * 规则：
 * - 连续正确 ≥ CONSECUTIVE_CORRECT_THRESHOLD
 * - 掌握度 ≥ MASTERY_THRESHOLD_LEARNED
 */
export function shouldSkipContent(masteryState: MasteryState): boolean {
  return (
    masteryState.consecutiveCorrect >= CONSECUTIVE_CORRECT_THRESHOLD &&
    masteryState.mastery >= MASTERY_THRESHOLD_LEARNED
  );
}

/**
 * 检查是否需要降级复习
 *
 * 规则：
 * - 连续错误 ≥ CONSECUTIVE_WRONG_THRESHOLD
 * - 掌握度 < MASTERY_THRESHOLD_STRUGGLING
 */
export function needsReview(masteryState: MasteryState): boolean {
  return (
    masteryState.consecutiveWrong >= CONSECUTIVE_WRONG_THRESHOLD ||
    masteryState.mastery < MASTERY_THRESHOLD_STRUGGLING
  );
}
