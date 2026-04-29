/**
 * QIE Complexity-Aware Question Recommendation API
 *
 * POST /api/learning-path/recommend
 *
 * Recommends questions based on complexity features and student mastery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RecommendRequest {
  knowledgePointId?: string;
  studentMastery?: number; // 0-100
  targetDifficulty?: number; // 0-1
  excludeQuestionIds?: string[];
}

interface QuestionRecommendation {
  id: string;
  complexity: number;
  cognitiveLoad: number;
  reasoningDepth: number;
  difficulty: number;
  hasFeatures: boolean;
  matchScore: number;
}

/**
 * POST /api/learning-path/recommend
 *
 * Get recommended questions based on complexity matching.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 2. Parse request
    const body: RecommendRequest = await req.json().catch(() => ({}));
    const {
      knowledgePointId,
      studentMastery = 50,
      targetDifficulty = 0.5,
      excludeQuestionIds = []
    } = body;

    // 3. Build query filters
    const whereClause: any = {
      extractionStatus: 'SUCCESS',
      complexity: { not: null },
    };

    if (knowledgePointId) {
      // Find questions that match the knowledge point
      const questions = await prisma.question.findMany({
        where: {
          extractionStatus: 'SUCCESS',
          complexity: { not: null },
          id: { notIn: excludeQuestionIds },
          OR: [
            { knowledgePoints: { contains: knowledgePointId } },
            { content: { contains: knowledgePointId } },
          ],
        },
        select: {
          id: true,
          complexity: true,
          cognitiveLoad: true,
          reasoningDepth: true,
          difficulty: true,
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });

      // Score and rank questions
      const scored = questions.map(q => {
        const complexity = q.complexity!;
        const diff = Math.abs(complexity - targetDifficulty);
        const matchScore = Math.max(0, 100 - diff * 200); // Higher score for closer match

        return {
          id: q.id,
          complexity,
          cognitiveLoad: q.cognitiveLoad!,
          reasoningDepth: q.reasoningDepth!,
          difficulty: q.difficulty,
          hasFeatures: true,
          matchScore,
        } as QuestionRecommendation;
      });

      // Sort by match score
      scored.sort((a, b) => b.matchScore - a.matchScore);

      return NextResponse.json({
        success: true,
        data: {
          recommendations: scored.slice(0, 10),
          targetDifficulty,
          matchedCount: scored.length,
        },
      });
    }

    // 4. No knowledge point specified - return questions with features
    const questions = await prisma.question.findMany({
      where: {
        extractionStatus: 'SUCCESS',
        complexity: { not: null },
        id: { notIn: excludeQuestionIds },
      },
      select: {
        id: true,
        complexity: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        difficulty: true,
        content: true,
      },
      take: 100,
      orderBy: { featuresExtractedAt: 'desc' },
    });

    // Score based on target difficulty
    const scored = questions
      .map(q => {
        const complexity = q.complexity!;
        const diff = Math.abs(complexity - targetDifficulty);
        const matchScore = Math.max(0, 100 - diff * 200);

        return {
          id: q.id,
          complexity,
          cognitiveLoad: q.cognitiveLoad!,
          reasoningDepth: q.reasoningDepth!,
          difficulty: q.difficulty,
          hasFeatures: true,
          matchScore,
        } as QuestionRecommendation;
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    // 5. Return statistics and recommendations
    const stats = {
      totalWithFeatures: questions.length,
      avgComplexity: questions.reduce((s, q) => s + q.complexity!, 0) / questions.length,
      complexityDistribution: {
        low: questions.filter(q => q.complexity! < 0.3).length,
        medium: questions.filter(q => q.complexity! >= 0.3 && q.complexity! < 0.7).length,
        high: questions.filter(q => q.complexity! >= 0.7).length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        recommendations: scored.slice(0, 20),
        stats,
        targetDifficulty,
      },
    });

  } catch (error) {
    console.error('推荐题目错误:', error);
    return NextResponse.json(
      { success: false, error: '推荐失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/learning-path/recommend
 *
 * Get complexity statistics overview.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Get overall statistics
    const [total, withFeatures, avgStats] = await Promise.all([
      prisma.question.count(),
      prisma.question.count({ where: { extractionStatus: 'SUCCESS', complexity: { not: null } } }),
      prisma.question.aggregate({
        where: { extractionStatus: 'SUCCESS', complexity: { not: null } },
        _avg: { complexity: true, cognitiveLoad: true, reasoningDepth: true },
        _min: { complexity: true },
        _max: { complexity: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalQuestions: total,
        questionsWithFeatures: withFeatures,
        featureCoverage: total > 0 ? (withFeatures / total * 100).toFixed(1) + '%' : '0%',
        averageComplexity: avgStats._avg.complexity?.toFixed(3) || '-',
        averageCognitiveLoad: avgStats._avg.cognitiveLoad?.toFixed(3) || '-',
        averageReasoningDepth: avgStats._avg.reasoningDepth?.toFixed(3) || '-',
        complexityRange: {
          min: avgStats._min.complexity?.toFixed(3) || '-',
          max: avgStats._max.complexity?.toFixed(3) || '-',
        },
      },
    });

  } catch (error) {
    console.error('获取复杂度统计错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
