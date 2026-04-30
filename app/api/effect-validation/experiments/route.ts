import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';
import type { ExperimentConfig } from '@/lib/effect-validation/types';

const experimentManager = new ExperimentManager(prisma);

const createExperimentSchema = z.object({
  name: z.string().min(1),
  controlTemplateId: z.string().min(1),
  treatmentTemplateId: z.string().min(1),
  targetMetric: z.enum(['accuracy', 'le']),
  minSampleSize: z.number().int().positive().default(100),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const skip = Number(searchParams.get('offset')) || 0;

    const experiments = await prisma.effectExperiment.findMany({
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { assignments: true, observations: true } },
      },
    });

    return NextResponse.json({ experiments });
  } catch (error) {
    console.error('Get experiments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createExperimentSchema.parse(body);

    const config: ExperimentConfig = {
      name: validated.name,
      controlTemplateId: validated.controlTemplateId,
      treatmentTemplateId: validated.treatmentTemplateId,
      targetMetric: validated.targetMetric,
      minSampleSize: validated.minSampleSize,
    };

    const id = await experimentManager.createExperiment(config);
    await experimentManager.startExperiment(id);

    return NextResponse.json({ id, status: 'running' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Create experiment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}