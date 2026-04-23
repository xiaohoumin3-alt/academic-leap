import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/recommendations - AI学习建议
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取用户学习数据
    const [knowledge, recentAttempts, user] = await Promise.all([
      prisma.userKnowledge.findMany({
        where: { userId },
        orderBy: { mastery: 'asc' },
      }),
      prisma.attempt.findMany({
        where: {
          userId,
          completedAt: { not: null },
          score: { gt: 0 },  // 只计算有效练习
        },
        include: {
          steps: {
            select: {
              isCorrect: true,
              duration: true,
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { grade: true, targetScore: true },
      }),
    ]);

    // 分析薄弱知识点
    const weakKnowledge = knowledge.filter((k: { mastery: number }) => k.mastery < 0.5);
    const learningKnowledge = knowledge.filter(
      (k: { mastery: number }) => k.mastery >= 0.5 && k.mastery < 0.8
    );

    // 分析最近表现趋势
    const recentScores = recentAttempts.map((a: { score: number }) => a.score);
    const avgRecentScore =
      recentScores.length > 0
        ? recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length
        : 0;

    // 分析答题速度
    const allSteps = recentAttempts.flatMap((a: { steps: { duration: number }[] }) => a.steps);
    const avgDuration =
      allSteps.length > 0
        ? allSteps.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0) / allSteps.length
        : 0;

    const speedAnalysis = {
      avgDuration: Math.round(avgDuration / 1000), // 转为秒
      level: avgDuration < 10000 ? 'fast' : avgDuration < 20000 ? 'normal' : 'slow',
    };

    // 生成建议
    const recommendations: {
      type: 'practice' | 'review' | 'challenge' | 'tip';
      title: string;
      description: string;
      priority: number;
    }[] = [];

    // 薄弱知识点建议
    if (weakKnowledge.length > 0) {
      recommendations.push({
        type: 'practice',
        title: '重点练习',
        description: `建议重点练习以下薄弱知识点：${weakKnowledge
          .slice(0, 3)
          .map((k: { knowledgePoint: string }) => k.knowledgePoint)
          .join('、')}`,
        priority: 1,
      });
    }

    // 提升中知识点建议
    if (learningKnowledge.length > 0) {
      recommendations.push({
        type: 'review',
        title: '巩固提升',
        description: `继续巩固以下知识点：${learningKnowledge
          .slice(0, 2)
          .map((k: { knowledgePoint: string }) => k.knowledgePoint)
          .join('、')}`,
        priority: 2,
      });
    }

    // 速度建议
    if (speedAnalysis.level === 'slow') {
      recommendations.push({
        type: 'tip',
        title: '提高速度',
        description: '平均答题时间较长，建议多做练习提高熟练度',
        priority: 3,
      });
    } else if (speedAnalysis.level === 'fast') {
      recommendations.push({
        type: 'challenge',
        title: '挑战更高难度',
        description: '你的答题速度很快，可以尝试更有挑战性的题目',
        priority: 3,
      });
    }

    // 目标分数建议
    if (user && avgRecentScore < user.targetScore) {
      const gap = user.targetScore - avgRecentScore;
      recommendations.push({
        type: 'tip',
        title: '目标达成',
        description: `距离目标分数${user.targetScore}还有${Math.round(
          gap
        )}分差距，继续加油！`,
        priority: 2,
      });
    }

    // 今日练习建议
    const todayRecommendations = weakKnowledge.slice(0, 3).map((k: { knowledgePoint: string }) => ({
      knowledgePoint: k.knowledgePoint,
      suggestedCount: 5,
      reason: '该知识点掌握度较低，需要重点练习',
    }));

    return NextResponse.json({
      recommendations: recommendations.sort((a, b) => a.priority - b.priority),
      todayPractice: todayRecommendations,
      insights: {
        weakPoints: weakKnowledge.map((k: { knowledgePoint: string }) => k.knowledgePoint),
        strongPoints: knowledge.filter((k: { mastery: number }) => k.mastery >= 0.8).map((k: { knowledgePoint: string }) => k.knowledgePoint),
        avgScore: Math.round(avgRecentScore),
        speedLevel: speedAnalysis.level,
      },
    });
  } catch (error) {
    console.error('获取建议数据错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
