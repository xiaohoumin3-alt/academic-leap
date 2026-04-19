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

    // 获取最近的练习记录
    const recentAttempts = await prisma.attempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        mode: true,
        score: true,
        duration: true,
        completedAt: true,
      },
    });

    // 计算统计数据
    const totalAttempts = await prisma.attempt.count({
      where: { userId, completedAt: { not: null } },
    });

    const avgScore = await prisma.attempt.aggregate({
      where: { userId, completedAt: { not: null } },
      _avg: { score: true },
    });

    // 获取知识点掌握情况
    const knowledge = await prisma.userKnowledge.findMany({
      where: { userId },
      orderBy: { mastery: 'asc' },
      take: 5,
    });

    // 计算当前水平（简化算法）
    const currentScore = recentAttempts.length > 0
      ? Math.round(recentAttempts[0].score)
      : 60;

    const stats = {
      currentScore,
      targetScore: 90,
      totalAttempts,
      avgScore: Math.round(avgScore._avg.score || 0),
      recentAttempts,
      weakKnowledge: knowledge.slice(0, 3),
      streak: 7, // TODO: 实际计算连续登录
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('获取学习统计错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
