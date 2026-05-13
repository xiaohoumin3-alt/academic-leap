/**
 * UOK Flow - Complete Practice Session
 * POST /api/uok/finish - Save completed practice session to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface StepResult {
  questionId: string;
  isCorrect: boolean;
  userAnswer: string;
  duration: number;
}

/**
 * POST /api/uok/finish
 *
 * Save a completed practice session
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json();
    const { steps, totalQuestions, correctCount, duration } = body as {
      steps: StepResult[];
      totalQuestions: number;
      correctCount: number;
      duration: number;
    };

    if (!steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: '缺少答题记录' }, { status: 400 });
    }

    const userId = session.user.id;

    // 1. 创建练习记录（mode = 'training'）
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const attempt = await prisma.attempt.create({
      data: {
        userId,
        mode: 'training', // 标记为练习模式，不是诊断测评
        score,
        duration: Math.floor(duration / 1000), // 转换为秒
        completedAt: new Date(),
      },
    });

    // 2. 创建 PracticeSession 记录（用于推荐时排除重复题目）
    // 查找或创建活跃的 PracticeSession
    let practiceSession = await prisma.practiceSession.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    const answersData = steps.map(s => ({
      questionId: s.questionId,
      isCorrect: s.isCorrect,
      userAnswer: s.userAnswer,
      duration: s.duration,
    }));

    if (practiceSession) {
      // 更新现有会话
      practiceSession = await prisma.practiceSession.update({
        where: { id: practiceSession.id },
        data: {
          answers: JSON.stringify(answersData),
          questionCount: totalQuestions,
          updatedAt: new Date(),
        },
      });
    } else {
      // 创建新会话
      practiceSession = await prisma.practiceSession.create({
        data: {
          userId,
          status: 'completed',
          currentQuestionIndex: totalQuestions,
          answers: JSON.stringify(answersData),
          questionCount: totalQuestions,
          completedAt: new Date(),
        },
      });
    }

    // 2. 创建答题步骤记录
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // 查找对应的 QuestionStep
      let questionStep = await prisma.questionStep.findFirst({
        where: { questionId: step.questionId },
        select: { id: true },
      });

      // 如果 QuestionStep 不存在，创建一个（修复数据完整性问题）
      if (!questionStep) {
        questionStep = await prisma.questionStep.create({
          data: {
            questionId: step.questionId,
            stepNumber: 1,
            expression: '',
            answer: '',
            type: 'auto-generated',
          },
          select: { id: true },
        });
      }

      await prisma.attemptStep.create({
        data: {
          attemptId: attempt.id,
          questionStepId: questionStep.id,
          stepNumber: i + 1,
          userAnswer: step.userAnswer,
          isCorrect: step.isCorrect,
          duration: Math.floor(step.duration / 1000),
        },
      });
    }

    // 3. 更新知识点掌握度
    await updateKnowledgeMastery(userId, attempt.id);

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      score,
      totalQuestions,
      correctCount,
    });
  } catch (error) {
    console.error('UOK finish error:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}

/**
 * 更新知识点掌握度
 */
async function updateKnowledgeMastery(userId: string, attemptId: string) {
  // 获取该 attempt 的所有 steps
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      steps: {
        include: {
          questionStep: {
            include: {
              question: {
                select: { knowledgePoints: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) return;

  // 按知识点聚合
  const knowledgeStats = new Map<string, { correct: number; total: number }>();

  for (const step of attempt.steps) {
    const kpValue = step.questionStep?.question?.knowledgePoints;
    let kpIds: unknown[] = [];
    if (Array.isArray(kpValue)) {
      kpIds = kpValue;
    } else if (typeof kpValue === 'string') {
      try {
        const parsed = JSON.parse(kpValue || '[]');
        if (Array.isArray(parsed)) kpIds = parsed;
      } catch { /* skip */ }
    }
    for (const kp of kpIds) {
      const id = typeof kp === 'string' ? kp : (kp as { id?: string }).id || (kp as { name?: string }).name || '';
      if (id) {
        const stats = knowledgeStats.get(id) || { correct: 0, total: 0 };
        stats.total += 1;
        if (step.isCorrect) stats.correct += 1;
        knowledgeStats.set(id, stats);
      }
    }
  }

  // 更新每个知识点的掌握度
  for (const [knowledgePointId, stats] of knowledgeStats.entries()) {
    const mastery = stats.total > 0 ? stats.correct / stats.total : 0;

    // 获取或创建用户知识点记录
    const existing = await prisma.userKnowledge.findUnique({
      where: {
        userId_knowledgePointId: {
          userId,
          knowledgePointId,
        },
      },
    });

    if (existing) {
      // 使用指数移动平均更新
      const newMastery = existing.mastery * 0.7 + mastery * 0.3;
      await prisma.userKnowledge.update({
        where: { id: existing.id },
        data: {
          mastery: newMastery,
          practiceCount: existing.practiceCount + stats.total,
          lastPractice: new Date(),
        },
      });
    } else {
      await prisma.userKnowledge.create({
        data: {
          userId,
          knowledgePointId,
          mastery,
          practiceCount: stats.total,
          lastPractice: new Date(),
        },
      });
    }
  }
}
