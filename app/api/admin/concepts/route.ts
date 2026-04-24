import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    const concepts = await prisma.knowledgeConcept.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { instances: true } }
      }
    });
    return NextResponse.json({ success: true, data: concepts });
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
    const { name, category, weight } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: '缺少必填字段: name' }, { status: 400 });
    }

    const concept = await prisma.knowledgeConcept.create({
      data: {
        name,
        category: category || null,
        weight: weight || 0
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'create',
        entity: 'concept',
        entityId: concept.id,
        changes: { before: null, after: concept }
      }
    });

    return NextResponse.json({ success: true, data: concept });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
