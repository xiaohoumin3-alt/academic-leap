import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, canManageUsers, logAuditAction } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();

    const admins = await prisma.admin.findMany({
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: admins
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

    if (!canManageUsers(admin.role)) {
      return NextResponse.json(
        { success: false, error: '权限不足', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !role) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    // 验证用户存在
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 检查是否已是管理员
    const existing = await prisma.admin.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: '该用户已是管理员', code: 'ALREADY_ADMIN' },
        { status: 400 }
      );
    }

    const newAdmin = await prisma.admin.create({
      data: { userId, role },
      include: {
        user: {
          select: { email: true, name: true }
        }
      }
    });

    await logAuditAction(
      admin.userId,
      'create',
      'admin',
      newAdmin.id,
      { role },
      req
    );

    return NextResponse.json({
      success: true,
      data: newAdmin
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
