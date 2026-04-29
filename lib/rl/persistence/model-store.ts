// lib/rl/persistence/model-store.ts

import { ThompsonSamplingBandit } from '../bandit/thompson-sampling';

export interface ModelMetadata {
  id: string;
  version: string;
  algorithm: string;
  status: string;
  bucketSize: number;
  trainedAt: Date | null;
}

export interface CreateModelOptions {
  version: string;
  bucketSize?: number;
  priorAlpha?: number;
  priorBeta?: number;
}

export class RLModelStore {
  constructor(private prisma: any) {}

  async createModel(options: CreateModelOptions): Promise<string> {
    const model = await this.prisma.rLModelVersion.create({
      data: {
        version: options.version,
        algorithm: 'ThompsonSampling',
        bucketSize: options.bucketSize ?? 0.5,
        priorAlpha: options.priorAlpha ?? 1,
        priorBeta: options.priorBeta ?? 1,
        status: 'TRAINING'
      }
    });

    // Initialize bandit arms
    const bandit = new ThompsonSamplingBandit({
      bucketSize: options.bucketSize ?? 0.5
    });

    const state = bandit.getState();
    for (const [key, arm] of state.buckets) {
      await this.prisma.rLBanditArm.create({
        data: {
          modelId: model.id,
          deltaC: arm.deltaC,
          alpha: arm.alpha,
          beta: arm.beta,
          pullCount: arm.pullCount,
          successCount: arm.successCount
        }
      });
    }

    return model.id;
  }

  async loadModel(modelId: string): Promise<ThompsonSamplingBandit | null> {
    const model = await this.prisma.rLModelVersion.findUnique({
      where: { id: modelId },
      include: { arms: true }
    });

    if (!model) return null;

    const bandit = new ThompsonSamplingBandit({
      bucketSize: model.bucketSize
    });

    // Load arm states
    const state = bandit.getState();
    for (const arm of model.arms) {
      const key = arm.deltaC.toFixed(1);
      if (state.buckets.has(key)) {
        const bucket = state.buckets.get(key)!;
        bucket.alpha = arm.alpha;
        bucket.beta = arm.beta;
        bucket.pullCount = arm.pullCount;
        bucket.successCount = arm.successCount;
        bucket.avgReward = arm.avgReward;
      }
    }

    return bandit;
  }

  async saveModel(modelId: string, bandit: ThompsonSamplingBandit): Promise<void> {
    const state = bandit.getState();

    for (const [key, arm] of state.buckets) {
      await this.prisma.rLBanditArm.upsert({
        where: {
          modelId_deltaC: {
            modelId,
            deltaC: arm.deltaC
          }
        },
        create: {
          modelId,
          deltaC: arm.deltaC,
          alpha: arm.alpha,
          beta: arm.beta,
          pullCount: arm.pullCount,
          successCount: arm.successCount,
          avgReward: arm.avgReward
        },
        update: {
          alpha: arm.alpha,
          beta: arm.beta,
          pullCount: arm.pullCount,
          successCount: arm.successCount,
          avgReward: arm.avgReward,
          updatedAt: new Date()
        }
      });
    }
  }

  async getDeployedModel(): Promise<ModelMetadata | null> {
    const model = await this.prisma.rLModelVersion.findFirst({
      where: { status: 'DEPLOYED' },
      orderBy: { deployedAt: 'desc' }
    });

    if (!model) return null;

    return {
      id: model.id,
      version: model.version,
      algorithm: model.algorithm,
      status: model.status,
      bucketSize: model.bucketSize,
      trainedAt: model.trainedAt
    };
  }

  async deployModel(modelId: string): Promise<void> {
    await this.prisma.rLModelVersion.update({
      where: { id: modelId },
      data: {
        status: 'DEPLOYED',
        deployedAt: new Date()
      }
    });

    // Undeploy other models
    await this.prisma.rLModelVersion.updateMany({
      where: {
        id: { not: modelId },
        status: 'DEPLOYED'
      },
      data: { status: 'READY' }
    });
  }

  async logTraining(
    modelId: string,
    data: {
      eventId: string;
      attemptId: string;
      userId: string;
      questionId: string;
      knowledgePointId: string;
      recommendationId: string;
      preAccuracy: number;
      stateTheta: number;
      selectedDeltaC: number;
      reward: number;
      postAccuracy?: number;
      leDelta?: number;
    }
  ): Promise<string> {
    const log = await this.prisma.rLTrainingLog.create({
      data: {
        modelId,
        ...data
      }
    });

    return log.id;
  }

  async updateModelMetrics(modelId: string): Promise<void> {
    const logs = await this.prisma.rLTrainingLog.findMany({
      where: { modelId }
    });

    if (logs.length === 0) return;

    const avgReward = logs.reduce((sum, log) => sum + log.reward, 0) / logs.length;

    await this.prisma.rLModelVersion.update({
      where: { id: modelId },
      data: {
        avgReward,
        totalSelections: logs.length
      }
    });
  }
}
