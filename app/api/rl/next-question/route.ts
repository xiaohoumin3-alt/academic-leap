import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RLModelStore } from '@/lib/rl/persistence/model-store';
import { estimateAbilityEAP, type IRTResponse } from '@/lib/rl/irt/estimator';
import { InMemoryLEHistoryService } from '@/lib/rl/history/le-history-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { knowledgePointId } = body;

    if (!knowledgePointId) {
      return NextResponse.json({ error: 'knowledgePointId required' }, { status: 400 });
    }

    const modelStore = new RLModelStore(prisma);
    const deployedModel = await modelStore.getDeployedModel();

    if (!deployedModel) {
      return NextResponse.json({ error: 'No deployed model' }, { status: 503 });
    }

    // Load bandit and IRT state
    const bandit = await modelStore.loadModel(deployedModel.id);
    if (!bandit) {
      return NextResponse.json({ error: 'Failed to load model' }, { status: 500 });
    }

    // Get IRT state
    const irtState = await prisma.iRTStudentState.findUnique({
      where: { userId: session.user.id }
    });

    const theta = irtState?.theta ?? 0;

    // Get pre-recommendation accuracy
    const leService = new InMemoryLEHistoryService();
    const preAccuracy = leService.getAccuracy(session.user.id, knowledgePointId);

    // Select arm
    const selectedDeltaC = parseFloat(bandit.selectArm(theta));

    // Find question with matching deltaC
    const question = await prisma.question.findFirst({
      where: {
        difficulty: Math.round(selectedDeltaC)
      },
      take: 1
    });

    if (!question) {
      return NextResponse.json({ error: 'No available question' }, { status: 404 });
    }

    // Generate recommendation ID
    const recommendationId = crypto.randomUUID();

    return NextResponse.json({
      question: {
        id: question.id,
        deltaC: selectedDeltaC
      },
      theta,
      selectedBucket: selectedDeltaC.toFixed(1),
      modelVersion: deployedModel.version,
      recommendationId,
      preAccuracy
    });

  } catch (error) {
    console.error('Next question error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
