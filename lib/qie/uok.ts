// lib/qie/uok.ts

import {
  Context,
  QuestionFeatures,
  QuestionState,
  StudentState,
  SpaceState,
  TraceEntry,
  Explanation,
  Action,
  Gap,
  UOKState,
  MLState,
} from './types';

/**
 * Unified Observability Kernel v2.0
 *
 * Single Source of Truth + Deterministic ML Subsystem
 */
export class UOK {
  private state: UOKState = {
    questions: new Map<string, QuestionState>(),
    students: new Map<string, StudentState>(),
    space: new SpaceState(),
    trace: [] as TraceEntry[],
    _ml: {
      embeddings: {
        students: new Map<string, Float32Array>(),
        questions: new Map<string, Float32Array>(),
      },
      weights: {
        w1: new Float32Array(0),
        b1: new Float32Array(0),
        w2: new Float32Array(0),
        b2: 0,
      },
      updateCounter: 0,
    },
  };

  private readonly dim = 32;
  private readonly hidden = 32;
  private readonly lr = 0.01;

  constructor() {
    this.initializeML();
  }

  private initializeML(): void {
    const inputDim = this.dim * 2 + 3;
    this.state._ml.weights.w1 = new Float32Array(inputDim * this.hidden);
    this.state._ml.weights.b1 = new Float32Array(this.hidden);
    this.state._ml.weights.w2 = new Float32Array(this.hidden);

    const std1 = Math.sqrt(2 / inputDim);
    const std2 = Math.sqrt(2 / this.hidden);

    for (let i = 0; i < this.state._ml.weights.w1.length; i++) {
      this.state._ml.weights.w1[i] = gaussian() * std1;
    }
    for (let i = 0; i < this.state._ml.weights.w2.length; i++) {
      this.state._ml.weights.w2[i] = gaussian() * std2;
    }
  }

  explain(): Explanation {
    return {
      type: 'system',
      totalQuestions: this.state.questions.size,
      totalStudents: this.state.students.size,
      totalAttempts: Array.from(this.state.students.values())
        .reduce((sum, s) => sum + s.attemptCount, 0),
      topics: Array.from(this.state.space.topics),
      traceLength: this.state.trace.length,
    };
  }
}

function gaussian(): number {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
