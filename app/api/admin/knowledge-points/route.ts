import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const textbookId = new URL(req.url).searchParams.get('textbookId');
    const chapterId = new URL(req.url).searchParams.get('chapterId');

    const where: any = { deletedAt: null };
    if (chapterId) where.chapterId = chapterId;
    if (textbookId) {
      where.chapter = { textbookId };
    }

    const points = await prisma.knowledgePoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: { include: { textbook: true } },
        concept: true
      }
    });

    return NextResponse.json({ success: true, data: points });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { name, chapterId, conceptId, weight = 0, inAssess = true, status = 'active' } = body;

    if (!name || !chapterId || !conceptId) {
      return NextResponse.json({ success: false, error: '缺少必填字段: name, chapterId, conceptId' }, { status: 400 });
    }

    const point = await prisma.knowledgePoint.create({
      data: { name, chapterId, conceptId, weight, inAssess, status }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'create',
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
