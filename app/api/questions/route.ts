import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

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
      select: {
        id: true,
        type: true,
        difficulty: true,
        content: true,
        answer: true,
        hint: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        complexity: true,
        createdAt: true,
        questionKnowledgePoints: {
          select: {
            knowledgePointId: true,
            knowledgePoint: {
              select: { id: true, name: true },
            },
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
      },
    });

    // 格式化知识点为字符串数组
    const formattedQuestions = questions.map(q => ({
      ...q,
      knowledgePoints: q.questionKnowledgePoints.map(kp => kp.knowledgePoint?.name || kp.knowledgePointId),
    }));

    return NextResponse.json({ questions: formattedQuestions });
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

    await requireAdmin('editor');

    const { type, difficulty, content, answer, hint, knowledgePoints: kpNames, steps } = await req.json();

    // 创建题目
    const question = await prisma.question.create({
      data: {
        type,
        difficulty,
        content,
        answer,
        hint,
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

    // 关联知识点（如果提供）
    if (kpNames && Array.isArray(kpNames) && kpNames.length > 0) {
      const knowledgePoints = await prisma.knowledgePoint.findMany({
        where: { name: { in: kpNames } },
        select: { id: true, name: true },
      });

      const kpIdMap = new Map(knowledgePoints.map(kp => [kp.name, kp.id]));

      for (const kpName of kpNames) {
        const kpId = kpIdMap.get(kpName);
        if (kpId) {
          await prisma.questionKnowledgePoint.create({
            data: {
              questionId: question.id,
              knowledgePointId: kpId,
            },
          });
        }
      }
    }

    return NextResponse.json({ question, success: true });
  } catch (error) {
    console.error('创建题目错误:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
