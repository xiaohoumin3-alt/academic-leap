/**
 * UOK-Powered Next Question API
 *
 * GET /api/practice/next-question - Get next recommended question
 * POST /api/practice/next-question/answer - Encode answer to UOK (triggers learning)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getNextQuestion,
  encodeAnswerToUOK,
} from '@/lib/qie/recommendation-service';

/**
 * GET /api/practice/next-question
 *
 * Get next question using UOK recommendation engine
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const excludeIds = searchParams.get('exclude')?.split(',') ?? [];

    // Get enabled knowledge points filter
    const kpRes = await fetch(`${req.nextUrl.origin}/api/user/knowledge/enabled`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
    });

    let knowledgeFilter: string[] | undefined = undefined;
    if (kpRes.ok) {
      const data = await kpRes.json();
      knowledgeFilter = data.enabledKnowledgePoints ?? undefined;
    }

    const result = await getNextQuestion({
      studentId: session.user.id,
      excludeQuestionIds: excludeIds,
      knowledgePointFilter: knowledgeFilter,
    });

    if (!result.success || !result.question) {
      return NextResponse.json(
        { error: result.error || '获取题目失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      question: result.question,
      rationale: result.rationale,
    });
  } catch (error) {
    console.error('Next question error:', error);
    return NextResponse.json(
      { error: '获取题目失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/practice/next-question/answer
 *
 * Encode answer to UOK (triggers ML learning)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { questionId, correct } = body;

    if (!questionId || typeof correct !== 'boolean') {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const result = await encodeAnswerToUOK(
      session.user.id,
      questionId,
      correct
    );

    return NextResponse.json({
      success: true,
      probability: result.probability,
    });
  } catch (error) {
    console.error('Encode answer error:', error);
    return NextResponse.json(
      { error: '记录答案失败' },
      { status: 500 }
    );
  }
}
