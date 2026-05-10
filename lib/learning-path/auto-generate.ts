import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calculatePriority,
  generatePriorityReasons,
  getUserMastery,
  getDaysSincePractice,
  getRecentFailureRate,
} from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';
import { PathNodeStatus } from '@/lib/learning-path/types';
import { getWeakPointsWithIds, type AssessmentKnowledgeData } from '@/lib/types/knowledge';

const MASTERY_THRESHOLD = 0.9;

/**
 * 在事务内部生成学习路径
 *
 * 此函数设计为在事务内部调用，使用传入的 tx 而不是全局 prisma
 * 确保测评记录和学习路径的创建原子性
 *
 * @param tx - Prisma 事务客户端
 * @param params - 生成参数
 * @returns 学习路径 ID
 * @throws 当测评不存在、分数不符合、无薄弱知识点等情况时抛出错误
 */
export async function generateLearningPathInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    assessmentId: string;
  }
): Promise<string> {
  const { userId, assessmentId } = params;

  // 1. 获取测评记录并提取薄弱知识点
  const assessment = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { score: true, knowledgeData: true },
  });

  if (!assessment) {
    throw new Error('测评记录不存在');
  }

  if (assessment.score < 60 || assessment.score >= 90) {
    throw new Error(`测评分数不在可生成学习路径的范围内 (${assessment.score}，要求60-89分)`);
  }

  // 2. 解析知识点数据，提取薄弱知识点 (level <= 1)
  let assessmentKnowledgeData: AssessmentKnowledgeData;
  try {
    if (typeof assessment.knowledgeData === 'string') {
      assessmentKnowledgeData = JSON.parse(assessment.knowledgeData) as AssessmentKnowledgeData;
    } else {
      assessmentKnowledgeData = assessment.knowledgeData as unknown as AssessmentKnowledgeData;
    }
  } catch (error) {
    throw new Error('测评数据格式错误');
  }

  const weakPoints = getWeakPointsWithIds(assessmentKnowledgeData);
  const weakKnowledgePointIds = new Set(weakPoints.map((wp) => wp.id));

  if (weakKnowledgePointIds.size === 0) {
    throw new Error('测评中未发现薄弱知识点（无法生成学习路径）');
  }

  // 3. 获取用户数据
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { selectedTextbookId: true, includeStale: true },
  });

  if (!user?.selectedTextbookId) {
    throw new Error('请先选择教材版本');
  }

  // 4. 获取用户启用的知识点
  const enabledKnowledge = await tx.userEnabledKnowledge.findMany({
    where: { userId, nodeType: 'point' },
    select: { nodeId: true },
  });

  const enabledNodeIds = new Set(enabledKnowledge.map((ek) => ek.nodeId));

  // 5. 获取知识点
  const knowledgePoints = await tx.knowledgePoint.findMany({
    where: {
      chapter: { textbookId: user.selectedTextbookId },
      status: 'active',
    },
    select: { id: true, name: true, weight: true },
  });

  // 6. 获取属于用户教材的薄弱知识点
  const weakKpsInUserTextbook = knowledgePoints.filter((kp) =>
    weakKnowledgePointIds.has(kp.id)
  );

  // 7. 自动启用所有测评发现但未启用的薄弱知识点
  const unenabledWeakKps = weakKpsInUserTextbook.filter((kp) => !enabledNodeIds.has(kp.id));
  if (unenabledWeakKps.length > 0) {
    console.log(`[generateLearningPath] 自动启用 ${unenabledWeakKps.length} 个未启用的薄弱知识点...`);
    await Promise.all(
      unenabledWeakKps.map((kp) =>
        tx.userEnabledKnowledge.upsert({
          where: {
            userId_nodeId: { userId, nodeId: kp.id },
          },
          create: { userId, nodeId: kp.id, nodeType: 'point' },
          update: {}, // 已存在则不更新
        })
      )
    );
    console.log(`[generateLearningPath] 已自动启用: ${unenabledWeakKps.map(kp => kp.name).join(', ')}`);
  }

  // 8. 过滤知识点（必须是启用的且薄弱的）
  const enabledKnowledgePoints = weakKpsInUserTextbook.filter((kp) =>
    weakKnowledgePointIds.has(kp.id) // 已在教材中且是薄弱知识点
  );

  if (enabledKnowledgePoints.length === 0) {
    throw new Error('没有可生成学习路径的知识点');
  }

  // 7. 计算优先级
  const masteryData = await Promise.all(
    enabledKnowledgePoints.map(async (kp) => {
      const [mastery, daysSincePractice, recentFailureRate] = await Promise.all([
        getUserMastery(tx, userId, kp.id),
        getDaysSincePractice(tx, userId, kp.id),
        getRecentFailureRate(tx, userId, kp.id, 7),
      ]);

      return { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate };
    })
  );

  const knowledgeNodes: PathKnowledgeNode[] = [];
  const now = new Date().toISOString();

  for (const data of masteryData) {
    const { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate } = data;

    if (mastery >= MASTERY_THRESHOLD) continue;

    const priorityResult = calculatePriority({
      mastery,
      weight: kp.weight || 3,
      daysSincePractice,
      recentFailureRate,
      includeStale: user.includeStale,
    });

    const reasons = generatePriorityReasons({
      mastery,
      weight: kp.weight || 3,
      daysSincePractice,
      recentFailureRate,
      includeStale: user.includeStale,
    });

    knowledgeNodes.push({
      nodeId: kp.id,
      priority: priorityResult.score,
      status: 'pending' as PathNodeStatus,
      addedAt: now,
      reasons,
    });
  }

  // 8. 按优先级排序
  knowledgeNodes.sort((a, b) => b.priority - a.priority);

  // 9. 归档旧路径并创建新路径
  await tx.learningPath.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'archived' },
  });

  const path = await tx.learningPath.create({
    data: {
      userId,
      name: `基于测评的学习路径`,
      type: 'initial',
      status: 'active',
      knowledgeData: JSON.stringify(knowledgeNodes),
    },
    select: { id: true },
  });

  return path.id;
}
