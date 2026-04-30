import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';
import { LEAnalyzer } from '@/lib/effect-validation/le-analyzer';

const canaryController = new CanaryController(prisma);
const experimentManager = new ExperimentManager(prisma);
const leAnalyzer = new LEAnalyzer(prisma);

export async function GET(request: NextRequest) {
  try {
    const activeCanaries = await canaryController.getActiveCanaries();

    const runningExperiments = await prisma.effectExperiment.findMany({
      where: { status: 'running' },
      select: {
        id: true,
        name: true,
        status: true,
        minSampleSize: true,
        _count: { select: { assignments: true } },
      },
    });

    const experimentsWithProgress = runningExperiments.map(exp => {
      const minSample = exp.minSampleSize || 100;
      const progress = Math.min(1, exp._count.assignments / minSample);
      return {
        id: exp.id,
        name: exp.name,
        status: exp.status,
        progress: Math.round(progress * 100) / 100,
      };
    });

    const globalLE = await leAnalyzer.calculateGlobalLE();

    const anomalies = await leAnalyzer.detectAnomalies();

    return NextResponse.json({
      activeCanaries,
      runningExperiments: experimentsWithProgress,
      globalLE,
      anomalies,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}