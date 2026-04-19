import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/overview - 学习概览数据
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取总练习次数
    const totalAttempts = await prisma.attempt.count({
      where: { userId },
    });

    // 获取已完成练习次数
    const completedAttempts = await prisma.attempt.count({
      where: {
        userId,
        completedAt: { not: null },
      },
    });

    // 获取平均分数
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
      },
      select: { score: true },
    });

    const averageScore =
      attempts.length > 0
        ? attempts.reduce((sum: number, a: { score: number }) => sum + a.score, 0) / attempts.length
        : 0;

    // 获取总练习时长（分钟）
    const totalDuration = await prisma.attempt.aggregate({
      where: {
        userId,
        completedAt: { not: null },
      },
      _sum: { duration: true },
    });

    const totalMinutes = Math.floor((totalDuration._sum.duration || 0) / 60);

    // 获取最近7天的练习记录
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        score: true,
        duration: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    // 计算每日练习数据
    const dailyData = Array.from({ length: 7 }, (_: unknown, i: number) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayAttempts = recentAttempts.filter(
        (a) => a.completedAt?.toISOString().split('T')[0] === dateStr
      );

      return {
        date: dateStr,
        count: dayAttempts.length,
        avgScore:
          dayAttempts.length > 0
            ? dayAttempts.reduce((sum: number, a: { score: number }) => sum + a.score, 0) / dayAttempts.length
            : 0,
      };
    });

    // 获取知识点掌握度
    const knowledge = await prisma.userKnowledge.findMany({
      where: { userId },
      orderBy: { mastery: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      overview: {
        totalAttempts,
        completedAttempts,
        averageScore: Math.round(averageScore),
        totalMinutes,
        completionRate:
          totalAttempts > 0
            ? Math.round((completedAttempts / totalAttempts) * 100)
            : 0,
      },
      dailyData,
      topKnowledge: knowledge.map((k: { knowledgePoint: string; mastery: number }) => ({
        knowledgePoint: k.knowledgePoint,
        mastery: Math.round(k.mastery * 100),
      })),
    });
  } catch (error) {
    console.error('获取概览数据错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
