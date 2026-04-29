/**
 * A/B Testing Framework for Prediction Service
 *
 * 功能：
 * - 实验分组（对照组/实验组）
 * - 效果追踪
 * - 统计显著性计算
 * - 实验结果分析
 *
 * 使用方式：
 * ```typescript
 * const experiment = abTesting.createExperiment('predict_v2', {
 *   control: { name: 'baseline', weight: 50 },
 *   treatment: { name: 'improved', weight: 50 }
 * });
 *
 * const variant = await experiment.assign(userId);
 * if (variant === 'treatment') {
 *   // 使用新模型
 * }
 * ```
 */

import { PrismaStore } from './store.prisma';

// ============================================================
// Types
// ============================================================

export interface Variant {
  name: string;
  weight: number;  // 百分比权重 (0-100)
}

export interface ExperimentConfig {
  id: string;
  description: string;
  variants: Record<string, Variant>;
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'paused' | 'completed';
  metrics: ExperimentMetric[];
}

export interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'continuous' | 'ratio';
  higherIsBetter: boolean;
}

export interface ExperimentAssignment {
  experimentId: string;
  userId: string;
  variant: string;
  assignedAt: Date;
}

export interface MetricObservation {
  experimentId: string;
  userId: string;
  variant: string;
  metricName: string;
  value: number;
  timestamp: Date;
}

export interface ExperimentResult {
  experimentId: string;
  variant: string;
  sampleSize: number;
  mean: number;
  variance: number;
  stdDev: number;
  confidenceInterval: [number, number];
  conversionRate?: number;
  uplift?: number;
  pValue?: number;
  significant: boolean;
  confidence: number;
}

// ============================================================
// Custom Errors
// ============================================================

export class ExperimentNotFoundError extends Error {
  constructor(experimentId: string) {
    super(`Experiment ${experimentId} not found`);
    this.name = 'ExperimentNotFoundError';
  }
}

export class InvalidVariantWeightsError extends Error {
  constructor(total: number) {
    super(`Variant weights must sum to 100, got ${total}`);
    this.name = 'InvalidVariantWeightsError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================
// Hash Function (FNV-1a for better distribution)
// ============================================================

function hashString(str: string): number {
  let hash = 2166136261;  // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;  // FNV prime, keep 32-bit
  }
  return hash;
}

function assignVariant(
  userId: string,
  experimentId: string,
  variants: Record<string, Variant>
): string {
  const hash = hashString(`${experimentId}:${userId}`);
  const bucket = hash % 100;

  let cumulative = 0;
  for (const [name, variant] of Object.entries(variants)) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return name;
    }
  }

  return Object.keys(variants)[0];
}

// ============================================================
// Statistical Functions
// ============================================================

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateVariance(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);
}

function calculateStdDev(variance: number): number {
  return Math.sqrt(variance);
}

function calculateConfidenceInterval(
  mean: number,
  stdDev: number,
  n: number,
  confidence: number = 0.95
): [number, number] {
  const zScore = confidence === 0.95 ? 1.96 : 1.645;
  const margin = zScore * (stdDev / Math.sqrt(n));
  return [mean - margin, mean + margin];
}

function calculatePValue(
  controlMean: number,
  treatmentMean: number,
  controlVariance: number,
  treatmentVariance: number,
  controlN: number,
  treatmentN: number
): number {
  if (controlN < 2 || treatmentN < 2) return 1;

  const pooledSE = Math.sqrt(controlVariance / controlN + treatmentVariance / treatmentN);
  if (pooledSE === 0) return 1;

  const tStat = Math.abs(treatmentMean - controlMean) / pooledSE;
  const pValue = 2 * (1 - normalCDF(tStat));
  return Math.max(0.0001, Math.min(1, pValue));
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function calculateUplift(
  controlMean: number,
  treatmentMean: number
): number {
  // Handle edge cases
  if (Math.abs(controlMean) < 0.0001) {
    return treatmentMean > 0 ? 100 : 0;
  }
  const uplift = ((treatmentMean - controlMean) / Math.abs(controlMean)) * 100;
  return isFinite(uplift) ? uplift : 0;
}

// ============================================================
// A/B Testing Engine
// ============================================================

export class ABTesting {
  private readonly MAX_OBSERVATIONS = 100000;
  private experiments: Map<string, ExperimentConfig> = new Map();
  private assignments: Map<string, ExperimentAssignment> = new Map();
  private observations: MetricObservation[] = [];
  private store: PrismaStore;

  constructor(store: PrismaStore) {
    this.store = store;
    this.initializeDefaultExperiments();
  }

  private initializeDefaultExperiments(): void {
    this.experiments.set('predict_accuracy_v1', {
      id: 'predict_accuracy_v1',
      description: '预测准确度对比：IRT模型 vs 简单规则',
      variants: {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'irt_model', weight: 50 }
      },
      startDate: new Date(),
      status: 'running',
      metrics: [
        { name: 'prediction_accuracy', type: 'ratio', higherIsBetter: true },
        { name: 'brier_score', type: 'continuous', higherIsBetter: false }
      ]
    });

    this.experiments.set('difficulty_strategy_v1', {
      id: 'difficulty_strategy_v1',
      description: '题目难度推荐策略对比',
      variants: {
        control: { name: 'random', weight: 33 },
        treatment: { name: 'adaptive', weight: 33 },
        treatment_v2: { name: 'spaced_repetition', weight: 34 }
      },
      startDate: new Date(),
      status: 'running',
      metrics: [
        { name: 'engagement_rate', type: 'ratio', higherIsBetter: true },
        { name: 'learning_gain', type: 'continuous', higherIsBetter: true }
      ]
    });
  }

  createExperiment(
    id: string,
    variants: Record<string, Variant>,
    options?: {
      description?: string;
      startDate?: Date;
      endDate?: Date;
      metrics?: ExperimentMetric[];
    }
  ): this {
    // P7: Validate weights sum to 100
    const totalWeight = Object.values(variants).reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new InvalidVariantWeightsError(totalWeight);
    }

    const config: ExperimentConfig = {
      id,
      description: options?.description || '',
      variants,
      startDate: options?.startDate || new Date(),
      endDate: options?.endDate,
      status: 'draft',
      metrics: options?.metrics || [
        { name: 'conversion', type: 'conversion', higherIsBetter: true }
      ]
    };

    this.experiments.set(id, config);
    return this;
  }

  // P5: Immutable update for status changes
  startExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    const updated: ExperimentConfig = { ...experiment, status: 'running' };
    this.experiments.set(experimentId, updated);
    return true;
  }

  pauseExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    const updated: ExperimentConfig = { ...experiment, status: 'paused' };
    this.experiments.set(experimentId, updated);
    return true;
  }

  completeExperiment(experimentId: string): boolean {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return false;

    const updated: ExperimentConfig = { ...experiment, status: 'completed' };
    this.experiments.set(experimentId, updated);
    return true;
  }

  // P4: Make assign async and await persistence
  async assign(experimentId: string, userId: string): Promise<string | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      console.warn(`Experiment ${experimentId} not found`);
      return null;
    }

    if (experiment.status !== 'running') {
      console.warn(`Experiment ${experimentId} is not running`);
      return null;
    }

    const assignmentKey = `${experimentId}:${userId}`;
    const existing = this.assignments.get(assignmentKey);
    if (existing) {
      return existing.variant;
    }

    const variant = assignVariant(userId, experimentId, experiment.variants);
    const assignment: ExperimentAssignment = {
      experimentId,
      userId,
      variant,
      assignedAt: new Date()
    };

    this.assignments.set(assignmentKey, assignment);

    // P1: Persist to database (fire-and-forget with error logging)
    await this.persistAssignment(assignment);

    return variant;
  }

  async observe(params: {
    experimentId: string;
    userId: string;
    metricName: string;
    value: number;
  }): Promise<void> {
    const { experimentId, userId, metricName, value } = params;

    const assignmentKey = `${experimentId}:${userId}`;
    const assignment = this.assignments.get(assignmentKey);

    if (!assignment) {
      console.warn(`No assignment for user ${userId} in experiment ${experimentId}`);
      return;
    }

    const observation: MetricObservation = {
      experimentId,
      userId,
      variant: assignment.variant,
      metricName,
      value,
      timestamp: new Date()
    };

    this.observations.push(observation);

    // P9: Limit memory growth
    if (this.observations.length > this.MAX_OBSERVATIONS) {
      this.observations = this.observations.slice(-this.MAX_OBSERVATIONS / 2);
    }

    // P1: Persist observation
    await this.persistObservation(observation);
  }

  getResults(experimentId: string): Map<string, ExperimentResult> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      return new Map();
    }

    const results = new Map<string, ExperimentResult>();
    const variantObservations = new Map<string, number[]>();

    for (const observation of this.observations) {
      if (observation.experimentId !== experimentId) continue;

      if (!variantObservations.has(observation.variant)) {
        variantObservations.set(observation.variant, []);
      }
      variantObservations.get(observation.variant)!.push(observation.value);
    }

    const variantStats = new Map<string, { mean: number; variance: number; n: number }>();

    for (const [variant, values] of variantObservations) {
      const mean = calculateMean(values);
      const variance = calculateVariance(values, mean);
      variantStats.set(variant, { mean, variance, n: values.length });
    }

    const controlVariant = Object.keys(experiment.variants)[0];
    const controlStats = variantStats.get(controlVariant);

    for (const [variant, stats] of variantStats) {
      const { mean, variance, n } = stats;
      const stdDev = calculateStdDev(variance);
      const ci = calculateConfidenceInterval(mean, stdDev, n);

      let uplift: number | undefined;
      let pValue: number | undefined;

      if (variant !== controlVariant && controlStats) {
        uplift = calculateUplift(controlStats.mean, mean);
        pValue = calculatePValue(
          controlStats.mean,
          mean,
          controlStats.variance,
          variance,
          controlStats.n,
          n
        );
      }

      const significant = pValue !== undefined && pValue < 0.05;
      const confidence = Math.min(0.99, 0.5 + n / 100);

      results.set(variant, {
        experimentId,
        variant,
        sampleSize: n,
        mean,
        variance,
        stdDev,
        confidenceInterval: ci,
        conversionRate: experiment.metrics[0]?.type === 'conversion' ? mean : undefined,
        uplift,
        pValue,
        significant,
        confidence
      } as ExperimentResult);
    }

    return results;
  }

  getSummary(experimentId: string): {
    experiment: ExperimentConfig;
    results: Array<ExperimentResult & { uplift?: number }>;
    winner?: string;
    recommendation: string;
  } {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new ExperimentNotFoundError(experimentId);
    }

    const results = this.getResults(experimentId);
    const resultsArray = Array.from(results.values());

    let winner: string | undefined;
    if (resultsArray.length >= 2) {
      const metric = experiment.metrics[0];
      if (metric) {
        let bestVariant: string | undefined;
        let bestValue = metric.higherIsBetter ? -Infinity : Infinity;

        for (const result of resultsArray) {
          const isBetter = metric.higherIsBetter
            ? result.mean > bestValue
            : result.mean < bestValue;

          if (isBetter && result.significant) {
            bestValue = result.mean;
            bestVariant = result.variant;
          }
        }

        winner = bestVariant;
      }
    }

    let recommendation = '';
    if (experiment.status === 'running') {
      const totalSamples = resultsArray.reduce((sum, r) => sum + r.sampleSize, 0);
      if (totalSamples < 100) {
        recommendation = '需要更多样本以得出可靠结论（建议 ≥100）';
      } else if (totalSamples < 500) {
        recommendation = '样本量适中，可以开始观察趋势';
      } else {
        recommendation = '样本量充足，可以做出结论';
      }
    } else if (experiment.status === 'completed') {
      if (winner) {
        recommendation = `建议全量上线变体 "${winner}"，预期提升效果显著`;
      } else {
        recommendation = '实验组与对照组无显著差异，考虑其他优化方向';
      }
    }

    return { experiment, results: resultsArray, winner, recommendation };
  }

  // P1: Implement actual persistence
  private async persistAssignment(assignment: ExperimentAssignment): Promise<void> {
    try {
      await this.store.saveExperimentAssignment({
        experimentId: assignment.experimentId,
        userId: assignment.userId,
        variant: assignment.variant
      });
    } catch (error) {
      console.error('Failed to persist assignment:', error);
    }
  }

  private async persistObservation(observation: MetricObservation): Promise<void> {
    try {
      await this.store.saveMetricObservation({
        experimentId: observation.experimentId,
        userId: observation.userId,
        variant: observation.variant,
        metricName: observation.metricName,
        value: observation.value
      });
    } catch (error) {
      console.error('Failed to persist observation:', error);
    }
  }

  getAllExperiments(): ExperimentConfig[] {
    return Array.from(this.experiments.values());
  }

  getExperiment(experimentId: string): ExperimentConfig | undefined {
    return this.experiments.get(experimentId);
  }
}

// ============================================================
// HTTP Route Definitions (for type-safe routing)
// ============================================================

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RouteDefinition {
  method: RouteMethod;
  path: string;
}

export const AB_TESTING_ROUTES: RouteDefinition[] = [
  { method: 'GET', path: '/experiments' },
  { method: 'GET', path: '/experiments/:id/results' },
  { method: 'POST', path: '/experiments/:id/assign' },
  { method: 'POST', path: '/experiments/:id/observe' },
  { method: 'POST', path: '/experiments/:id/start' },
  { method: 'POST', path: '/experiments/:id/complete' },
];

export function createABTestingRoutes(abTesting: ABTesting) {
  return AB_TESTING_ROUTES.map(route => ({
    ...route,
    handler: createHandler(route, abTesting)
  }));
}

function createHandler(route: RouteDefinition, abTesting: ABTesting) {
  switch (`${route.method}:${route.path}`) {
    case 'GET:/experiments':
      return async () => ({ experiments: abTesting.getAllExperiments() });

    case 'GET:/experiments/:id/results':
      return async (request: { params: { id: string } }) => {
        return abTesting.getSummary(request.params.id);
      };

    case 'POST:/experiments/:id/assign':
      return async (request: { params: { id: string }; body: { userId: string } }) => {
        const { id } = request.params;
        const { userId } = request.body;
        if (!userId) throw new ValidationError('userId is required');
        const variant = await abTesting.assign(id, userId);
        return { experimentId: id, userId, variant };
      };

    case 'POST:/experiments/:id/observe':
      return async (request: {
        params: { id: string };
        body: { userId: string; metricName: string; value: number }
      }) => {
        const { id } = request.params;
        const { userId, metricName, value } = request.body;
        await abTesting.observe({ experimentId: id, userId, metricName, value });
        return { recorded: true };
      };

    case 'POST:/experiments/:id/start':
      return async (request: { params: { id: string } }) => {
        return { success: abTesting.startExperiment(request.params.id) };
      };

    case 'POST:/experiments/:id/complete':
      return async (request: { params: { id: string } }) => {
        return { success: abTesting.completeExperiment(request.params.id) };
      };

    default:
      throw new Error(`Unknown route: ${route.method} ${route.path}`);
  }
}
