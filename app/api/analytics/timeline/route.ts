import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/timeline - 学习时间线
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取时间范围内的练习记录（只计算有效完成记录）
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { gte: startDate },
        score: { gt: 0 },  // 只计算有分数的记录
      },
      include: {
        steps: {
          select: {
            isCorrect: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // 按日期分组统计
    const dailyStats = new Map<string, {
      count: number;
      totalScore: number;
      totalDuration: number;
      correctSteps: number;
      totalSteps: number;
    }>();

    attempts.forEach((attempt: { completedAt: Date | null; score: number; duration: number; steps: { isCorrect: boolean }[] }) => {
      if (!attempt.completedAt) return;

      const dateStr = attempt.completedAt.toISOString().split('T')[0];
      const existing = dailyStats.get(dateStr) || {
        count: 0,
        totalScore: 0,
        totalDuration: 0,
        correctSteps: 0,
        totalSteps: 0,
      };

      existing.count++;
      existing.totalScore += attempt.score;
      existing.totalDuration += attempt.duration;
      existing.totalSteps += attempt.steps.length;
      existing.correctSteps += attempt.steps.filter((s: { isCorrect: boolean }) => s.isCorrect).length;

      dailyStats.set(dateStr, existing);
    });

    // 转换为数组并按日期排序，只返回有练习的天
    const timeline = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        avgScore: Math.round(stats.totalScore / stats.count),
        totalMinutes: Math.round(stats.totalDuration / 60),
        accuracy: Math.round((stats.correctSteps / stats.totalSteps) * 100),
      }))
      .filter(item => item.count > 0)  // 只返回有练习的天
      .sort((a, b) => a.date.localeCompare(b.date));

    // 计算整体趋势
    const totalAttempts = attempts.length;
    const avgScore =
      attempts.length > 0
        ? attempts.reduce((sum: number, a: { score: number }) => sum + a.score, 0) / attempts.length
        : 0;
    const totalMinutes =
      attempts.reduce((sum: number, a: { duration: number }) => sum + a.duration, 0) / 60;
    const allSteps = attempts.flatMap((a: { steps: { isCorrect: boolean }[] }) => a.steps);
    const overallAccuracy =
      allSteps.length > 0
        ? allSteps.filter((s: { isCorrect: boolean }) => s.isCorrect).length / allSteps.length
        : 0;

    // 找出连续练习天数
    let currentStreak = 0;
    let maxStreak = 0;
    let lastDate: string | null = null;

    const sortedDates = Array.from(dailyStats.keys()).sort().reverse();
    const today = new Date().toISOString().split('T')[0];

    for (const date of sortedDates) {
      if (!lastDate) {
        currentStreak = 1;
        lastDate = date;
      } else {
        const prevDate: Date = new Date(lastDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr: string = prevDate.toISOString().split('T')[0];

        if (date === prevDateStr) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = date === today ? 1 : 0;
        }
        lastDate = date;
      }
    }

    maxStreak = Math.max(maxStreak, currentStreak);

    return NextResponse.json({
      timeline,
      summary: {
        totalAttempts,
        avgScore: Math.round(avgScore),
        totalMinutes: Math.round(totalMinutes),
        overallAccuracy: Math.round(overallAccuracy * 100),
        currentStreak,
        maxStreak,
      },
    });
  } catch (error) {
    console.error('获取时间线数据错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
