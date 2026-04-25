import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

/**
 * POST /api/admin/factory/skeletons/[id]/approve
 * 审核骨架，将其从 pending 状态变更为 production 状态
 * approvedBy 从认证session获取，不接受客户端伪造
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const { id } = await params;
    const approverId = session.user.id;

    // Verify skeleton exists
    const existing = await prisma.skeleton.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Skeleton not found'
      }, { status: 404 });
    }

    if (existing.status === 'production') {
      return NextResponse.json({
        success: false,
        error: 'Skeleton already approved'
      }, { status: 400 });
    }

    const skeleton = await prisma.skeleton.update({
      where: { id },
      data: {
        status: 'production',
        approvedBy: approverId
      }
    });

    return NextResponse.json({
      success: true,
      data: skeleton
    });
  } catch (error) {
    console.error('Error approving skeleton:', error);
    return NextResponse.json({
      success: false,
      error: '审核骨架失败'
    }, { status: 500 });
  }
}