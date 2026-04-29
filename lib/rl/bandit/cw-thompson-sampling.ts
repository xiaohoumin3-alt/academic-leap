// lib/rl/bandit/cw-thompson-sampling.ts

import type { BanditArm, BanditState, Cloneable, SeededRNG } from './types';
import type { CWTSConfig } from '../config/phase2-features';

export interface ThompsonSamplingConfig {
  bucketSize: number;
  minDeltaC: number;
  maxDeltaC: number;
  priorAlpha: number;
  priorBeta: number;
}

export interface CWTSBanditState extends BanditState {
  confidenceWeights: Map<string, number>;
}

const DEFAULT_TS_CONFIG: ThompsonSamplingConfig = {
  bucketSize: 0.5,
  minDeltaC: 0,
  maxDeltaC: 10,
  priorAlpha: 1,
  priorBeta: 1,
};

export class CWThompsonSamplingBandit implements Cloneable<CWThompsonSamplingBandit> {
  private buckets: Map<string, BanditArm>;
  private rng?: SeededRNG;
  private readonly cwConfig: CWTSConfig;
  private readonly tsConfig: ThompsonSamplingConfig;

  constructor(cwConfig: CWTSConfig, tsConfig?: Partial<ThompsonSamplingConfig>) {
    this.cwConfig = cwConfig;
    this.tsConfig = { ...DEFAULT_TS_CONFIG, ...tsConfig };
    this.buckets = this.initializeBuckets();
  }

  private initializeBuckets(): Map<string, BanditArm> {
    const buckets = new Map<string, BanditArm>();
    const { minDeltaC, maxDeltaC, bucketSize, priorAlpha, priorBeta } = this.tsConfig;

    for (let d = minDeltaC; d <= maxDeltaC; d += bucketSize) {
      const key = d.toFixed(1);
      buckets.set(key, {
        deltaC: d,
        alpha: priorAlpha,
        beta: priorBeta,
        pullCount: 0,
        successCount: 0,
        avgReward: null,
      });
    }

    return buckets;
  }

  setSeed(seed: number): void {
    const { LinearCongruentialGenerator } = require('./seeded-rng');
    this.rng = new LinearCongruentialGenerator(seed);
  }

  clone(): CWThompsonSamplingBandit {
    const cloned = new CWThompsonSamplingBandit(this.cwConfig, this.tsConfig);

    for (const [key, arm] of this.buckets) {
      cloned.buckets.set(key, { ...arm });
    }

    if (this.rng) {
      cloned.rng = this.rng;
    }

    return cloned;
  }

  getState(): CWTSBanditState {
    const confidenceWeights = new Map<string, number>();

    for (const [key, arm] of this.buckets) {
      confidenceWeights.set(key, this.calculateConfidenceWeight(arm.pullCount));
    }

    return {
      buckets: new Map(this.buckets),
      bucketSize: this.tsConfig.bucketSize,
      confidenceWeights,
    };
  }

  calculateConfidenceWeight(pullCount: number): number {
    const { confidenceScale, minConfidence } = this.cwConfig;
    const confidence = 1 - Math.exp(-pullCount / confidenceScale);
    return Math.max(minConfidence, confidence);
  }

  selectArm(ability: number): string {
    const { minDeltaC, maxDeltaC, bucketSize } = this.tsConfig;
    const { enableCutoff, cutoffThreshold } = this.cwConfig;

    const lowerBound = Math.max(minDeltaC, ability - 1);
    const upperBound = Math.min(maxDeltaC, ability + 1);

    let bestDeltaC = lowerBound;
    let bestWeightedSample = -1;

    for (let d = lowerBound; d <= upperBound; d += bucketSize) {
      const key = d.toFixed(1);
      const bucket = this.buckets.get(key);
      if (!bucket) continue;

      const confidenceWeight = this.calculateConfidenceWeight(bucket.pullCount);

      if (enableCutoff && confidenceWeight < cutoffThreshold) {
        continue;
      }

      const betaSample = this.sampleBeta(bucket.alpha, bucket.beta);
      const weightedSample = betaSample * confidenceWeight;

      if (weightedSample > bestWeightedSample) {
        bestWeightedSample = weightedSample;
        bestDeltaC = d;
      }
    }

    if (bestWeightedSample === -1) {
      return this.fallbackSelection(lowerBound, upperBound, bucketSize);
    }

    return bestDeltaC.toFixed(1);
  }

  private fallbackSelection(
    lowerBound: number,
    upperBound: number,
    bucketSize: number
  ): string {
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
