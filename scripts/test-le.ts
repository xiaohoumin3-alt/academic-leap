/**
 * LE (Learning Effectiveness) Test
 * 测试预测有效性：推荐后同类题正确率是否提升
 *
 * 目标: LE > 0.15 (至少提升15%)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LEResult {
  preAccuracy: number;
  postAccuracy: number;
  le: number;
  passed: boolean;
  sampleSize: number;
  byKnowledgePoint: KnowledgePointLE[];
}

interface KnowledgePointLE {
  knowledgePointId: string;
  preAccuracy: number;
  postAccuracy: number;
  le: number;
  sampleSize: number;
}

/**
 * 获取知识点相关的题目
 */
async function getQuestionsByKnowledgePoint(knowledgePointId: string) {
  // 从 Question.knowledgePoints JSON 字段查找
  const questions = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Question
    WHERE knowledgePoints LIKE '%' || ${knowledgePointId} || '%'
    LIMIT 100
  `;
  return questions;
}

/**
 * 计算单个知识点的学习效果
 */
async function calculateKnowledgePointLE(
  knowledgePointId: string,
  beforeWindowMs: number = 7 * 24 * 60 * 60 * 1000, // 7天前
  afterWindowMs: number = 7 * 24 * 60 * 60 * 1000 // 7天后
): Promise<KnowledgePointLE | null> {
  // 获取该知识点的相关题目ID
  const questions = await getQuestionsByKnowledgePoint(knowledgePointId);

  if (questions.length === 0) {
    return null;
  }

  const questionIds = questions.map((q) => q.id);

  // 获取最近一次推荐/调整的时间
  const latestAdjustment = await prisma.pathAdjustment.findFirst({
    where: {
      changes: {
        path: ['$'],
        string_contains: knowledgePointId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestAdjustment) {
    return null;
  }

  const recommendationTime = latestAdjustment.createdAt;

  // 推荐前的正确率 (推荐时间窗口之前)
  const beforeAttempts = await prisma.attemptStep.findMany({
    where: {
      questionStep: {
        question: {
          id: { in: questionIds },
        },
      },
      attempt: {
        startedAt: {
          gte: new Date(recommendationTime.getTime() - beforeWindowMs),
          lt: recommendationTime,
        },
      },
    },
  });

  // 推荐后的正确率 (推荐时间窗口之后)
  const afterAttempts = await prisma.attemptStep.findMany({
    where: {
      questionStep: {
        question: {
          id: { in: questionIds },
        },
      },
      attempt: {
        startedAt: {
          gte: recommendationTime,
          lte: new Date(recommendationTime.getTime() + afterWindowMs),
        },
      },
    },
  });

  if (beforeAttempts.length === 0 || afterAttempts.length === 0) {
    return null;
  }

  const preCorrect = beforeAttempts.filter((a) => a.isCorrect).length;
  const postCorrect = afterAttempts.filter((a) => a.isCorrect).length;

  const preAccuracy = preCorrect / beforeAttempts.length;
  const postAccuracy = postCorrect / afterAttempts.length;
  const le = postAccuracy - preAccuracy;

  return {
    knowledgePointId,
    preAccuracy,
    postAccuracy,
    le,
    sampleSize: beforeAttempts.length + afterAttempts.length,
  };
}

/**
 * 计算 LE (Learning Effectiveness)
 *
 * 方法1: 基于推荐前后的正确率变化
 * LE = avg(post_accuracy - pre_accuracy)
 */
export async function calculateLE(
  windowSize: number = 100, // 最近N次会话
  minSampleSize: number = 10 // 最小样本量
): Promise<LEResult> {
  console.log(`🔍 计算 LE (Learning Effectiveness)`);
  console.log(`   窗口大小: ${windowSize} 次会话`);
  console.log(`   最小样本: ${minSampleSize}`);

  // 获取最近的 LearningPath/PathAdjustment 作为推荐事件
  const recentAdjustments = await prisma.pathAdjustment.findMany({
    take: windowSize,
    orderBy: { createdAt: 'desc' },
  });

  // 获取最近的 UserKnowledge 更新作为诊断事件
  const recentKnowledgeUpdates = await prisma.userKnowledge.findMany({
    where: {
      lastPractice: { not: null },
    },
    take: windowSize,
    orderBy: { lastPractice: 'desc' },
  });

  // 收集所有涉及的知识点
  const knowledgePointIds = new Set<string>();
  recentAdjustments.forEach((adj) => {
    // 尝试从 changes JSON 中提取知识点ID
    try {
      const changes = typeof adj.changes === 'string' ? JSON.parse(adj.changes) : adj.changes;
      // 简化处理：如果有 knowledgePointId 字段
      if (changes.knowledgePointId) {
        knowledgePointIds.add(changes.knowledgePointId);
      }
    } catch {
      // 忽略解析错误
    }
  });

  recentKnowledgeUpdates.forEach((uk) => {
    knowledgePointIds.add(uk.knowledgePointId);
  });

  console.log(`   涉及知识点: ${knowledgePointIds.size}`);

  // 计算每个知识点的 LE
  const results: KnowledgePointLE[] = [];

  for (const kpId of knowledgePointIds) {
    const result = await calculateKnowledgePointLE(kpId);
    if (result && result.sampleSize >= minSampleSize) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.warn(`   ⚠️  没有足够样本的数据`);

    // 尝试备用方法：使用所有 UserKnowledge 的前后对比
    return await calculateLEBackup(minSampleSize);
  }

  // 计算平均 LE
  const totalSampleSize = results.reduce((sum, r) => sum + r.sampleSize, 0);
  const weightedPreAccuracy =
    results.reduce((sum, r) => sum + r.preAccuracy * r.sampleSize, 0) / totalSampleSize;
  const weightedPostAccuracy =
    results.reduce((sum, r) => sum + r.postAccuracy * r.sampleSize, 0) / totalSampleSize;
  const le = weightedPostAccuracy - weightedPreAccuracy;
  const passed = le > 0.15;

  return {
    preAccuracy: weightedPreAccuracy,
    postAccuracy: weightedPostAccuracy,
    le,
    passed,
    sampleSize: totalSampleSize,
    byKnowledgePoint: results,
  };
}

/**
 * 备用方法：使用 PredictionLog 计算 LE
 */
async function calculateLEBackup(minSampleSize: number): Promise<LEResult> {
  console.log(`   使用备用方法 (PredictionLog)`);

  const predictions = await prisma.predictionLog.findMany({
    where: {
      actual: { not: null },
    },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  });

  if (predictions.length < minSampleSize) {
    return {
      preAccuracy: 0,
      postAccuracy: 0,
      le: 0,
      passed: false,
      sampleSize: 0,
      byKnowledgePoint: [],
    };
  }

  // 计算预测准确率作为学习效果的代理指标
  const correct = predictions.filter((p) => p.actual === true).length;
  const accuracy = correct / predictions.length;

  // 这里需要一个"推荐前"的基线，使用最早的数据作为基线
  const midPoint = Math.floor(predictions.length / 2);
  const earlyCorrect = predictions.slice(midPoint).filter((p) => p.actual === true).length;
  const earlyAccuracy = earlyCorrect / (predictions.length - midPoint);

  const le = accuracy - earlyAccuracy;
  const passed = le > 0.15;

  return {
    preAccuracy: earlyAccuracy,
    postAccuracy: accuracy,
    le,
    passed,
    sampleSize: predictions.length,
    byKnowledgePoint: [],
  };
}

/**
 * 打印 LE 报告
 */
export function printLEReport(result: LEResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 LE (Learning Effectiveness) 报告');
  console.log('='.repeat(60));

  console.log(`\n📈 指标:`);
  console.log(`   推荐前正确率: ${(result.preAccuracy * 100).toFixed(2)}%`);
  console.log(`   推荐后正确率: ${(result.postAccuracy * 100).toFixed(2)}%`);
  console.log(`   LE:           ${(result.le * 100).toFixed(2)}%`);
  console.log(`   目标:         > 15%`);
  console.log(`   样本量:       ${result.sampleSize}`);

  console.log(`\n${result.passed ? '✅ 通过' : '❌ 失败'}`);

  if (result.byKnowledgePoint.length > 0) {
    console.log(`\n📚 分知识点统计 (Top 10):`);
    result.byKnowledgePoint
      .sort((a, b) => b.le - a.le)
      .slice(0, 10)
      .forEach((kp, i) => {
        const arrow = kp.le > 0 ? '↑' : '↓';
        console.log(
          `   ${i + 1}. ${kp.knowledgePointId.slice(0, 8)}... ` +
            `${(kp.preAccuracy * 100).toFixed(0)}% → ${(kp.postAccuracy * 100).toFixed(0)}% ` +
            `(${arrow}${(kp.le * 100).toFixed(1)}%)`
        );
      });
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const windowSize = parseInt(args[0]) || 100;
  const minSampleSize = parseInt(args[1]) || 10;

  const result = await calculateLE(windowSize, minSampleSize);
  printLEReport(result);

  // Exit with error code if failed
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
