/**
 * CS (Convergence Stability) Test
 * 测试稳定收敛性：同一知识点在多次评估中的推荐差异
 *
 * 目标: CS ≥ 0.85
 *
 * 计算方法:
 * CS = 1 - variance(recommendation_distribution)
 * 或
 * CS = similarity(top_k_recommendations across runs)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CSResult {
  cs: number;
  passed: boolean;
  knowledgePoints: KPCStability[];
  avgVariance: number;
  avgSimilarity: number;
}

interface KPCStability {
  knowledgePointId: string;
  variance: number;
  similarity: number;
  recommendationCount: number;
  topKChanges: number;
  recommendations: string[];
}

interface Recommendation {
  id: string;
  createdAt: Date;
  changes: any;
}

/**
 * 获取知识点的推荐历史
 */
async function getRecommendationsForKnowledgePoint(
  knowledgePointId: string,
  limit: number = 10
): Promise<Recommendation[]> {
  // 从 PathAdjustment 获取推荐
  const adjustments = await prisma.pathAdjustment.findMany({
    where: {
      OR: [
        {
          changes: {
            path: ['$'],
            string_contains: knowledgePointId,
          },
        },
        {
          path: {
            knowledgeData: {
              path: ['$'],
              string_contains: knowledgePointId,
            },
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return adjustments.map((adj) => ({
    id: adj.id,
    createdAt: adj.createdAt,
    changes: typeof adj.changes === 'string' ? JSON.parse(adj.changes) : adj.changes,
  }));
}

/**
 * 计算 Top-K 推荐的相似度
 */
function calculateTopKSimilarity(recommendations: string[][], k: number = 5): number {
  if (recommendations.length < 2) {
    return 1.0; // 单次推荐视为完全稳定
  }

  // 取每个推荐的 Top-K
  const topKLists = recommendations.map((rec) => rec.slice(0, k));

  // 计算所有对的 Jaccard 相似度，取平均
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < topKLists.length - 1; i++) {
    for (let j = i + 1; j < topKLists.length; j++) {
      const set1 = new Set(topKLists[i]);
      const set2 = new Set(topKLists[j]);

      const intersection = new Set([...set1].filter((x) => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const jaccard = union.size > 0 ? intersection.size / union.size : 1;
      totalSimilarity += jaccard;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 1;
}

/**
 * 计算推荐分布的方差
 *
 * 将推荐转换为数值特征，计算方差
 */
function calculateRecommendationVariance(recommendations: any[]): number {
  if (recommendations.length < 2) {
    return 0; // 单次推荐无方差
  }

  // 提取数值特征：推荐数量、优先级等
  const features: number[] = recommendations.map((rec) => {
    // 简化特征：使用推荐项目的数量作为特征
    if (Array.isArray(rec)) {
      return rec.length;
    }
    if (typeof rec === 'object' && rec !== null) {
      // 如果有 priority 或 weight 字段，使用它
      if (typeof rec.priority === 'number') return rec.priority;
      if (typeof rec.weight === 'number') return rec.weight;
      // 否则返回对象键的数量
      return Object.keys(rec).length;
    }
    return 0;
  });

  // 计算方差
  const mean = features.reduce((sum, f) => sum + f, 0) / features.length;
  const variance =
    features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / features.length;

  // 归一化到 [0, 1]
  // 假设最大合理方差是 mean^2 (即所有值都是 0 或 2*mean)
  const maxVariance = mean * mean;
  return maxVariance > 0 ? Math.min(variance / maxVariance, 1) : 0;
}

/**
 * 计算单个知识点的稳定性
 */
async function calculateKPCStability(
  knowledgePointId: string
): Promise<KPCStability | null> {
  const recommendations = await getRecommendationsForKnowledgePoint(knowledgePointId);

  if (recommendations.length < 2) {
    return null; // 需要至少2次推荐才能计算稳定性
  }

  // 提取推荐内容
  const recContents = recommendations.map((r) => {
    if (typeof r.changes === 'object' && r.changes !== null) {
      if (Array.isArray(r.changes.recommendations)) {
        return r.changes.recommendations;
      }
      if (Array.isArray(r.changes.suggestedTopics)) {
        return r.changes.suggestedTopics;
      }
    }
    return [];
  });

  // 过滤掉空推荐
  const validRecs = recContents.filter((r) => r.length > 0);

  if (validRecs.length < 2) {
    return null;
  }

  // 计算相似度
  const similarity = calculateTopKSimilarity(validRecs);

  // 计算方差
  const variance = calculateRecommendationVariance(validRecs);

  // 统计 Top-K 变化
  const topKChanges = countTopKChanges(validRecs, 5);

  return {
    knowledgePointId,
    variance,
    similarity,
    recommendationCount: recommendations.length,
    topKChanges,
    recommendations: validRecs.map((r) => JSON.stringify(r).slice(0, 50)),
  };
}

/**
 * 统计 Top-K 推荐的变化次数
 */
function countTopKChanges(recommendations: string[][], k: number): number {
  if (recommendations.length < 2) {
    return 0;
  }

  const topKLists = recommendations.map((rec) => new Set(rec.slice(0, k)));
  let changes = 0;

  for (let i = 1; i < topKLists.length; i++) {
    // 比较相邻两次推荐
    const prev = topKLists[i - 1];
    const curr = topKLists[i];

    // 计算不同的元素数量
    const union = new Set([...prev, ...curr]);
    const intersection = new Set([...prev].filter((x) => curr.has(x)));

    changes += union.size - intersection.size;
  }

  return changes;
}

/**
 * 计算 CS (Convergence Stability)
 */
export async function calculateCS(
  minRecommendations: number = 5,
  knowledgePointIds?: string[]
): Promise<CSResult> {
  console.log(`🔍 计算 CS (Convergence Stability)`);
  console.log(`   最小推荐次数: ${minRecommendations}`);

  let kps: string[] = [];

  if (knowledgePointIds && knowledgePointIds.length > 0) {
    kps = knowledgePointIds;
  } else {
    // 从 UserKnowledge 获取活跃知识点
    const activeKPs = await prisma.userKnowledge.findMany({
      where: {
        practiceCount: { gte: minRecommendations },
      },
      take: 50,
    });
    kps = activeKPs.map((uk) => uk.knowledgePointId);
  }

  console.log(`   评估知识点数: ${kps.length}`);

  const results: KPCStability[] = [];

  for (const kpId of kps) {
    const result = await calculateKPCStability(kpId);
    if (result) {
      results.push(result);
    }
  }

  if (results.length === 0) {
    console.warn(`   ⚠️  没有足够推荐数据的知识点`);
    return {
      cs: 0,
      passed: false,
      knowledgePoints: [],
      avgVariance: 1,
      avgSimilarity: 0,
    };
  }

  // 计算平均相似度和方差
  const avgSimilarity =
    results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
  const avgVariance =
    results.reduce((sum, r) => sum + r.variance, 0) / results.length;

  // CS = 1 - variance 或 CS = similarity
  // 取两种方法的平均值
  const cs = (avgSimilarity + (1 - avgVariance)) / 2;
  const passed = cs >= 0.85;

  return {
    cs,
    passed,
    knowledgePoints: results,
    avgVariance,
    avgSimilarity,
  };
}

/**
 * 打印 CS 报告
 */
export function printCSReport(result: CSResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 CS (Convergence Stability) 报告');
  console.log('='.repeat(60));

  console.log(`\n📈 指标:`);
  console.log(`   平均相似度:    ${(result.avgSimilarity * 100).toFixed(2)}%`);
  console.log(`   平均方差:      ${(result.avgVariance * 100).toFixed(2)}%`);
  console.log(`   CS:            ${(result.cs * 100).toFixed(2)}%`);
  console.log(`   目标:          ≥ 85%`);
  console.log(`   评估知识点数:  ${result.knowledgePoints.length}`);

  console.log(`\n${result.passed ? '✅ 通过' : '❌ 失败'}`);

  if (result.knowledgePoints.length > 0) {
    // 按稳定性排序，显示最不稳定的
    console.log(`\n📚 稳定性排序 (最不稳定的 Top 10):`);
    result.knowledgePoints
      .sort((a, b) => a.similarity - b.similarity)
      .slice(0, 10)
      .forEach((kp, i) => {
        const stabilityScore = ((kp.similarity + (1 - kp.variance)) / 2) * 100;
        console.log(
          `   ${i + 1}. ${kp.knowledgePointId.slice(0, 8)}... ` +
            `稳定性: ${stabilityScore.toFixed(1)}% ` +
            `(相似度: ${(kp.similarity * 100).toFixed(0)}%, ` +
            `方差: ${(kp.variance * 100).toFixed(0)}%, ` +
            `Top-K变化: ${kp.topKChanges})`
        );
      });

    // 显示最稳定的
    console.log(`\n✨ 最稳定的 Top 5:`);
    result.knowledgePoints
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .forEach((kp, i) => {
        const stabilityScore = ((kp.similarity + (1 - kp.variance)) / 2) * 100;
        console.log(
          `   ${i + 1}. ${kp.knowledgePointId.slice(0, 8)}... ` +
            `稳定性: ${stabilityScore.toFixed(1)}%`
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
  const minRecommendations = parseInt(args[0]) || 5;

  const result = await calculateCS(minRecommendations);
  printCSReport(result);

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
