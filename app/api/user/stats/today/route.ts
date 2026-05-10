import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/user/stats/today - 获取今日学习统计
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取今日开始时间（北京时间 UTC+8）
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(todayStart.getHours() - 8); // 转换为 UTC
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 统计今日完成的题目数
    const todayStepsCount = await prisma.attemptStep.count({
      where: {
        attempt: {
          userId,
          completedAt: {
            not: null,
            gte: todayStart,
            lt: todayEnd,
          },
        },
      },
    });

    // 统计今日正确的题目数
    const todayCorrectCount = await prisma.attemptStep.count({
      where: {
        attempt: {
          userId,
          completedAt: {
            not: null,
            gte: todayStart,
            lt: todayEnd,
          },
        },
        isCorrect: true,
      },
    });

    // 计算今日获得的 XP（基于完成题目数和正确率）
    const baseXP = todayStepsCount * 5;
    const accuracyBonus = todayStepsCount > 0
      ? Math.round((todayCorrectCount / todayStepsCount) * 10)
      : 0;
    const todayXP = baseXP + accuracyBonus;

    // 今日目标配置
    const dailyGoalQuestions = 10;
    const dailyGoalAccuracy = 80;

    const stats = {
      questionCount: todayStepsCount,
      accuracy: todayStepsCount > 0
        ? Math.round((todayCorrectCount / todayStepsCount) * 100)
        : 0,
      xpEarned: todayXP,
      goal: {
        target: dailyGoalQuestions,
        current: todayStepsCount,
        accuracy: dailyGoalAccuracy,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取今日统计错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
