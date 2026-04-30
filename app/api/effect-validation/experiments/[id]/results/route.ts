import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

const experimentManager = new ExperimentManager(prisma);
const leAnalyzer = new LEAnalyzer(prisma);

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const experiment = await prisma.effectExperiment.findUnique({
      where: { id },
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const result = await experimentManager.analyzeExperiment(id);

    const observations = await prisma.effectObservation.groupBy({
      by: ['variant'],
      where: { experimentId: id },
      _avg: { value: true },
      _count: true,
    });

    const controlObs = observations.find(o => o.variant === 'control');
    const treatmentObs = observations.find(o => o.variant === 'treatment');

    return NextResponse.json({
      experimentId: id,
      control: {
        mean: controlObs?._avg.value ?? 0,
        sampleSize: controlObs?._count ?? 0,
      },
      treatment: {
        mean: treatmentObs?._avg.value ?? 0,
        sampleSize: treatmentObs?._count ?? 0,
      },
      uplift: result.uplift,
      pValue: result.pValue,
      significant: result.significant,
      recommendation: result.recommendation,
    });
  } catch (error) {
    console.error('Get experiment results error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}