import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Reset all questions with SUCCESS or FAILED status back to PENDING
    const result = await prisma.question.updateMany({
      where: { extractionStatus: { in: ['FAILED', 'SUCCESS'] } },
      data: {
        extractionStatus: 'PENDING',
        cognitiveLoad: null,
        reasoningDepth: null,
        complexity: null,
        featuresExtractedAt: null,
        extractionError: null,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('重置失败:', error);
    return NextResponse.json({ error: '重置失败' }, { status: 500 });
  }
}
