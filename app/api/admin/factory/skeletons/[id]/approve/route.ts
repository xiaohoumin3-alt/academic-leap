import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/factory/skeletons/[id]/approve
 * 审核骨架，将其从 pending 状态变更为 production 状态
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json({
        success: false,
        error: 'approvedBy is required'
      }, { status: 400 });
    }

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

    const skeleton = await prisma.skeleton.update({
      where: { id },
      data: {
        status: 'production',
        approvedBy
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
