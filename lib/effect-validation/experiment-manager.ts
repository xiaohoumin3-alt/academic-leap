import type { ExperimentConfig, ExperimentResult, Variant } from './types';
import type { PrismaClient } from '@prisma/client';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class ExperimentManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createExperiment(config: ExperimentConfig): Promise<string> {
    const experiment = await this.prisma.effectExperiment.create({
      data: {
        name: config.name,
        controlTemplateId: config.controlTemplateId,
        treatmentTemplateId: config.treatmentTemplateId,
        targetMetric: config.targetMetric,
        minSampleSize: config.minSampleSize,
        status: 'draft',
      },
    });
    return experiment.id;
  }

  async assignVariant(userId: string, experimentId: string): Promise<Variant> {
    const existing = await this.prisma.effectAssignment.findUnique({
      where: {
        experimentId_userId: { experimentId, userId },
      },
    });

    if (existing) {
      return existing.variant as Variant;
    }

    const hash = simpleHash(`${experimentId}:${userId}`);
    const variant: Variant = hash % 2 === 0 ? 'control' : 'treatment';

    await this.prisma.effectAssignment.create({
      data: {
        experimentId,
        userId,
        variant,
      },
    });

    return variant;
  }

  async recordObservation(data: {
    experimentId: string;
    userId: string;
    variant: Variant;
    metricName: string;
    value: number;
  }): Promise<void> {
    await this.prisma.effectObservation.create({
      data: {
        experimentId: data.experimentId,
        userId: data.userId,
        variant: data.variant,
        metricName: data.metricName,
        value: data.value,
      },
    });
  }

  async analyzeExperiment(experimentId: string): Promise<ExperimentResult> {
    const experiment = await this.prisma.effectExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const observations = await this.prisma.effectObservation.groupBy({
      by: ['variant'],
      where: { experimentId },
      _avg: { value: true },
      _count: true,
    });

    const controlObs = observations.find(o => o.variant === 'control');
    const treatmentObs = observations.find(o => o.variant === 'treatment');

    const controlMean = controlObs?._avg.value ?? 0;
    const treatmentMean = treatmentObs?._avg.value ?? 0;
    const controlSample = controlObs?._count ?? 0;
    const treatmentSample = treatmentObs?._count ?? 0;

    const uplift = controlMean > 0
      ? ((treatmentMean - controlMean) / controlMean) * 100
      : 0;

    const pValue = this.calculatePValue(controlMean, treatmentMean, controlSample, treatmentSample);
    const significant = pValue < 0.05 && treatmentMean > controlMean;

    let recommendation: 'promote' | 'demote' | 'need_more_data';
    if (!significant && (controlSample < experiment.minSampleSize || treatmentSample < experiment.minSampleSize)) {
      recommendation = 'need_more_data';
    } else if (significant && treatmentMean > controlMean) {
      recommendation = 'promote';
    } else {
      recommendation = 'demote';
    }

    return {
      controlMean,
      controlSample,
      treatmentMean,
      treatmentSample,
      uplift,
      pValue,
      significant,
      recommendation,
    };
  }

  private calculatePValue(
    controlMean: number,
    treatmentMean: number,
    controlSample: number,
    treatmentSample: number
  ): number {
    const diff = Math.abs(treatmentMean - controlMean);
    const pooledSE = Math.sqrt((0.25 / controlSample) + (0.25 / treatmentSample));

    if (pooledSE === 0) return 1;

    const z = diff / pooledSE;
    return Math.max(0.001, Math.min(1, 2 * (1 - this.normalCDF(Math.abs(z)))));
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    z = Math.abs(z) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + y);
  }

  async startExperiment(experimentId: string): Promise<void> {
    await this.prisma.effectExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });
  }

  async completeExperiment(experimentId: string): Promise<void> {
    await this.prisma.effectExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }
}
