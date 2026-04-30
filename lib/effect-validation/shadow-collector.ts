import type { ShadowAttempt } from './types';
import type { PrismaClient } from '@prisma/client';

const MIN_SAMPLES_FOR_ANALYSIS = 50;

export class ShadowCollector {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addToShadowPool(templateId: string): Promise<void> {
    await this.prisma.canaryRelease.upsert({
      where: { templateId },
      create: {
        templateId,
        status: 'pending',
        trafficPercent: 0,
      },
      update: {},
    });
  }

  async recordShadowAttempt(data: Omit<ShadowAttempt, 'id' | 'recordedAt'>): Promise<void> {
    await this.prisma.shadowAttempt.create({
      data: {
        templateId: data.templateId,
        userId: data.userId,
        knowledgePoint: data.knowledgePoint,
        isCorrect: data.isCorrect,
        duration: data.duration,
        leDelta: data.leDelta,
      },
    });
  }

  async getSampleCount(templateId: string): Promise<number> {
    return this.prisma.shadowAttempt.count({
      where: { templateId },
    });
  }

  async isReadyForAnalysis(templateId: string): Promise<boolean> {
    const count = await this.getSampleCount(templateId);
    return count >= MIN_SAMPLES_FOR_ANALYSIS;
  }

  async getShadowAttempts(
    templateId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ShadowAttempt[]> {
    const attempts = await this.prisma.shadowAttempt.findMany({
      where: { templateId },
      orderBy: { recordedAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });

    return attempts.map(a => ({
      id: a.id,
      templateId: a.templateId,
      userId: a.userId,
      knowledgePoint: a.knowledgePoint,
      isCorrect: a.isCorrect,
      duration: a.duration,
      leDelta: a.leDelta ?? undefined,
      recordedAt: a.recordedAt,
    }));
  }

  async calculateAccuracy(templateId: string): Promise<{ accuracy: number; sample: number }> {
    const attempts = await this.prisma.shadowAttempt.findMany({
      where: { templateId },
      select: { isCorrect: true },
    });

    if (attempts.length === 0) {
      return { accuracy: 0, sample: 0 };
    }

    const correct = attempts.filter(a => a.isCorrect).length;
    return {
      accuracy: correct / attempts.length,
      sample: attempts.length,
    };
  }
}
