import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

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
    const { name, chapterId, conceptId, weight, inAssess, status } = body;

    const existing = await prisma.knowledgePoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '知识点不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const changes: Record<string, { from: any; to: any }> = {};
    if (name !== undefined && name !== existing.name) changes.name = { from: existing.name, to: name };
    if (chapterId !== undefined && chapterId !== existing.chapterId) changes.chapterId = { from: existing.chapterId, to: chapterId };
    if (conceptId !== undefined && conceptId !== existing.conceptId) changes.conceptId = { from: existing.conceptId, to: conceptId };
    if (weight !== undefined && weight !== existing.weight) changes.weight = { from: existing.weight, to: weight };
    if (inAssess !== undefined && inAssess !== existing.inAssess) changes.inAssess = { from: existing.inAssess, to: inAssess };
    if (status !== undefined && status !== existing.status) changes.status = { from: existing.status, to: status };

    const updated = await prisma.knowledgePoint.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(chapterId !== undefined && { chapterId }),
        ...(conceptId !== undefined && { conceptId }),
        ...(weight !== undefined && { weight }),
        ...(inAssess !== undefined && { inAssess }),
        ...(status !== undefined && { status })
      }
    });

    for (const [field, change] of Object.entries(changes)) {
      await prisma.knowledgePointHistory.create({
        data: {
          knowledgeId: id,
          field,
          oldValue: String(change.from),
          newValue: String(change.to),
          operator: admin.userId,
          reason: body.reason
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'update',
        entity: 'knowledge',
        entityId: id,
        changes: { before: existing, after: updated, fields: changes }
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
    const existing = await prisma.knowledgePoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '知识点不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await prisma.knowledgePoint.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'delete',
        entity: 'knowledge',
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
