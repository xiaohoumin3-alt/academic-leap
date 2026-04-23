import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const subject = searchParams.get('subject');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null
    };

    if (subject) where.subject = subject;
    if (status) where.status = status;
    if (search) where.name = { contains: search };

    const [items, total] = await Promise.all([
      prisma.knowledgePoint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.knowledgePoint.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
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

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!canEdit(admin.role)) {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, subject, category, weight = 0, inAssess = true, status = 'active' } = body;

    if (!name || !subject || !category) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const knowledge = await prisma.knowledgePoint.create({
      data: {
        name,
        subject,
        category,
        weight,
        inAssess,
        status
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.userId,
        action: 'create',
        entity: 'knowledge',
        entityId: knowledge.id,
        changes: { before: null, after: knowledge }
      }
    });

    return NextResponse.json({ success: true, data: knowledge });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

function canEdit(role: string): boolean {
  return role === 'admin' || role === 'editor';
}
