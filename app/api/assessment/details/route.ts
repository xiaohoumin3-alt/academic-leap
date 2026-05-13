import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/assessment/details
 * 获取测评的详细信息，包括每道题的答题结果
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json({ error: '参数错误：缺少 attemptId' }, { status: 400 });
    }

    // 获取测评记录
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            questionStep: {
              include: {
                question: {
                  select: {
                    id: true,
                    content: true,
                    answer: true,
                    questionKnowledgePoints: {
                      select: {
                        knowledgePointId: true,
                        knowledgePoint: {
                          select: { id: true, name: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: '测评记录不存在' }, { status: 404 });
    }

    // 处理每道题的详细信息
    const questionResults = attempt.steps.map(step => {
      if (!step.questionStep || !step.questionStep.question) {
        return null;
      }

      const question = step.questionStep.question;

      // 解析知识点 - 使用 QuestionKnowledgePoint 关系
      const knowledgePoints: string[] = question.questionKnowledgePoints
        .map(kp => kp.knowledgePoint?.name || kp.knowledgePointId)
        .filter(Boolean);

      return {
        id: question.id,
        content: question.content,
        knowledgePoints,
        userAnswer: step.userAnswer,
        correctAnswer: step.questionStep.answer,
        isCorrect: step.isCorrect,
        duration: step.duration,
        stepNumber: step.stepNumber,
      };
    }).filter((q): q is NonNullable<typeof q> => q !== null);

    // 统计信息
    const totalQuestions = questionResults.length;
    const correctCount = questionResults.filter(q => q.isCorrect).length;
    const incorrectCount = totalQuestions - correctCount;
    const correctRate = totalQuestions > 0 ? (correctCount / totalQuestions * 100).toFixed(1) : 0;

    // 按知识点统计正确率
    const knowledgeStats: Record<string, { total: number; correct: number; rate: number }> = {};
    questionResults.forEach(q => {
      q.knowledgePoints.forEach(kp => {
        if (!knowledgeStats[kp]) {
          knowledgeStats[kp] = { total: 0, correct: 0, rate: 0 };
        }
        knowledgeStats[kp].total++;
        if (q.isCorrect) {
          knowledgeStats[kp].correct++;
        }
      });
    });

    // 计算每个知识点的正确率
    Object.keys(knowledgeStats).forEach(kp => {
      const stats = knowledgeStats[kp];
      stats.rate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          score: attempt.score,
          duration: attempt.duration,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
        },
        summary: {
          totalQuestions,
          correctCount,
          incorrectCount,
          correctRate: `${correctRate}%`,
        },
        questionResults,
        knowledgeStats,
      },
    });
  } catch (error) {
    console.error('获取测评详情错误:', error);
    return NextResponse.json({ success: false, error: '获取详情失败' }, { status: 500 });
  }
}