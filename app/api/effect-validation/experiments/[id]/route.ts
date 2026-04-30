import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExperimentManager } from '@/lib/effect-validation/experiment-manager';

const experimentManager = new ExperimentManager(prisma);

const updateExperimentSchema = z.object({
  status: z.enum(['running', 'paused', 'completed']),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const experiment = await prisma.effectExperiment.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: true, observations: true },
        },
        assignments: {
          take: 10,
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    return NextResponse.json({ experiment });
  } catch (error) {
    console.error('Get experiment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateExperimentSchema.parse(body);

    const experiment = await prisma.effectExperiment.findUnique({
      where: { id },
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    const updated = await prisma.effectExperiment.update({
      where: { id },
      data: {
        status: validated.status,
        ...(validated.status === 'completed' ? { completedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ experiment: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Update experiment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}