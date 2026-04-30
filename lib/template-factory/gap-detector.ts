import type { KnowledgeGap } from './types';
import type { PrismaClient } from '@prisma/client';

export class GapDetector {
  private prisma: PrismaClient;
  private targetTemplatesPerPoint = 3;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async detectGaps(): Promise<KnowledgeGap[]> {
    const knowledgePoints = await this.prisma.knowledgePoint.findMany({
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    const templateCounts = await this.prisma.template.groupBy({
      by: ['knowledgeId'],
      where: {
        status: 'published',
        knowledgeId: { not: null },
      },
      _count: true,
    });

    const countMap = new Map(
      templateCounts.map(t => [t.knowledgeId, t._count])
    );

    const gaps: KnowledgeGap[] = [];

    for (const kp of knowledgePoints) {
      const currentCount = countMap.get(kp.id) || 0;
      const gap = this.targetTemplatesPerPoint - currentCount;

      if (gap > 0) {
        gaps.push({
          knowledgePointId: kp.id,
          knowledgePointName: kp.name,
          currentTemplateCount: currentCount,
          targetTemplateCount: this.targetTemplatesPerPoint,
          gap,
          priority: this.calculatePriority(gap, kp.weight),
          estimatedDifficulty: this.estimateDifficulty(kp.weight),
        });
      }
    }

    gaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return b.gap - a.gap;
    });

    await this.updateCoverage(gaps);

    return gaps;
  }

  private calculatePriority(gap: number, weight: number): 'high' | 'medium' | 'low' {
    if (gap === this.targetTemplatesPerPoint) {
      return weight >= 5 ? 'high' : 'medium';
    } else if (gap >= 1) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private estimateDifficulty(weight: number): 'easy' | 'medium' | 'hard' {
    if (weight <= 3) return 'easy';
    if (weight <= 7) return 'medium';
    return 'hard';
  }

  private async updateCoverage(gaps: KnowledgeGap[]): Promise<void> {
    for (const gap of gaps) {
      await this.prisma.knowledgeCoverage.upsert({
        where: { knowledgePointId: gap.knowledgePointId },
        create: {
          knowledgePointId: gap.knowledgePointId,
          targetTemplateCount: gap.targetTemplateCount,
          currentTemplateCount: gap.currentTemplateCount,
          gap: gap.gap,
          priority: gap.priority,
        },
        update: {
          currentTemplateCount: gap.currentTemplateCount,
          gap: gap.gap,
          priority: gap.priority,
          lastUpdated: new Date(),
        },
      });
    }
  }
}
