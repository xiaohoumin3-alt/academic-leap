import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

const canaryController = new CanaryController(prisma);

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { templateId } = await params;

    const canary = await prisma.canaryRelease.findUnique({
      where: { templateId },
    });

    if (!canary) {
      return NextResponse.json({ error: 'Canary not found' }, { status: 404 });
    }

    if (canary.status === 'completed') {
      return NextResponse.json({ error: 'Canary already completed' }, { status: 400 });
    }

    await canaryController.increaseTraffic(templateId);

    const updated = await canaryController.getCanaryStatus(templateId);

    return NextResponse.json({
      success: true,
      currentStage: updated?.currentStage,
      trafficPercent: updated?.trafficPercent,
      status: updated?.status,
    });
  } catch (error) {
    console.error('Increase canary traffic error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}