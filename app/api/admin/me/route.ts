import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser();

    if (!admin) {
      return NextResponse.json(
        { success: false, error: '未登录', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const fullAdmin = await prisma.admin.findUnique({
      where: { id: admin.id },
      include: { user: { select: { name: true, email: true } } }
    });

    return NextResponse.json({
      success: true,
      data: fullAdmin
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
