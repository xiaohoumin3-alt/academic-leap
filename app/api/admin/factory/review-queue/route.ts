import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'pending';

    const templates = await prisma.template.findMany({
      where: {
        reviewStatus: status,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        knowledge: {
          select: { name: true },
        },
      },
    });

    const items = templates.map((t) => {
      const validationResult = t.validationResult as Record<string, unknown> | null;
      const mathCorrectness = validationResult?.mathCorrectness as
        | { passed: boolean }
        | undefined;
      const priority =
        mathCorrectness?.passed === false
          ? 'p0'
          : t.qualityScore && t.qualityScore >= 90
            ? 'p3'
            : t.qualityScore && t.qualityScore >= 80
              ? 'p2'
              : 'p1';

      return {
        id: t.id,
        templateId: t.id,
        knowledgePoint: t.knowledge?.name || 'Unknown',
        template: {
          name: t.name,
          structure: t.structure,
        },
        validationResult: validationResult || {},
        priority,
        estimatedTime: priority === 'p0' ? 300 : 180,
      };
    });

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('Review queue error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    );
  }
}
