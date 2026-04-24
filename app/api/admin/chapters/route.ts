import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const textbookId = new URL(req.url).searchParams.get('textbookId');

    if (!textbookId) {
      return NextResponse.json({ success: false, error: '缺少 textbookId' }, { status: 400 });
    }

    const chapters = await prisma.chapter.findMany({
      where: { textbookId },
      orderBy: [{ chapterNumber: 'asc' }, { sectionNumber: 'asc' }],
      include: {
        _count: { select: { knowledgePoints: true } }
      }
    });

    return NextResponse.json({ success: true, data: chapters });
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
    const { textbookId, chapterNumber, chapterName, sectionNumber, sectionName, parentId, sort } = body;

    if (!textbookId || !chapterNumber || !chapterName) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    const chapter = await prisma.chapter.create({
      data: {
        textbookId,
        chapterNumber,
        chapterName,
        sectionNumber: sectionNumber || null,
        sectionName: sectionName || null,
        parentId: parentId || null,
        sort: sort || 0
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'create',
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
