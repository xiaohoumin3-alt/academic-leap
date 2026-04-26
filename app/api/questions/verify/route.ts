import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { judgeStep } from '@/lib/question-engine';
import { judgeStepV2 } from '@/lib/question-engine/judge-v2';
import { calculateBehaviorTag } from '@/lib/adaptive-difficulty';
import type { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

// POST /api/questions/verify - 使用判题引擎批改答案
export async function POST(req: NextRequest) {
  const { questionId, stepNumber, userAnswer, duration } = await req.json();

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 验证参数
    if (userAnswer === undefined || !stepNumber) {
      return NextResponse.json(
        { error: '缺少必要参数', success: false },
        { status: 400 }
      );
    }

    // 从数据库获取题目和步骤
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      // 如果是本地题目（ID 以 local_ 开头），返回友好错误而不是"不存在"
      if (questionId?.startsWith('local_')) {
        return NextResponse.json({
          error: '本地题目不支持在线验证，请刷新页面重新生成题目',
          success: false,
          requiresRegenerate: true,
        }, { status: 400 });
      }
      return NextResponse.json({ error: '题目不存在', success: false }, { status: 404 });
    }

    // 检查是否是旧格式题目（没有templateId）
    if (!question.templateId) {
      return NextResponse.json({
        error: '该题目使用旧格式，请重新生成',
        success: false,
        requiresRegenerate: true,
      }, { status: 400 });
    }

    const step = await prisma.questionStep.findFirst({
      where: {
        questionId,
        stepNumber,
      },
    });

    if (!step) {
      return NextResponse.json({ error: '步骤不存在', success: false }, { status: 404 });
    }

    // 解析参数和步骤类型
    const params = JSON.parse(question.params || '{}');
    const stepType = step.type as any;

    // 检测协议版本：v2 协议的 type 字段为 'v2' 且 answer 包含 expectedAnswer
    const stepAnswer = JSON.parse(step.answer || '{}');
    const isV2 = step.type === 'v2' || 'expectedAnswer' in stepAnswer;

    let result;

    if (isV2 && stepAnswer.expectedAnswer) {
      // v2 协议：构建 StepProtocolV2
      const v2Step: StepProtocolV2 = {
        stepId: `s${stepNumber}`,
        answerMode: (stepAnswer as any).answerMode || 'text',
        ui: {
          instruction: step.expression,
          inputPlaceholder: '',
          hint: step.hint || '',
        },
        expectedAnswer: stepAnswer.expectedAnswer,
        keyboard: step.keyboard
          ? { type: step.keyboard as any, extraKeys: [] }
          : undefined,
        options: (stepAnswer as any).options,
      };
      result = judgeStepV2(v2Step, userAnswer, duration);
    } else {
      // v1 协议：使用原有逻辑
      result = judgeStep(
        {
          stepId: `s${stepNumber}`,
          type: stepType,
          inputType: (step.inputType as any) || 'numeric',
          keyboard: (step.keyboard as any) || 'numeric',
          answerType: 'number',
          tolerance: step.tolerance ?? undefined,
          ui: {
            instruction: step.expression,
            inputTarget: '',
            inputHint: step.hint || '',
          },
        },
        params,
        userAnswer,
        duration
      );
    }

    // 返回判题结果，包含correctAnswer
    return NextResponse.json({
      isCorrect: result.isCorrect,
      correctAnswer: result.correctAnswer,
      errorType: result.errorType,
      behaviorTag: result.behaviorTag,
      feedback: result.hint || (result.isCorrect ? '正确！' : '答案错误'),
      success: true,
    });
  } catch (error) {
    console.error('批改答案错误:', error);

    // 不再有降级方案 - 直接返回错误
    return NextResponse.json({
      isCorrect: false,
      feedback: '批改失败，请稍后重试',
      behaviorTag: calculateBehaviorTag(duration || 0, false),
      success: false,
    }, { status: 500 });
  }
}
