import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const points = await prisma.knowledgePoint.findMany({
      where: { deletedAt: null, inAssess: true },
      select: {
        weight: true,
        concept: { select: { weight: true } }
      }
    });

    // Hybrid weight calculation: instance weight > 0 uses instance, otherwise concept
    const totalWeight = points.reduce((sum, p) => {
      return sum + (p.weight > 0 ? p.weight : p.concept.weight);
    }, 0);

    const conceptIds = [...new Set(points.map(p => p.conceptId))];

    return NextResponse.json({
      success: true,
      data: {
        isValid: totalWeight === 100,
        total: totalWeight,
        expected: 100,
        conceptCount: conceptIds.length,
        pointCount: points.length
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
