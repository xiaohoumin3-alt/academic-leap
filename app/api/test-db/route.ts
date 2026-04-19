import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 测试数据库连接
    const userCount = await prisma.user.count();

    // 获取测试用户
    const user = await prisma.user.findUnique({
      where: { email: '913993571@qq.com' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      testUser: user ? 'found' : 'not_found',
      userData: user,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? 'set' : 'not_set',
    }, { status: 500 });
  }
}
