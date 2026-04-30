import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CanaryController } from '@/lib/effect-validation/canary-controller';

const canaryController = new CanaryController(prisma);

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { templateId } = await params;

    const canary = await canaryController.getCanaryStatus(templateId);

    if (!canary) {
      return NextResponse.json({ error: 'Canary not found' }, { status: 404 });
    }

    const health = await canaryController.checkHealth(templateId);

    return NextResponse.json({
      ...canary,
      healthStatus: health.status,
      healthMessage: health.message,
    });
  } catch (error) {
    console.error('Get canary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}