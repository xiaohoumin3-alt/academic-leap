import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/practice/finish - 完成练习
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { attemptId, score, duration } = await req.json();

    // 更新练习记录
    const attempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        score,
        duration,
        completedAt: new Date(),
      },
      include: {
        steps: true,
      },
    });

    // 更新知识点掌握度
    const correctSteps = attempt.steps.filter(s => s.isCorrect);
    // TODO: 根据题目关联的知识点更新掌握度

    return NextResponse.json({
      success: true,
      attempt,
    });
  } catch (error) {
    console.error('完成练习错误:', error);
    return NextResponse.json({ error: '完成失败' }, { status: 500 });
  }
}
