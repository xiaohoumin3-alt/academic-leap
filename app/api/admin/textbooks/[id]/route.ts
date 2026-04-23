import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const textbook = await prisma.textbookVersion.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { chapterNumber: 'asc' },
          include: { _count: { select: { knowledgePoints: true } } }
        }
      }
    });
    if (!textbook) {
      return NextResponse.json({ success: false, error: '教材不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: textbook });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const textbook = await prisma.textbookVersion.update({
      where: { id },
      data: body
    });
    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'update',
        entity: 'textbook',
        entityId: textbook.id,
        changes: { before: null, after: textbook }
      }
    });
    return NextResponse.json({ success: true, data: textbook });
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
    await prisma.textbookVersion.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'delete',
        entity: 'textbook',
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
