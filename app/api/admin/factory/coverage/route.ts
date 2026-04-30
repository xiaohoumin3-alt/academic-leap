import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GapDetector } from '@/lib/template-factory/gap-detector';
import type { CoverageReport } from '@/lib/template-factory/types';

export async function GET(request: NextRequest) {
  try {
    const detector = new GapDetector(prisma);
    const gaps = await detector.detectGaps();

    const totalKnowledgePoints = await prisma.knowledgePoint.count();
    const coveredKnowledgePoints = totalKnowledgePoints - gaps.length;

    const coverageRate = totalKnowledgePoints > 0
      ? coveredKnowledgePoints / totalKnowledgePoints
      : 0;

    const gapCounts = {
      high: gaps.filter(g => g.priority === 'high').length,
      medium: gaps.filter(g => g.priority === 'medium').length,
      low: gaps.filter(g => g.priority === 'low').length,
    };

    const report: CoverageReport = {
      total: totalKnowledgePoints,
      covered: coveredKnowledgePoints,
      coverageRate,
      byKnowledgePoint: gaps.map(g => ({
        id: g.knowledgePointId,
        name: g.knowledgePointName,
        current: g.currentTemplateCount,
        target: g.targetTemplateCount,
        gap: g.gap,
        priority: g.priority,
      })),
      gaps: gapCounts,
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('Coverage report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate coverage report' },
      { status: 500 }
    );
  }
}
