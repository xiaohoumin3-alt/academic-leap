/**
 * Complexity-Aware Question Recommender
 *
 * 基于复杂度特征的智能题目推荐
 */

import { prisma } from '@/lib/prisma';

export interface ComplexityProfile {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}

export interface QuestionWithComplexity {
  id: string;
  content: string;
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
  difficulty: number;
  matchScore: number;
}

/**
 * 计算题目与目标复杂度的匹配度
 */
function calculateMatchScore(questionComplexity: number, targetComplexity: number): number {
  const diff = Math.abs(questionComplexity - targetComplexity);
  // 0-1 范围，diff越小匹配度越高
  return Math.max(0, 1 - diff * 1.5);
}

/**
 * 根据学生掌握度和目标复杂度推荐题目
 */
export async function getRecommendedQuestions(params: {
  knowledgePointId?: string;
  studentMastery: number; // 0-100
  targetComplexity?: number;
  limit?: number;
  excludeIds?: string[];
}): Promise<QuestionWithComplexity[]> {
  const {
    knowledgePointId,
    studentMastery = 50,
    targetComplexity = 0.5,
    limit = 10,
    excludeIds = [],
  } = params;

  // 构建查询条件
  const where: any = {
    extractionStatus: 'SUCCESS',
    complexity: { not: null },
    cognitiveLoad: { not: null },
    reasoningDepth: { not: null },
  };

  if (excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }

  // 查询已提取特征的题目
  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      content: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
      difficulty: true,
    },
    take: 200,
    orderBy: { featuresExtractedAt: 'desc' },
  });

  // 根据学生掌握度调整目标复杂度
  // mastery 0-100 -> targetComplexity 0.2-0.8
  const adjustedTarget = targetComplexity;

  // 计算匹配度并排序
  const scored = questions
    .map(q => {
      const complexity = q.complexity!;
      const matchScore = calculateMatchScore(complexity, adjustedTarget);

      // 考虑认知负荷和推理深度的平衡
      const cogRatio = q.cognitiveLoad! / (complexity || 0.5);
      const reaRatio = q.reasoningDepth! / (complexity || 0.5);

      return {
        id: q.id,
        content: q.content,
        cognitiveLoad: q.cognitiveLoad!,
        reasoningDepth: q.reasoningDepth!,
        complexity,
        difficulty: q.difficulty,
        matchScore: matchScore * (1 + (cogRatio + reaRatio) / 4), // 微调分数
      };
    })
    .filter(q => q.matchScore > 0.3) // 只返回匹配度 > 30% 的题目
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
}

/**
 * 获取复杂度分布统计
 */
export async function getComplexityStats() {
  const [total, withFeatures, distribution, avgFeatures] = await Promise.all([
    prisma.question.count(),
    prisma.question.count({
      where: { extractionStatus: 'SUCCESS', complexity: { not: null } }
    }),
    prisma.$queryRaw<Array<{ level: string; count: string }>>`
      SELECT
        CASE
          WHEN complexity < 0.3 THEN 'low'
          WHEN complexity < 0.7 THEN 'medium'
          ELSE 'high'
        END as level,
        COUNT(*) as count
      FROM "Question"
      WHERE "extractionStatus" = 'SUCCESS' AND complexity IS NOT NULL
      GROUP BY level
    `,
    prisma.question.aggregate({
      where: { extractionStatus: 'SUCCESS', complexity: { not: null } },
      _avg: { complexity: true, cognitiveLoad: true, reasoningDepth: true },
      _min: { complexity: true },
      _max: { complexity: true },
    }),
  ]);

  const distMap = Object.fromEntries(
    distribution.map(d => [d.level, parseInt(d.count)])
  );

  return {
    total,
    withFeatures,
    coverage: total > 0 ? (withFeatures / total * 100).toFixed(1) + '%' : '0%',
    distribution: {
      low: distMap.low || 0,
      medium: distMap.medium || 0,
      high: distMap.high || 0,
    },
    averages: {
      complexity: avgFeatures._avg.complexity?.toFixed(3) || '-',
      cognitiveLoad: avgFeatures._avg.cognitiveLoad?.toFixed(3) || '-',
      reasoningDepth: avgFeatures._avg.reasoningDepth?.toFixed(3) || '-',
    },
    range: {
      min: avgFeatures._min.complexity?.toFixed(3) || '-',
      max: avgFeatures._max.complexity?.toFixed(3) || '-',
    },
  };
}

/**
 * 根据复杂度范围获取题目
 */
export async function getQuestionsByComplexityRange(params: {
  minComplexity?: number;
  maxComplexity?: number;
  minCognitiveLoad?: number;
  limit?: number;
}): Promise<QuestionWithComplexity[]> {
  const { minComplexity = 0, maxComplexity = 1, minCognitiveLoad, limit = 50 } = params;

  const where: any = {
    extractionStatus: 'SUCCESS',
    complexity: { not: null, gte: minComplexity, lte: maxComplexity },
  };

  if (minCognitiveLoad !== undefined) {
    where.cognitiveLoad = { gte: minCognitiveLoad };
  }

  const questions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      content: true,
      cognitiveLoad: true,
      reasoningDepth: true,
      complexity: true,
      difficulty: true,
    },
    take: limit,
    orderBy: { complexity: 'asc' },
  });

  return questions.map(q => ({
    id: q.id,
    content: q.content,
    cognitiveLoad: q.cognitiveLoad!,
    reasoningDepth: q.reasoningDepth!,
    complexity: q.complexity!,
    difficulty: q.difficulty,
    matchScore: 1, // 这些题目都符合范围要求
  }));
}
