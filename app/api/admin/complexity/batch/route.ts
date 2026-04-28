import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplexityExtractor, QuestionContent } from '@/lib/qie/complexity-extractor';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { questions } = await req.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: '无效的题目列表' }, { status: 400 });
    }

    if (questions.length > 20) {
      return NextResponse.json({ error: '单次最多处理20道题' }, { status: 400 });
    }

    const extractor = new ComplexityExtractor();
    const items = questions.map((q: { id: string; content: QuestionContent }) => ({ id: q.id, content: q.content }));

    const results = await extractor.extractBatch(items);

    // Update database
    const updatePromises = Array.from(results.entries()).map(([id, result]) =>
      prisma.question.update({
        where: { id },
        data: {
          cognitiveLoad: result.features.cognitiveLoad,
          reasoningDepth: result.features.reasoningDepth,
          complexity: result.features.complexity,
          extractionStatus: 'SUCCESS',
          featuresExtractedAt: new Date(),
          extractionModel: 'gemma-4-31b-it-v1',
        },
      })
    );

    await Promise.all(updatePromises);

    const response = Array.from(results.entries()).map(([id, result]) => ({
      id,
      features: result.features,
      confidence: result.confidence,
      status: 'SUCCESS',
    }));

    return NextResponse.json({
      success: true,
      results: response,
      summary: {
        total: response.length,
        success: response.length,
        failed: 0,
      },
    });
  } catch (error) {
    console.error('批量提取失败:', error);
    return NextResponse.json(
      { error: '批量提取失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
