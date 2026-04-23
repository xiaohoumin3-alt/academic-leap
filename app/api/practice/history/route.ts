import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/practice/history - 练习历史
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const attempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        steps: {
          include: {
            questionStep: {
              include: {
                question: {
                  select: {
                    id: true,
                    type: true,
                    difficulty: true,
                    content: true,
                    answer: true,
                    hint: true,
                    knowledgePoints: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error('获取练习历史错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
