import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    const textbooks = await prisma.textbookVersion.findMany({
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { chapters: true } }
      }
    });
    return NextResponse.json({ success: true, data: textbooks });
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
    const { name, publisher, grade, subject, year } = body;

    if (!name || !grade || !subject) {
      return NextResponse.json({ success: false, error: '缺少必填字段' }, { status: 400 });
    }

    const textbook = await prisma.textbookVersion.create({
      data: { name, publisher, grade, subject, year }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'create',
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
