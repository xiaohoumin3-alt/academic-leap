import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        creator: { select: { user: { select: { name: true, email: true } } } },
        knowledge: true,
        versions: { orderBy: { version: 'desc' }, take: 10 },
        qualities: { where: { resolvedAt: null } }
      }
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: template });
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

export async function PUT(
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
    const { name, type, structure, params: templateParams, steps, knowledgeId } = body;

    const existing = await prisma.template.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existing.status === 'production') {
      return NextResponse.json(
        { success: false, error: '生产环境模板不能直接编辑', code: 'CANNOT_EDIT_PRODUCTION' },
        { status: 400 }
      );
    }

    const updated = await prisma.template.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(structure !== undefined && { structure: structure as any }),
        ...(templateParams !== undefined && { params: templateParams as any }),
        ...(steps !== undefined && { steps: steps as any }),
        ...(knowledgeId !== undefined && { knowledgeId })
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'update',
        entity: 'template',
        entityId: id,
        changes: { before: existing, after: updated }
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!canDelete(admin.role)) {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const existing = await prisma.template.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (existing.status === 'production') {
      return NextResponse.json(
        { success: false, error: '生产环境模板不能删除', code: 'CANNOT_DELETE_PRODUCTION' },
        { status: 400 }
      );
    }

    await prisma.template.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'delete',
        entity: 'template',
        entityId: id,
        changes: { before: existing }
      }
    });

    return NextResponse.json({ success: true, message: '已删除' });
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

function canDelete(role: string): boolean {
  return role === 'admin';
}
