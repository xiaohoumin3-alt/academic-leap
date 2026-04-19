import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/profile - 获取用户资料
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        grade: true,
        targetScore: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('获取用户资料错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// PUT /api/user/profile - 更新用户资料
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { name, grade, targetScore } = await req.json();

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name }),
        ...(grade !== undefined && { grade }),
        ...(targetScore !== undefined && { targetScore }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        grade: true,
        targetScore: true,
      },
    });

    return NextResponse.json({ user, success: true });
  } catch (error) {
    console.error('更新用户资料错误:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
