import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/stats - 获取学习统计
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取总练习次数（不限制数量）
    const totalAttempts = await prisma.attempt.count({
      where: { userId, completedAt: { not: null } },
    });

    // 获取最近 10 条练习记录用于计算详情
    const recentAttempts = await prisma.attempt.findMany({
      where: { userId, completedAt: { not: null } },
      include: {
        steps: {
          select: { isCorrect: true },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    // 获取全部答题统计（所有练习的所有 steps）
    const allStepsCount = await prisma.attemptStep.count({
      where: {
        attempt: { userId, completedAt: { not: null } },
      },
    });

    const correctStepsCount = await prisma.attemptStep.count({
      where: {
        attempt: { userId, completedAt: { not: null } },
        isCorrect: true,
      },
    });

    const avgScore = recentAttempts.length > 0
      ? Math.round(recentAttempts.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / recentAttempts.length)
      : 0;

    const currentScore = recentAttempts.length > 0
      ? Math.round(recentAttempts[0].score || 0)
      : 60;

    const stats = {
      currentScore,
      targetScore: 90,
      totalAttempts,
      avgScore,
      totalQuestions: allStepsCount,
      correctRate: allStepsCount > 0 ? Math.round((correctStepsCount / allStepsCount) * 100) : 0,
      recentAttempts: recentAttempts.slice(0, 10),
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('获取学习统计错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
