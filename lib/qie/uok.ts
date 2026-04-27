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

  /**
   * 编码题目到状态
   */
  encodeQuestion(question: {
    id: string;
    content: string;
    topics: string[];
  }): void {
    const features = this.extractFeatures(question.content);

    const qState: QuestionState = {
      id: question.id,
      topics: question.topics,
      features,
      quality: 0.5,
      attemptCount: 0,
      correctCount: 0,
    };

    this.state.questions.set(question.id, qState);
    this.state.space.update(question.topics, features);
    this.state.trace.push({
      type: 'encode',
      questionId: question.id,
      time: Date.now(),
    });
  }

  /**
   * 预测（只读 ML 状态）
   */
  predict(studentId: string, questionId: string, ctx: Context): number {
    const s = this.getEmbedding(this.state._ml.embeddings.students, studentId);
    const q = this.getEmbedding(this.state._ml.embeddings.questions, questionId);

    const x = this.embedInput(s, q, ctx);
    const h = this.relu(this.matmul(x, this.state._ml.weights.w1, this.state._ml.weights.b1));
    const z = this.dot(h, this.state._ml.weights.w2) + this.state._ml.weights.b2;
    return this.sigmoid(z);
  }

  explain(target?: { studentId?: string; questionId?: string }): Explanation {
    if (target?.studentId) {
      return this.explainStudent(target.studentId);
    }
    if (target?.questionId) {
      return this.explainQuestion(target.questionId);
    }
    return this.explainSystem();
  }

  private explainSystem(): Explanation {
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

  private explainQuestion(questionId: string): Explanation {
    const q = this.state.questions.get(questionId);
    if (!q) return { type: 'error', message: 'Question not found' };

    return {
      type: 'question',
      questionId,
      topics: q.topics,
      quality: q.quality,
      attempts: q.attemptCount,
      features: q.features,
    };
  }

  private explainStudent(studentId: string): Explanation {
    const s = this.state.students.get(studentId);
    if (!s) return { type: 'error', message: 'Student not found' };

    const weakTopics = Array.from(s.knowledge.entries())
      .filter(([_, m]) => m < 0.6)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([t, m]) => ({ topic: t, mastery: m }));

    return {
      type: 'student',
      studentId,
      ability: s.attemptCount > 0 ? s.correctCount / s.attemptCount : 0.5,
      weakTopics,
      totalAttempts: s.attemptCount,
    };
  }

  /**
   * Extract features from question content
   */
  private extractFeatures(content: string): QuestionFeatures {
    const cognitiveWords = ['同时', '分别', '至少', '所有'];
    let cognitiveLoad = 0;
    for (const w of cognitiveWords) {
      cognitiveLoad += (content.match(new RegExp(w, 'g')) || []).length * 0.2;
    }

    const reasoningWords: [string, number][] = [
      ['证明', 2], ['推导', 1.5], ['分析', 1], ['计算', 0.5],
    ];
    let reasoningDepth = 0;
    for (const [w, weight] of reasoningWords) {
      if (content.includes(w)) reasoningDepth += weight;
    }

    const nests = (content.match(/[()（）]/g) || []).length / 2;

    return {
      cognitiveLoad: Math.min(1, cognitiveLoad),
      reasoningDepth: Math.min(5, reasoningDepth),
      complexity: Math.min(1, nests / 5),
      difficulty: 0.5,
    };
  }

  private getOrCreateStudent(id: string): StudentState {
    let s = this.state.students.get(id);
    if (!s) {
      s = { id, knowledge: new Map(), attemptCount: 0, correctCount: 0 };
      this.state.students.set(id, s);
    }
    return s;
  }

  // ========== ML Helpers ==========

  private getEmbedding(
    map: Map<string, Float32Array>,
    id: string
  ): Float32Array {
    let emb = map.get(id);
    if (!emb) {
      emb = new Float32Array(this.dim);
      for (let i = 0; i < this.dim; i++) {
        emb[i] = gaussian() * 0.01;
      }
      map.set(id, emb);
    }
    return emb;
  }

  private embedInput(
    s: Float32Array,
    q: Float32Array,
    ctx: Context
  ): Float32Array {
    const x = new Float32Array(this.dim * 2 + 3);
    x.set(s, 0);
    x.set(q, this.dim);
    x[0] = ctx.difficulty;
    x[1] = ctx.complexity;
    x[2] = ctx.difficulty * ctx.complexity;
    return x;
  }

  private matmul(x: Float32Array, w: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(this.hidden);
    for (let j = 0; j < this.hidden; j++) {
      for (let i = 0; i < x.length; i++) {
        out[j] += x[i] * w[i * this.hidden + j];
      }
      out[j] += b[j];
    }
    return out;
  }

  private dot(x: Float32Array, y: Float32Array): number {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * y[i];
    return s;
  }

  private relu(x: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = Math.max(0, x[i]);
    return out;
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }
}

function gaussian(): number {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
