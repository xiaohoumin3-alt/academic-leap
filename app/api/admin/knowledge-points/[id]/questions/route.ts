import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get knowledge point with details
    const knowledgePoint = await prisma.knowledgePoint.findUnique({
      where: { id },
      include: {
        concept: true,
        chapter: {
          include: {
            textbook: true,
          },
        },
      },
    });

    if (!knowledgePoint) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '知识点不存在' } },
        { status: 404 }
      );
    }

    // Get questions associated with this knowledge point
    // knowledgePoints is a JSON array, use array contains mode
    const questions = await prisma.question.findMany({
      where: {
        knowledgePoints: {
          equals: expect.any(Array),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        difficulty: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        extractionStatus: true,
        createdAt: true,
        knowledgePoints: true,
      },
    });

    // Filter questions that contain this knowledge point ID
    const filteredQuestions = questions.filter(q => {
      const kps = q.knowledgePoints;
      if (Array.isArray(kps)) {
        return kps.some(kp => typeof kp === 'object' && (kp as { id?: string }).id === id);
      }
      return false;
    });

    // Calculate stats
    const stats = {
      total: filteredQuestions.length,
      pending: filteredQuestions.filter(q => q.extractionStatus === 'PENDING').length,
      completed: filteredQuestions.filter(q => q.extractionStatus === 'SUCCESS' || q.extractionStatus === 'FALLBACK').length,
      failed: filteredQuestions.filter(q => q.extractionStatus === 'FAILED').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        knowledgePoint: {
          id: knowledgePoint.id,
          name: knowledgePoint.name,
          weight: knowledgePoint.weight,
          inAssess: knowledgePoint.inAssess,
          status: knowledgePoint.status,
          concept: knowledgePoint.concept,
          textbook: knowledgePoint.chapter?.textbook,
          chapter: {
            id: knowledgePoint.chapter?.id,
            name: (knowledgePoint.chapter as unknown as { chapterName?: string })?.chapterName,
          },
        },
        questions: filteredQuestions,
        stats,
      },
    });
  } catch (error) {
    console.error('Failed to get knowledge point questions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取知识点题目失败' } },
      { status: 500 }
    );
  }
}
