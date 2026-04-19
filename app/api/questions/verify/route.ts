import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyAnswer, calculateBehaviorTag } from '@/lib/gemini';

// POST /api/questions/verify - AI批改答案
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { questionId, stepNumber, userAnswer, duration } = await req.json();

    // 验证参数
    if (userAnswer === undefined || !stepNumber) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    let correctAnswer: string | undefined;
    let expression: string | undefined;
    let questionContext: string | undefined;

    // 如果有questionId，从数据库获取正确答案
    if (questionId) {
      const step = await prisma.questionStep.findFirst({
        where: {
          questionId,
          stepNumber,
        },
      });

      if (step) {
        correctAnswer = step.answer;
        expression = step.expression;
      }

      const question = await prisma.question.findUnique({
        where: { id: questionId },
      });

      if (question) {
        const content = question.content as { description?: string } | null;
        questionContext = content?.description;
      }
    }

    // 调用Gemini API批改
    const result = await verifyAnswer({
      questionId,
      stepNumber,
      userAnswer,
      questionContext,
      correctAnswer,
      expression,
    });

    // 计算行为标签
    const behaviorTag = calculateBehaviorTag(duration || 0);

    return NextResponse.json({
      ...result,
      behaviorTag,
      success: true,
    });
  } catch (error) {
    console.error('批改答案错误:', error);

    // API失败时使用简单字符串匹配作为降级方案
    const { questionId, stepNumber, userAnswer, duration } = await req.json();

    let isCorrect = false;
    let feedback = '';

    if (questionId) {
      const step = await prisma.questionStep.findFirst({
        where: {
          questionId,
          stepNumber,
        },
      });

      if (step) {
        isCorrect = userAnswer.trim() === step.answer;
        feedback = isCorrect
          ? '正确！'
          : `答案错误。提示：${step.hint || '请仔细检查计算过程'}`;
      }
    } else {
      // 降级示例答案
      const correctAnswers: Record<number, string> = {
        1: '1/4',
        2: '19/4',
        3: '19/6',
      };
      isCorrect = userAnswer.trim() === (correctAnswers[stepNumber] || '');
      feedback = isCorrect ? '正确！' : '答案错误，请重新计算';
    }

    const behaviorTag = calculateBehaviorTag(duration || 0);

    return NextResponse.json({
      isCorrect,
      feedback,
      behaviorTag,
      success: true,
      fallback: true,
    });
  }
}
