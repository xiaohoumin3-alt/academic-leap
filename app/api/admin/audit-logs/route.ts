import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, canManageUsers } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const entity = searchParams.get('entity');
    const action = searchParams.get('action');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (entity) where.entity = entity;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            include: {
              user: {
                select: { email: true, name: true }
              }
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
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
