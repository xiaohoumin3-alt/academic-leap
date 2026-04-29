/**
 * UOK Flow API - Complete recommendation + learning + feedback loop
 *
 * GET  /api/uok/recommend - Get next question with ML prediction
 * POST /api/uok/answer    - Submit answer and get feedback
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
 * POST /api/uok/answer
 *
 * Submit answer and get feedback with before/after comparison
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, isCorrect } = body;

    if (!questionId || typeof isCorrect !== 'boolean') {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const service = getUOKFlowService();
    const feedback = await service.submitAnswer(
      session.user.id,
      questionId,
      isCorrect
    );

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('UOK answer error:', error);
    return NextResponse.json(
      { error: '提交答案失败' },
      { status: 500 }
    );
  }
}
