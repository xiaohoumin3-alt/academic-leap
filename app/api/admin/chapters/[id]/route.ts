import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        textbook: true,
        knowledgePoints: {
          where: { deletedAt: null },
          include: { concept: true }
        }
      }
    });
    if (!chapter) {
      return NextResponse.json({ success: false, error: '章节不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: chapter });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const chapter = await prisma.chapter.update({
      where: { id },
      data: body
    });
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'update',
        entity: 'chapter',
        entityId: chapter.id,
        changes: { before: null, after: chapter }
      }
    });
    return NextResponse.json({ success: true, data: chapter });
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

    // Check if there are knowledge points in this chapter
    const knowledgePointCount = await prisma.knowledgePoint.count({
      where: { chapterId: id }
    });
    if (knowledgePointCount > 0) {
      return NextResponse.json(
        { success: false, error: `无法删除：章节中存在 ${knowledgePointCount} 个知识点` },
        { status: 409 }
      );
    }

    await prisma.chapter.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'delete',
        entity: 'chapter',
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
