import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

const canaryController = new CanaryController(prisma);

const createCanarySchema = z.object({
  templateId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const canaries = await prisma.canaryRelease.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        history: { orderBy: { enteredAt: 'desc' }, take: 1 },
      },
    });

    return NextResponse.json({ canaries });
  } catch (error) {
    console.error('Get canaries error:', error);
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
    const validated = createCanarySchema.parse(body);

    const existing = await prisma.canaryRelease.findUnique({
      where: { templateId: validated.templateId },
    });

    if (existing) {
      return NextResponse.json({ error: 'Canary already exists for this template' }, { status: 409 });
    }

    const canary = await prisma.canaryRelease.create({
      data: {
        templateId: validated.templateId,
        currentStage: 0,
        trafficPercent: 5,
        status: 'pending',
      },
    });

    await canaryController.startCanary(validated.templateId);

    return NextResponse.json({ canary }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Create canary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}