import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/practice/submit - 提交单步答案
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { attemptId, stepNumber, userAnswer, isCorrect, duration } = await req.json();

    // 保存步骤记录
    const attemptStep = await prisma.attemptStep.create({
      data: {
        attemptId,
        stepNumber,
        userAnswer,
        isCorrect,
        duration,
      },
    });

    return NextResponse.json({
      success: true,
      attemptStep,
    });
  } catch (error) {
    console.error('提交答案错误:', error);
    return NextResponse.json({ error: '提交失败' }, { status: 500 });
  }
}
