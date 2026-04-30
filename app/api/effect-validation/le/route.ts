import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

const leAnalyzer = new LEAnalyzer(prisma);

export async function GET(request: NextRequest) {
  try {
    const result = await leAnalyzer.calculateGlobalLE();

    return NextResponse.json({
      le: result.le,
      confidence: result.confidence,
      trend: result.trend,
      knowledgePointCount: result.byKnowledgePoint.length,
      byKnowledgePoint: result.byKnowledgePoint,
    });
  } catch (error) {
    console.error('Get global LE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}