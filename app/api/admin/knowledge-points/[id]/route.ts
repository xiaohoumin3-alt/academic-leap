import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const point = await prisma.knowledgePoint.findUnique({
      where: { id },
      include: {
        chapter: { include: { textbook: true } },
        concept: true
      }
    });
    if (!point || point.deletedAt) {
      return NextResponse.json({ success: false, error: '知识点不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: point });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const point = await prisma.knowledgePoint.update({
      where: { id },
      data: body
    });
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'update',
        entity: 'knowledge',
        entityId: point.id,
        changes: { before: null, after: point }
      }
    });
    return NextResponse.json({ success: true, data: point });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    // Soft delete
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
        changes: { before: null, after: null }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
