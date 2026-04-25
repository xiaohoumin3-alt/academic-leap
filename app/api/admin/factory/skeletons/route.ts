import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/factory/skeletons
 * 获取骨架列表，支持按状态筛选
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending | approved | production | all

    const where = status && status !== 'all'
      ? { status }
      : {};

    const skeletons = await prisma.skeleton.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: skeletons
    });
  } catch (error) {
    console.error('Error fetching skeletons:', error);
    return NextResponse.json({
      success: false,
      error: '获取骨架列表失败'
    }, { status: 500 });
  }
}