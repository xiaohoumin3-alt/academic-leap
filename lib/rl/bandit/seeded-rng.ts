// lib/rl/bandit/seeded-rng.ts

export interface SeededRNG {
  next(): number;
  setSeed(seed: number): void;
}

export class LinearCongruentialGenerator implements SeededRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed;
  }

  setSeed(seed: number): void {
    this.state = seed;
  }

  next(): number {
    // LCG parameters from glibc (used by GCC)
    const a = 1103515245;
    const c = 12345;
    const m = 2 ** 31;

    this.state = (a * this.state + c) % m;
    return this.state / m;
  }
}
