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

    // 获取用户选择的教材
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTextbookId: true },
    });

    // 获取用户选择的教材对应的知识点（按教材过滤）
    const knowledgePointWhere: any = {
      status: 'active',
      inAssess: true,
      deletedAt: null,
    };

    // 如果用户已选择教材，只获取该教材的知识点
    if (user?.selectedTextbookId) {
      knowledgePointWhere.chapter = {
        textbookId: user.selectedTextbookId,
      };
    }

    const activeKnowledgePoints = await prisma.knowledgePoint.findMany({
      where: knowledgePointWhere,
      select: { name: true },
      orderBy: { weight: 'desc' },
    });

    const activePointNames = activeKnowledgePoints.map((kp) => kp.name);

    // 获取用户在这些知识点上的掌握度
    const userKnowledge = await prisma.userKnowledge.findMany({
      where: {
        userId,
        knowledgePoint: { in: activePointNames }, // 只查询活跃的知识点
      },
      orderBy: { mastery: 'asc' },
    });

    let knowledgeWithRecent;
    let mastered: any[] = [];
    let learning: any[] = [];
    let weak: any[] = [];

    // 如果用户没有练习记录，返回所有活跃知识点供随机选择
    if (userKnowledge.length === 0) {
      knowledgeWithRecent = activeKnowledgePoints.map((kp) => ({
        knowledgePoint: kp.name,
        mastery: 0,
        practiceCount: 0,
        lastPractice: null,
        recentAccuracy: 0,
      }));
      weak = knowledgeWithRecent;
    } else {
      // 为每个活跃知识点创建记录（如果没有用户数据，使用默认值）
      knowledgeWithRecent = await Promise.all(
        activeKnowledgePoints.map(async (kp) => {
          const uk = userKnowledge.find((u) => u.knowledgePoint === kp.name);

          if (!uk) {
            // 用户还没有这个知识点的记录
            return {
              knowledgePoint: kp.name,
              mastery: 0,
              practiceCount: 0,
              lastPractice: null,
              recentAccuracy: 0,
            };
          }

          // 获取该知识点最近练习记录
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
            knowledgePoint: kp.name,
            mastery: Math.round(uk.mastery * 100),
            practiceCount: uk.practiceCount,
            lastPractice: uk.lastPractice,
            recentAccuracy: Math.round(recentAccuracy * 100),
          };
        })
      );

      // 按掌握度分组
      mastered = knowledgeWithRecent.filter((k: any) => k.mastery >= 80);
      learning = knowledgeWithRecent.filter((k: any) => k.mastery >= 50 && k.mastery < 80);
      weak = knowledgeWithRecent.filter((k: any) => k.mastery < 50);
    }

    return NextResponse.json({
      knowledge: knowledgeWithRecent,
      summary: {
        total: knowledgeWithRecent.length,
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
