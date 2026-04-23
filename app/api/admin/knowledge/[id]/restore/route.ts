import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!canEdit(admin.role)) {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const restored = await prisma.knowledgePoint.update({
      where: { id },
      data: { deletedAt: null }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'restore',
        entity: 'knowledge',
        entityId: id,
        changes: { after: restored }
      }
    });

    return NextResponse.json({ success: true, data: restored });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '未授权', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

function canEdit(role: string): boolean {
  return role === 'admin' || role === 'editor';
}
