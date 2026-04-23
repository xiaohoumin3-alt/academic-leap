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

    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (template.status === 'production') {
      return NextResponse.json(
        { success: false, error: '已经是生产环境', code: 'ALREADY_PRODUCTION' },
        { status: 400 }
      );
    }

    const updated = await prisma.template.update({
      where: { id },
      data: {
        status: 'staging',
        version: { increment: 1 },
        publishedAt: new Date()
      }
    });

    await prisma.templateVersion.create({
      data: {
        templateId: id,
        version: updated.version,
        structure: template.structure as any,
        params: template.params as any,
        steps: template.steps as any,
        createdBy: admin.userId
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'publish',
        entity: 'template',
        entityId: id,
        changes: { from: template.status, to: 'staging', version: updated.version }
      }
    });

    return NextResponse.json({ success: true, data: updated });
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
