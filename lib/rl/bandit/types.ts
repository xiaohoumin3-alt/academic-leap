// lib/rl/bandit/types.ts

export interface BanditArm {
  deltaC: number;
  alpha: number;
  beta: number;
  pullCount: number;
  successCount: number;
  avgReward: number | null;
}

export interface BanditState {
  buckets: Map<string, BanditArm>;
  bucketSize: number;
}

export interface BanditSelection {
  deltaC: string;
  sample: number;
}

export interface SeededRNG {
  next(): number;
}

export interface Cloneable<T> {
  clone(): T;
}
