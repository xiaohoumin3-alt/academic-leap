import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

const leAnalyzer = new LEAnalyzer(prisma);

interface RouteParams {
  params: Promise<{ knowledgePointId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { knowledgePointId } = await params;

    const kp = await prisma.knowledgePoint.findUnique({
      where: { id: knowledgePointId },
    });

    if (!kp) {
      return NextResponse.json({ error: 'Knowledge point not found' }, { status: 404 });
    }

    const result = await leAnalyzer.calculateLE(knowledgePointId);

    return NextResponse.json({
      knowledgePointId: result.knowledgePointId,
      name: kp.name,
      le: result.le,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      trend: result.trend,
      meetsTarget: result.le >= 0.15,
    });
  } catch (error) {
    console.error('Get KP LE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}