/**
 * UOK Answer API - Submit answer and get feedback
 *
 * POST /api/uok/answer - Submit answer and get feedback with before/after comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUOKFlowService } from '@/lib/qie/uok-flow-service';

/**
 * POST /api/uok/answer
 *
 * Submit answer and get feedback with before/after comparison
 */
export async function POST(req: NextRequest) {
  console.log('[UOK Answer] Request received');
  try {
    const session = await auth();
    console.log('[UOK Answer] Session:', session?.user?.id ? 'logged in' : 'not logged in');
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, isCorrect } = body;
    console.log('[UOK Answer] questionId:', questionId, 'isCorrect:', isCorrect);

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
    console.log('[UOK Answer] feedback:', feedback);

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('[UOK Answer] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提交答案失败' },
      { status: 500 }
    );
  }
}