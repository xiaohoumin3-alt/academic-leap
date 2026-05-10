/**
 * UOK Flow API - Complete recommendation + learning + feedback loop
 *
 * GET  /api/uok/recommend - Get next question with ML prediction
 * POST /api/uok/recommend - Get multiple questions for practice
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUOKFlowService } from '@/lib/qie/uok-flow-service';

/**
 * GET /api/uok/recommend
 *
 * Get next recommended question with ML prediction and rationale
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const excludeIds = searchParams.get('exclude')?.split(',') ?? [];

    const service = getUOKFlowService();
    const recommendation = await service.getRecommendation(
      session.user.id,
      excludeIds
    );

    if (!recommendation) {
      return NextResponse.json(
        { error: '没有可用的推荐题目' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      questionId: recommendation.questionId,
      questionData: recommendation.questionData,
      rationale: recommendation.rationale,
      beforeProbability: recommendation.beforeProbability,
    });
  } catch (error) {
    console.error('UOK recommend error:', error);
    return NextResponse.json(
      { error: '获取推荐失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/uok/recommend
 *
 * Get multiple questions for practice mode
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const count = typeof body.count === 'number' ? body.count : 3;
    const excludeIds = Array.isArray(body.excludeIds) ? body.excludeIds : [];

    const service = getUOKFlowService();
    console.log('[UOK Recommend POST] userId:', session.user.id, 'count:', count);

    // 检查用户是否已完成诊断测评
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { initialAssessmentCompleted: true },
    });

    if (!user?.initialAssessmentCompleted) {
      return NextResponse.json({
        success: false,
        code: 'NEEDS_DIAGNOSTIC',
        error: '请先完成诊断测评',
        message: '在开始练习之前，需要先完成诊断测评以确定您的学习起点',
      }, { status: 400 });
    }

    // 检查是否有活跃的学习路径
    const activePath = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active',
      },
      select: { id: true },
    });

    if (!activePath) {
      return NextResponse.json({
        success: false,
        code: 'NO_LEARNING_PATH',
        error: '未找到活跃的学习路径',
        message: '请先完成诊断测评（60-89分）以生成学习路径',
      }, { status: 400 });
    }

    // 添加详细调试：检查UOK状态
    const { UOK } = await import('@/lib/qie/uok');
    const uok = new UOK();
    await uok.getOrCreateStudentWithState(session.user.id);
    const action = uok.act('next_question', session.user.id);
    console.log('[UOK Recommend POST] action.type:', action.type);
    console.log('[UOK Recommend POST] action:', JSON.stringify(action));

    const questions: any[] = [];

    for (let i = 0; i < count; i++) {
      const recommendation = await service.getRecommendation(
        session.user.id,
        excludeIds
      );

      console.log('[UOK Recommend POST] recommendation', i, ':', recommendation ? 'found' : 'null');
      if (recommendation) {
        questions.push({
          id: recommendation.questionId,
          type: recommendation.questionData.type,
          content: recommendation.questionData.content,
          answer: recommendation.questionData.answer,
          options: recommendation.questionData.options,
          explanation: recommendation.questionData.explanation,
          difficulty: recommendation.questionData.difficulty,
          rationale: recommendation.rationale,
          beforeProbability: recommendation.beforeProbability,
        });
        excludeIds.push(recommendation.questionId);
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: '没有可用的推荐题目' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error('UOK recommend POST error:', error);
    return NextResponse.json(
      { error: '获取推荐失败' },
      { status: 500 }
    );
  }
}
