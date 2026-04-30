import { CANARY_STAGES, STAGE_DURATION_HOURS } from './types';
import type { CanaryRelease, HealthStatus } from './types';
import type { PrismaClient } from '@prisma/client';

export class CanaryController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async startCanary(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'running',
        currentStage: 0,
        trafficPercent: CANARY_STAGES[0],
        startedAt: new Date(),
      },
    });

    await this.prisma.canaryStageHistory.create({
      data: {
        canaryId: templateId,
        stage: 0,
        trafficPercent: CANARY_STAGES[0],
      },
    });
  }

  async getCurrentTraffic(templateId: string): Promise<number> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });
    return canary?.trafficPercent ?? 0;
  }

  async increaseTraffic(templateId: string): Promise<void> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
    });

    if (!canary) {
      throw new Error(`Canary not found for template ${templateId}`);
    }

    const nextStage = canary.currentStage + 1;
    const isFinalStage = nextStage >= CANARY_STAGES.length;

    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        currentStage: isFinalStage ? canary.currentStage : nextStage,
        trafficPercent: isFinalStage ? 100 : CANARY_STAGES[nextStage],
        status: isFinalStage ? 'completed' : 'running',
      },
    });

    if (!isFinalStage) {
      await this.prisma.canaryStageHistory.updateMany({
        where: { canaryId: templateId, exitedAt: null },
        data: { exitedAt: new Date() },
      });

      await this.prisma.canaryStageHistory.create({
        data: {
          canaryId: templateId,
          stage: nextStage,
          trafficPercent: CANARY_STAGES[nextStage],
        },
      });
    }
  }

  async checkHealth(templateId: string): Promise<{ status: HealthStatus; message?: string }> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
      include: { history: { orderBy: { enteredAt: 'desc' }, take: 1 } },
    });

    if (!canary || canary.status !== 'running') {
      return { status: 'healthy' };
    }

    const lastStage = canary.history[0];
    if (lastStage) {
      const hoursSinceEnter = (Date.now() - lastStage.enteredAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceEnter < STAGE_DURATION_HOURS) {
        return {
          status: 'healthy',
          message: `Stage ${canary.currentStage + 1} - ${Math.round(STAGE_DURATION_HOURS - hoursSinceEnter)}h remaining`,
        };
      }
    }

    return { status: 'healthy' };
  }

  async rollback(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: {
        status: 'rolled_back',
        trafficPercent: 0,
      },
    });
  }

  async pause(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'paused' },
    });
  }

  async resume(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.update({
      where: { templateId },
      data: { status: 'running' },
    });
  }

  async getCanaryStatus(templateId: string): Promise<CanaryRelease | null> {
    const canary = await this.prisma.canaryRelease.findUnique({
      where: { templateId },
      include: { history: { orderBy: { enteredAt: 'desc' } } },
    });

    if (!canary) return null;

    return {
      id: canary.id,
      templateId: canary.templateId,
      currentStage: canary.currentStage,
      trafficPercent: canary.trafficPercent,
      status: canary.status as CanaryRelease['status'],
      startedAt: canary.startedAt ?? undefined,
      lastHealthCheck: canary.lastHealthCheck ?? undefined,
      healthStatus: canary.healthStatus as HealthStatus | undefined,
    };
  }

  async getActiveCanaries(): Promise<CanaryRelease[]> {
    const canaries = await this.prisma.canaryRelease.findMany({
      where: { status: { in: ['running', 'paused'] } },
    });

    return canaries.map(c => ({
      id: c.id,
      templateId: c.templateId,
      currentStage: c.currentStage,
      trafficPercent: c.trafficPercent,
      status: c.status as CanaryRelease['status'],
    }));
  }
}
