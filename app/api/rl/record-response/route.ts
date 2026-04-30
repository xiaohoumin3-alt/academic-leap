import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RLModelStore } from '@/lib/rl/persistence/model-store';
import { estimateAbilityEAP, type IRTResponse } from '@/lib/rl/irt/estimator';
import { PrismaLEHistoryService } from '@/lib/rl/history/le-history-service';
import { calculateHybridReward, type StudentResponse, type LETrackingContext } from '@/lib/rl/reward/le-reward';
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { applyTimeDecay } from '@/lib/rl/reward/time-decay-credit';
import { isFeatureEnabled, getFeatureConfig, TDCAConfig } from '@/lib/rl/config/phase2-features';
import { isFeatureEnabled as isPhase3Enabled, getFeatureConfig as getPhase3Config, LQMConfig } from '@/lib/rl/config/phase3-features';
import { LabelQualityModel } from '@/lib/rl/quality/label-quality';

const healthMonitor = new HealthMonitor();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      questionId,
      correct,
      eventId,
      attemptId,
      knowledgePointId,
      recommendationId,
      preAccuracy,
      selectedDeltaC,
      responseTimestamp
    } = body;

    // Validate required fields
    if (!questionId || typeof correct !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!eventId || !attemptId || !knowledgePointId || !recommendationId) {
      return NextResponse.json({ error: 'Missing DFI/LE tracking fields' }, { status: 400 });
    }

    if (typeof selectedDeltaC !== 'number') {
      return NextResponse.json({ error: 'selectedDeltaC must be a number' }, { status: 400 });
    }

    const modelStore = new RLModelStore(prisma);
    const deployedModel = await modelStore.getDeployedModel();

    if (!deployedModel) {
      return NextResponse.json({ error: 'No deployed model' }, { status: 503 });
    }

    // Get IRT state before
    const irtBefore = await prisma.iRTStudentState.findUnique({
      where: { userId: session.user.id }
    });

    const thetaBefore = irtBefore?.theta ?? 0;

    // Calculate LE reward
    const leService = new PrismaLEHistoryService(prisma);
    const response: StudentResponse = {
      userId: session.user.id,
      questionId,
      correct,
      knowledgePointId,
      eventId,
      attemptId
    };

    const context: LETrackingContext = {
      knowledgePointId,
      preAccuracy,
      recommendationId
    };

    const rewardResult = await calculateHybridReward(response, context, leService);

    // Apply time-decay credit assignment if enabled
    let finalReward = rewardResult.reward;
    let rewardDecayInfo: { decayWeight: number; isIgnored: boolean } | undefined;

    if (isFeatureEnabled('tdca')) {
      const tdcaConfig = getFeatureConfig<TDCAConfig>('tdca');
      const timestamp = responseTimestamp || Date.now();
      const decayed = applyTimeDecay(finalReward, timestamp, tdcaConfig);
      finalReward = decayed.adjustedReward;
      rewardDecayInfo = { decayWeight: decayed.decayWeight, isIgnored: decayed.isIgnored };
    }

    // Update IRT state
    const recentAttempts = await prisma.attemptStep.findMany({
      where: {
        attempt: { userId: session.user.id }
      },
      include: {
        questionStep: {
          include: {
            question: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' },
      take: 50
    });

    const irtResponses: IRTResponse[] = recentAttempts.map(a => ({
      correct: a.isCorrect,
      deltaC: a.questionStep?.question?.difficulty ?? 5
    }));

    irtResponses.push({ correct, deltaC: selectedDeltaC });

    const { theta: thetaAfter, confidence } = estimateAbilityEAP(irtResponses);

    await prisma.iRTStudentState.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        theta: thetaAfter,
        confidence,
        responseCount: 1
      },
      update: {
        theta: thetaAfter,
        confidence,
        responseCount: { increment: 1 },
        lastEstimatedAt: new Date()
      }
    });

    // Initialize Label Quality Model if enabled
    let labelQualityModel: LabelQualityModel | null = null;
    if (isPhase3Enabled('lqm')) {
      const lqmConfig = getPhase3Config<LQMConfig>('lqm');
      labelQualityModel = new LabelQualityModel(lqmConfig);
    }

    // Update bandit
    const bandit = await modelStore.loadModel(deployedModel.id);
    if (!bandit) {
      return NextResponse.json({ error: 'Failed to load model' }, { status: 500 });
    }

    // Apply label quality correction if LQM is enabled
    let banditUpdateValue = finalReward > 0.5;
    if (labelQualityModel) {
      const corrected = labelQualityModel.correctLabel(questionId, finalReward > 0.5);
      banditUpdateValue = corrected.value;
      // Update LQM model with this response
      labelQualityModel.update(questionId, { correct, theta: thetaAfter });
    }
    bandit.update(selectedDeltaC.toFixed(1), banditUpdateValue);
    await modelStore.saveModel(deployedModel.id, bandit);

    // Log training
    const logId = await modelStore.logTraining(deployedModel.id, {
      eventId,
      attemptId,
      userId: session.user.id,
      questionId,
      knowledgePointId,
      recommendationId,
      preAccuracy,
      stateTheta: thetaBefore,
      selectedDeltaC,
      reward: finalReward,
      postAccuracy: rewardResult.postAccuracy,
      leDelta: rewardResult.leDelta
    });

    // 记录答题历史到健康监控
    healthMonitor.recordResponse({
      theta: thetaBefore,
      deltaC: selectedDeltaC,
      correct,
      timestamp: Date.now(),
    });

    // 记录DFI事件
    healthMonitor.recordEvent(!!logId);

    return NextResponse.json({
      reward: rewardResult.reward,
      thetaBefore,
      thetaAfter,
      preAccuracy: rewardResult.preAccuracy,
      postAccuracy: rewardResult.postAccuracy,
      leDelta: rewardResult.leDelta,
      bucketUpdated: selectedDeltaC.toFixed(1),
      logId
    });

  } catch (error) {
    console.error('Record response error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
