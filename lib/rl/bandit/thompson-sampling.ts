// lib/rl/bandit/thompson-sampling.ts

import type { BanditArm, BanditState, Cloneable } from './types';
import type { SeededRNG } from './seeded-rng';

export interface ThompsonSamplingConfig {
  bucketSize: number;
  minDeltaC: number;
  maxDeltaC: number;
  priorAlpha: number;
  priorBeta: number;
}

export interface CSValidationConfig {
  seeds: number[];
  ability: number;
  trials: number;
}

export interface CSValidationResult {
  csScore: number;
  pass: boolean;
  details: Array<{
    seed: number;
    recommendations: string[];
    distribution: Map<string, number>;
  }>;
}

const DEFAULT_CONFIG: ThompsonSamplingConfig = {
  bucketSize: 0.5,
  minDeltaC: 0,
  maxDeltaC: 10,
  priorAlpha: 1,
  priorBeta: 1
};

export class ThompsonSamplingBandit implements Cloneable<ThompsonSamplingBandit> {
  private buckets: Map<string, BanditArm>;
  private rng?: SeededRNG;
  private readonly config: ThompsonSamplingConfig;

  constructor(config?: Partial<ThompsonSamplingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buckets = this.initializeBuckets();
  }

  private initializeBuckets(): Map<string, BanditArm> {
    const buckets = new Map<string, BanditArm>();
    const { minDeltaC, maxDeltaC, bucketSize, priorAlpha, priorBeta } = this.config;

    for (let d = minDeltaC; d <= maxDeltaC; d += bucketSize) {
      const key = d.toFixed(1);
      buckets.set(key, {
        deltaC: d,
        alpha: priorAlpha,
        beta: priorBeta,
        pullCount: 0,
        successCount: 0,
        avgReward: null
      });
    }

    return buckets;
  }

  setSeed(seed: number): void {
    // Import dynamically to avoid circular dependency
    const { LinearCongruentialGenerator } = require('./seeded-rng');
    this.rng = new LinearCongruentialGenerator(seed);
  }

  clone(): ThompsonSamplingBandit {
    const cloned = new ThompsonSamplingBandit(this.config);

    // Copy bucket states
    for (const [key, arm] of this.buckets) {
      cloned.buckets.set(key, { ...arm });
    }

    // Preserve RNG if set
    if (this.rng) {
      cloned.rng = this.rng;
    }

    return cloned;
  }

  getState(): BanditState {
    return {
      buckets: new Map(this.buckets),
      bucketSize: this.config.bucketSize
    };
  }

  selectArm(ability: number): string {
    const { minDeltaC, maxDeltaC, bucketSize } = this.config;

    // Constrain to ability neighborhood
    const lowerBound = Math.max(minDeltaC, ability - 1);
    const upperBound = Math.min(maxDeltaC, ability + 1);

    let bestDeltaC = lowerBound;
    let bestSample = -1;

    for (let d = lowerBound; d <= upperBound; d += bucketSize) {
      const key = d.toFixed(1);
      const bucket = this.buckets.get(key);
      if (!bucket) continue;

      const sample = this.sampleBeta(bucket.alpha, bucket.beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestDeltaC = d;
      }
    }

    return bestDeltaC.toFixed(1);
  }

  update(deltaC: string, success: boolean): void {
    const bucket = this.buckets.get(deltaC);
    if (!bucket) return;

    if (success) {
      bucket.alpha++;
      bucket.successCount++;
    } else {
      bucket.beta++;
    }

    bucket.pullCount++;
    bucket.avgReward = bucket.successCount / bucket.pullCount;
  }

  private sampleBeta(alpha: number, beta: number): number {
    const u1 = this.sampleGamma(alpha);
    const u2 = this.sampleGamma(beta);
    return u1 / (u1 + u2);
  }

  private sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(this.random(), 1 / shape);
    }

    // Marsaglia and Tsang's method
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      const x = this.gaussianRandom();
      const v = Math.pow(1 + c * x, 3);

      if (v > 0) {
        const u = this.random();
        if (u < 1 - 0.0331 * Math.pow(x, 2)) {
          return d * v;
        }
        if (Math.log(u) < 0.5 * Math.pow(x, 2) + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
  }

  private gaussianRandom(): number {
    const u = this.random();
    const v = this.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private random(): number {
    return this.rng ? this.rng.next() : Math.random();
  }
}

// CS Validation
export function validateThompsonStability(
  bandit: ThompsonSamplingBandit,
  config: CSValidationConfig
): CSValidationResult {
  const results: CSValidationResult['details'] = [];

  for (const seed of config.seeds) {
    const b = bandit.clone();
    b.setSeed(seed);

    const recommendations: string[] = [];
    for (let i = 0; i < config.trials; i++) {
      const arm = b.selectArm(config.ability);
      recommendations.push(arm);
    }

    const distribution = new Map<string, number>();
    for (const arm of recommendations) {
      distribution.set(arm, (distribution.get(arm) ?? 0) + 1);
    }

    results.push({ seed, recommendations, distribution });
  }

  const csScore = calculateAverageJaccardSimilarity(results);

  return {
    csScore,
    pass: csScore >= 0.85,
    details: results
  };
}

function calculateAverageJaccardSimilarity(
  results: Array<{ recommendations: string[] }>
): number {
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const set1 = new Set(results[i].recommendations);
      const set2 = new Set(results[j].recommendations);

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);

      const jaccard = intersection.size / union.size;
      totalSimilarity += jaccard;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalSimilarity / comparisons : 0;
}
