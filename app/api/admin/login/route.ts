import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAdminToken } from '@/lib/admin-auth';
import { cookies } from 'next/headers';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret-change-in-production';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '缺少邮箱或密码', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { admin: true }
    });

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, error: '邮箱或密码错误', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    if (!user.admin) {
      return NextResponse.json(
        { success: false, error: '无管理员权限', code: 'NOT_ADMIN' },
        { status: 403 }
      );
    }

    const token = createAdminToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set('admin-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        admin: {
          id: user.admin.id,
          role: user.admin.role
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
