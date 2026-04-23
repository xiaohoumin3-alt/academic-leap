import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const where: any = { deletedAt: null };

    let excludeId: string | undefined;
    try {
      const body = await req.json();
      excludeId = body.excludeId;
    } catch {
      // Empty body is OK
    }

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const points = await prisma.knowledgePoint.findMany({
      where,
      select: { id: true, name: true, weight: true, inAssess: true }
    });

    const activeTotal = points
      .filter(p => p.inAssess)
      .reduce((sum, p) => sum + p.weight, 0);

    const isValid = activeTotal === 100;

    return NextResponse.json({
      success: true,
      data: {
        isValid,
        total: activeTotal,
        expected: 100,
        difference: 100 - activeTotal,
        points
      }
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
