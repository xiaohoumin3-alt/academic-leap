import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/analytics/knowledge - 知识点掌握情况
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取所有知识点掌握度
    const knowledge = await prisma.userKnowledge.findMany({
      where: { userId },
      orderBy: { mastery: 'asc' }, // 从低到高排序，优先显示薄弱项
    });

    // 按掌握度分组
    const mastered = knowledge.filter((k: { mastery: number }) => k.mastery >= 0.8);
    const learning = knowledge.filter((k: { mastery: number }) => k.mastery >= 0.5 && k.mastery < 0.8);
    const weak = knowledge.filter((k: { mastery: number }) => k.mastery < 0.5);

    // 获取各知识点最近练习记录
    const knowledgeWithRecent = await Promise.all(
      knowledge.map(async (k) => {
        const recentSteps = await prisma.attemptStep.findMany({
          where: {
            attempt: {
              userId,
              completedAt: { not: null },
            },
          },
          take: 10,
          orderBy: { submittedAt: 'desc' },
        });

        const correctCount = recentSteps.filter((s: { isCorrect: boolean }) => s.isCorrect).length;
        const recentAccuracy = recentSteps.length > 0 ? correctCount / recentSteps.length : 0;

        return {
          knowledgePoint: k.knowledgePoint,
          mastery: Math.round(k.mastery * 100),
          practiceCount: k.practiceCount,
          lastPractice: k.lastPractice,
          recentAccuracy: Math.round(recentAccuracy * 100),
        };
      })
    );

    return NextResponse.json({
      knowledge: knowledgeWithRecent,
      summary: {
        total: knowledge.length,
        mastered: mastered.length,
        learning: learning.length,
        weak: weak.length,
      },
    });
  } catch (error) {
    console.error('获取知识点数据错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
