import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { user: { select: { name: true, email: true } } } },
          knowledge: { select: { id: true, name: true } }
        }
      }),
      prisma.template.count({ where })
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
    const { name, type, structure, params, steps, knowledgeId } = body;

    if (!name || !type || !structure || !params || !steps) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { userId: admin.id }
    });

    if (!existingAdmin) {
      return NextResponse.json(
        { success: false, error: '管理员不存在', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const template = await prisma.template.create({
      data: {
        name,
        type,
        structure: structure as any,
        params: params as any,
        steps: steps as any,
        knowledgeId,
        createdBy: existingAdmin.id,
        status: 'draft'
      }
    });

    await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        structure: structure as any,
        params: params as any,
        steps: steps as any,
        createdBy: existingAdmin.id
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'create',
        entity: 'template',
        entityId: template.id,
        changes: { after: template }
      }
    });

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

function canEdit(role: string): boolean {
  return role === 'admin' || role === 'editor';
}
