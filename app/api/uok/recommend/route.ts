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

    // 获取用户最近做过的题目（避免重复推荐）
    // 从 PracticeSession 获取最近7天的练习记录
    const recentSessions = await prisma.practiceSession.findMany({
      where: {
        userId: session.user.id,
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 最近7天
      },
      select: { answers: true },
    });

    // 解析 answers 字段获取已做题目ID
    const recentlyDoneIds = new Set<string>();
    for (const session of recentSessions) {
      try {
        const answers = JSON.parse(session.answers);
        for (const answer of answers) {
          if (answer.questionId) {
            recentlyDoneIds.add(answer.questionId);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 同时从 Attempt 表获取历史记录（诊断测评等）
    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
      take: 100,
    });

    // 将 Attempt 关联的题目ID也加入排除列表（需要通过 AttemptStep 关联）
    const attemptStepIds = await prisma.attemptStep.findMany({
      where: {
        attemptId: { in: recentAttempts.map(a => a.id) },
      },
      select: { questionStepId: true },
    });

    for (const step of attemptStepIds) {
      if (step.questionStepId) {
        // 通过 QuestionStep 找到对应的 Question
        const question = await prisma.question.findFirst({
          where: {
            steps: { some: { id: step.questionStepId } },
          },
          select: { id: true },
        });
        if (question) {
          recentlyDoneIds.add(question.id);
        }
      }
    }

    // 合并所有排除ID
    const allExcludeIds = [...new Set([...excludeIds, ...Array.from(recentlyDoneIds)])];
    console.log('[UOK Recommend POST] Excluding', allExcludeIds.length, 'recently done questions');

    // Load student knowledge data for UOK (Phase 5: UOK doesn't call DB)
    const userKnowledgeRecords = await prisma.userKnowledge.findMany({
      where: { userId: session.user.id },
      select: {
        knowledgePointId: true,
        mastery: true,
      },
    });

    const knowledgeData = new Map<string, number>();
    for (const record of userKnowledgeRecords) {
      knowledgeData.set(record.knowledgePointId, record.mastery);
    }

    const questions: any[] = [];
    const sessionExcludeIds = [...allExcludeIds]; // 本次请求的排除列表

    for (let i = 0; i < count; i++) {
      const recommendation = await service.getRecommendation(
        session.user.id,
        sessionExcludeIds
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
        sessionExcludeIds.push(recommendation.questionId);
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
