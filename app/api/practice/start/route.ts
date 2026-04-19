import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/practice/start - 开始练习
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { mode, questionId } = await req.json();

    // 创建练习记录
    const attempt = await prisma.attempt.create({
      data: {
        userId: session.user.id,
        mode: mode || 'training',
        score: 0,
        duration: 0,
      },
    });

    return NextResponse.json({
      attemptId: attempt.id,
      success: true,
    });
  } catch (error) {
    console.error('开始练习错误:', error);
    return NextResponse.json({ error: '开始失败' }, { status: 500 });
  }
}
