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
    const body = await req.json();
    const { version } = body;

    if (!version) {
      return NextResponse.json(
        { success: false, error: '缺少版本号', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const targetVersion = await prisma.templateVersion.findFirst({
      where: { templateId: id, version }
    });

    if (!targetVersion) {
      return NextResponse.json(
        { success: false, error: '目标版本不存在', code: 'VERSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    const updated = await prisma.template.update({
      where: { id },
      data: {
        structure: targetVersion.structure as any,
        params: targetVersion.params as any,
        steps: targetVersion.steps as any
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'rollback',
        entity: 'template',
        entityId: id,
        changes: { from: template.version, to: version }
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
