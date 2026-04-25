import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * GET /api/admin/factory/skeletons
 * 获取骨架列表，支持按状态筛选
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    // 分页参数
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where = status && status !== 'all'
      ? { status }
      : {};

    const [skeletons, total] = await Promise.all([
      prisma.skeleton.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.skeleton.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      data: skeletons,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching skeletons:', error);
    return NextResponse.json({
      success: false,
      error: '获取骨架列表失败'
    }, { status: 500 });
  }
}