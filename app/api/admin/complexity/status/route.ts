import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const [pending, success, failed, avgResult] = await Promise.all([
      prisma.question.count({ where: { extractionStatus: 'PENDING' } }),
      prisma.question.count({ where: { extractionStatus: 'SUCCESS' } }),
      prisma.question.count({ where: { extractionStatus: 'FAILED' } }),
      prisma.question.aggregate({
        where: { extractionStatus: 'SUCCESS', cognitiveLoad: { not: null } },
        _avg: {
          cognitiveLoad: true,
          reasoningDepth: true,
          complexity: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        pending,
        success,
        failed,
        avgCognitiveLoad: avgResult._avg.cognitiveLoad || 0,
        avgReasoningDepth: avgResult._avg.reasoningDepth || 0,
        avgComplexity: avgResult._avg.complexity || 0,
      },
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
