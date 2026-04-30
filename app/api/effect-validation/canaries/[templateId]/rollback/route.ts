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

    await canaryController.rollback(templateId);

    return NextResponse.json({
      success: true,
      status: 'rolled_back',
    });
  } catch (error) {
    console.error('Rollback canary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}