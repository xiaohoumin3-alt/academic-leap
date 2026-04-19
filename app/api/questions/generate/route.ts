import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQuestions } from '@/lib/gemini';

// POST /api/questions/generate - AI生成新题目
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { type, difficulty, knowledgePoint, count = 1 } = await req.json();

    // 验证参数
    if (!type || !difficulty || !knowledgePoint) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 调用Gemini API生成题目
    const questions = await generateQuestions({
      type,
      difficulty,
      knowledgePoint,
      count,
    });

    // 保存到数据库
    const savedQuestions = await Promise.all(
      questions.map(async (q) => {
        const question = await prisma.question.create({
          data: {
            type: q.type,
            difficulty: q.difficulty,
            content: q.content as any,
            answer: q.answer,
            hint: q.hint,
            knowledgePoints: JSON.stringify(q.knowledgePoints),
            isAI: true,
          },
        });

        // 保存步骤
        await prisma.questionStep.createMany({
          data: q.steps.map((step) => ({
            questionId: question.id,
            stepNumber: step.stepNumber,
            expression: step.expression,
            answer: step.answer,
            hint: step.hint,
          })),
        });

        return question;
      })
    );

    return NextResponse.json({
      success: true,
      questions: savedQuestions,
    });
  } catch (error) {
    console.error('生成题目错误:', error);

    // API失败时返回示例题目作为降级方案
    const { type, difficulty, knowledgePoint, count = 1 } = await req.json().catch(() => ({}));

    const fallbackQuestions = Array.from({ length: count }, (_, i) => ({
      id: `fallback_${Date.now()}_${i}`,
      type: type || 'calculation',
      difficulty: difficulty || 2,
      content: {
        title: '分数四则运算',
        description: '计算以下表达式的值',
        context: '基础数学练习',
      },
      answer: '1/4',
      hint: '先计算括号内，再进行除法',
      knowledgePoints: knowledgePoint ? [knowledgePoint] : ['分数运算'],
      steps: [
        {
          stepNumber: 1,
          expression: '(1/2) ÷ 2 =',
          answer: '1/4',
          hint: '除以2等于乘以1/2',
        },
        {
          stepNumber: 2,
          expression: '5 - 1/4 =',
          answer: '19/4',
          hint: '整数减分数，先通分',
        },
        {
          stepNumber: 3,
          expression: '(2/3) × 19/4 =',
          answer: '19/6',
          hint: '分子相乘，分母相乘',
        },
      ],
      isAI: true,
    }));

    return NextResponse.json({
      success: true,
      questions: fallbackQuestions,
      fallback: true,
    });
  }
}
