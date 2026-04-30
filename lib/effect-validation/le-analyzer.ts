import type { LEResult, GlobalLEResult, AnomalyReport, Trend } from './types';
import type { PrismaClient } from '@prisma/client';

const LE_TARGET = 0.15;
const ANOMALY_THRESHOLD = 0.1;

export class LEAnalyzer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculateLE(knowledgePointId: string): Promise<LEResult> {
    const results = await this.prisma.rLTrainingLog.groupBy({
      by: ['knowledgePointId'],
      where: {
        knowledgePointId,
        postAccuracy: { not: null },
        leDelta: { not: null },
      },
      _avg: { leDelta: true },
      _count: true,
    });

    if (results.length === 0) {
      return {
        knowledgePointId,
        le: 0,
        confidence: 0,
        sampleSize: 0,
        trend: 'stable',
      };
    }

    const result = results[0];
    const le = result._avg.leDelta ?? 0;
    const sampleSize = result._count;
    const confidence = Math.min(1, sampleSize / 100);

    let trend: Trend = 'stable';
    if (le >= LE_TARGET) trend = 'improving';
    else if (le < LE_TARGET * 0.7) trend = 'declining';

    return {
      knowledgePointId,
      le,
      confidence,
      sampleSize,
      trend,
    };
  }

  async calculateGlobalLE(): Promise<GlobalLEResult> {
    const results = await this.prisma.rLTrainingLog.groupBy({
      by: ['knowledgePointId'],
      where: {
        postAccuracy: { not: null },
        leDelta: { not: null },
      },
      _avg: { leDelta: true },
      _count: true,
    });

    if (results.length === 0) {
      return {
        le: 0,
        confidence: 0,
        trend: 'stable',
        byKnowledgePoint: [],
      };
    }

    const totalLE = results.reduce((sum, r) => sum + (r._avg.leDelta ?? 0), 0);
    const le = totalLE / results.length;
    const totalSample = results.reduce((sum, r) => sum + r._count, 0);
    const confidence = Math.min(1, totalSample / 100);

    const byKnowledgePoint: LEResult[] = results.map(r => ({
      knowledgePointId: r.knowledgePointId,
      le: r._avg.leDelta ?? 0,
      confidence: Math.min(1, r._count / 100),
      sampleSize: r._count,
      trend: 'stable',
    }));

    return {
      le,
      confidence,
      trend: this.determineTrend(byKnowledgePoint),
      byKnowledgePoint,
    };
  }

  async calculateUplift(experimentId: string): Promise<{
    uplift: number;
    significant: boolean;
    pValue: number;
  }> {
    const observations = await this.prisma.effectObservation.groupBy({
      by: ['variant'],
      where: { experimentId },
      _avg: { value: true },
      _count: true,
    });

    const control = observations.find(o => o.variant === 'control');
    const treatment = observations.find(o => o.variant === 'treatment');

    if (!control || !treatment) {
      return { uplift: 0, significant: false, pValue: 1 };
    }

    const controlMean = control._avg.value ?? 0;
    const treatmentMean = treatment._avg.value ?? 0;

    const uplift = controlMean > 0
      ? ((treatmentMean - controlMean) / controlMean) * 100
      : 0;

    const pValue = this.calculatePValue(controlMean, treatmentMean, control._count, treatment._count);

    return {
      uplift,
      significant: pValue < 0.05 && treatmentMean > controlMean,
      pValue,
    };
  }

  async detectAnomalies(): Promise<AnomalyReport[]> {
    const anomalies: AnomalyReport[] = [];
    const globalLE = await this.calculateGlobalLE();

    if (globalLE.le < LE_TARGET * (1 - ANOMALY_THRESHOLD)) {
      anomalies.push({
        type: 'le_drop',
        severity: 'warning',
        details: {
          metric: 'global_le',
          expected: LE_TARGET,
          actual: globalLE.le,
          deviation: (LE_TARGET - globalLE.le) / LE_TARGET,
        },
        detectedAt: new Date(),
      });
    }

    for (const kpLE of globalLE.byKnowledgePoint) {
      if (kpLE.le < LE_TARGET * 0.5) {
        anomalies.push({
          type: 'le_drop',
          severity: 'danger',
          details: {
            metric: `kp_${kpLE.knowledgePointId}_le`,
            expected: LE_TARGET,
            actual: kpLE.le,
            deviation: (LE_TARGET - kpLE.le) / LE_TARGET,
          },
          detectedAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  private determineTrend(kpResults: LEResult[]): Trend {
    const improving = kpResults.filter(r => r.trend === 'improving').length;
    const declining = kpResults.filter(r => r.trend === 'declining').length;

    if (improving > declining * 2) return 'improving';
    if (declining > improving * 2) return 'declining';
    return 'stable';
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
}