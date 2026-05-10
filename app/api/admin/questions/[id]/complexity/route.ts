import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/admin-auth';

export async function PATCH(
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
    const body = await request.json();

    const { cognitiveLoad, reasoningDepth, difficulty } = body;

    // Build update data - complexity字段已移除，只更新 cognitiveLoad 和 reasoningDepth
    const updateData: Record<string, unknown> = {};
    if (typeof cognitiveLoad === 'number') updateData.cognitiveLoad = cognitiveLoad;
    if (typeof reasoningDepth === 'number') updateData.reasoningDepth = reasoningDepth;
    if (typeof difficulty === 'number') updateData.difficulty = difficulty;

    // If any complexity field is updated, mark as SUCCESS
    if (cognitiveLoad !== undefined || reasoningDepth !== undefined) {
      updateData.extractionStatus = 'SUCCESS';
    }

    const question = await prisma.question.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error('Failed to update question complexity:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '更新复杂度失败' } },
      { status: 500 }
    );
  }
}
