import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplexityExtractor } from '@/lib/qie/complexity-extractor';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { questionId, content } = await req.json();

    if (!questionId || !content) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const extractor = new ComplexityExtractor();
    const result = await extractor.extract(questionId, content);

    // Update database
    await prisma.question.update({
      where: { id: questionId },
      data: {
        cognitiveLoad: result.features.cognitiveLoad,
        reasoningDepth: result.features.reasoningDepth,
        complexity: result.features.complexity,
        extractionStatus: 'SUCCESS',
        featuresExtractedAt: new Date(),
        extractionModel: 'gemma-4-31b-it-v1',
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('提取失败:', error);

    // Mark as failed
    const { questionId } = await req.json().catch(() => ({}));
    if (questionId) {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          extractionStatus: 'FAILED',
          extractionError: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      { error: '提取失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
