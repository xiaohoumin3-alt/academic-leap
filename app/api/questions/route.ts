import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/questions - 获取题目列表
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: any = {};
    if (type) where.type = type;
    if (difficulty) where.difficulty = parseInt(difficulty);

    const questions = await prisma.question.findMany({
      where,
      take: limit,
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('获取题目错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST /api/questions - 创建题目（管理员）
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // TODO: 检查是否为管理员

    const { type, difficulty, content, answer, hint, knowledgePoints, steps } = await req.json();

    const question = await prisma.question.create({
      data: {
        type,
        difficulty,
        content,
        answer,
        hint,
        knowledgePoints,
        createdBy: session.user.id,
        isAI: false,
        steps: {
          create: steps?.map((step: any, index: number) => ({
            stepNumber: index + 1,
            expression: step.expression,
            answer: step.answer,
            hint: step.hint,
          })) || [],
        },
      },
      include: {
        steps: true,
      },
    });

    return NextResponse.json({ question, success: true });
  } catch (error) {
    console.error('创建题目错误:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
