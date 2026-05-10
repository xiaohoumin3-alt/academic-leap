/**
 * UOK Diagnostic API - Get diagnostic questions for assessment
 *
 * POST /api/uok/diagnostic - Get fixed-difficulty diagnostic questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUOKFlowService } from '@/lib/qie/uok-flow-service';

/**
 * POST /api/uok/diagnostic
 *
 * Get diagnostic questions for assessment flow
 *
 * Body:
 *   - count: number of questions to return (default: 10)
 *   - mode: 'diagnostic' for fixed-difficulty diagnostic questions
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const count = body.count || 10;
    const mode = body.mode || 'diagnostic';

    const service = getUOKFlowService();

    // Get multiple questions for diagnostic mode
    const questions: any[] = [];
    const excludeIds: string[] = [];

    for (let i = 0; i < count; i++) {
      const recommendation = await service.getRecommendation(
        session.user.id,
        excludeIds
      );

      if (!recommendation) {
        break;
      }

      questions.push(recommendation.questionData);
      excludeIds.push(recommendation.questionId);
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: '没有可用的诊断题目' },
        { status: 404 }
      );
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('UOK diagnostic error:', error);
    return NextResponse.json(
      { error: '获取诊断题目失败' },
      { status: 500 }
    );
  }
}