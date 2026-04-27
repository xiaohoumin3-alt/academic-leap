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
  ComplexityTransferWeights,
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
      transfer: {
        weights: {
          cognitiveLoad: 1/3,
          reasoningDepth: 1/3,
          complexity: 1/3,
        },
        gateThreshold: 0.7,
        learningRate: 0.01,
      },
    },
  };

  private readonly dim = 32;
  private readonly hidden = 32;
  private readonly lr = 0.01;

  constructor() {
    this.initializeML();
  }

  /**
   * Get a copy of the current complexity transfer weights
   */
  getComplexityTransferWeights(): ComplexityTransferWeights {
    return { ...this.state._ml.transfer.weights };
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

  /**
   * 编码答案到状态（触发 ML 学习）
   *
   * @returns 学习前的预测概率
   */
  encodeAnswer(
    studentId: string,
    questionId: string,
    correct: boolean
  ): number {
    const q = this.state.questions.get(questionId);
    if (!q) return 0.5;

    // 0. 先预测（记录学习前的状态）
    const ctx: Context = {
      difficulty: q.features.difficulty,
      complexity: q.features.complexity,
    };
    const probability = this.predict(studentId, questionId, ctx);

    // 1. 更新公共状态
    q.attemptCount++;
    if (correct) q.correctCount++;
    q.quality = q.correctCount / q.attemptCount;

    const s = this.getOrCreateStudent(studentId);
    for (const topic of q.topics) {
      const current = s.knowledge.get(topic) ?? 0.5;
      const updated = 0.95 * current + 0.05 * (correct ? 1 : 0);
      s.knowledge.set(topic, updated);
    }
    s.attemptCount++;
    s.correctCount += correct ? 1 : 0;

    // 2. 触发 ML 学习（单写入口）
    this.learnML(studentId, questionId, ctx, correct);

    // 3. 记录轨迹
    this.state.trace.push({
      type: 'answer',
      studentId,
      questionId,
      correct,
      time: Date.now(),
    });

    return probability;
  }

  /**
   * 决策
   */
  act(intent: 'next_question' | 'gap_analysis', studentId: string): Action {
    const student = this.state.students.get(studentId);
    if (!student) {
      return { type: 'error', reason: 'Student not found' };
    }

    if (intent === 'next_question') {
      const weakTopic = this.findWeakestTopic(student);
      if (!weakTopic) {
        return { type: 'done', reason: 'All topics mastered' };
      }
      return {
        type: 'recommend',
        topic: weakTopic,
        reason: `Weakest topic (mastery: ${student.knowledge.get(weakTopic)?.toFixed(2)})`,
      };
    }

    if (intent === 'gap_analysis') {
      return { type: 'gap_report', gaps: this.findGaps(student) };
    }

    return { type: 'error', reason: 'Unknown intent' };
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

  /**
   * 🔒 单写入口：ML 状态的唯一修改点
   */
  private learnML(
    studentId: string,
    questionId: string,
    ctx: Context,
    correct: boolean
  ): void {
    const { _ml } = this.state;

    // Forward pass
    const s = this.getEmbedding(_ml.embeddings.students, studentId);
    const q = this.getEmbedding(_ml.embeddings.questions, questionId);
    const x = this.embedInput(s, q, ctx);

    const h1 = this.matmul(x, _ml.weights.w1, _ml.weights.b1);
    const h = this.relu(h1);
    const z = this.dot(h, _ml.weights.w2) + _ml.weights.b2;
    const p = this.sigmoid(z);

    // Backward pass
    const y = correct ? 1 : 0;
    const dz = p - y;
    const dh = this.reluGrad(h1, this.mul(_ml.weights.w2, dz));

    // Compute embedding gradients
    // ds[j] = sum_i (w1[j * hidden + i] * dh[i])
    const ds = new Float32Array(this.dim);
    const dq = new Float32Array(this.dim);
    for (let j = 0; j < this.dim; j++) {
      for (let i = 0; i < this.hidden; i++) {
        ds[j] += _ml.weights.w1[j * this.hidden + i] * dh[i];
        dq[j] += _ml.weights.w1[(this.dim + j) * this.hidden + i] * dh[i];
      }
    }

    // Update weights
    for (let i = 0; i < _ml.weights.w2.length; i++) {
      _ml.weights.w2[i] -= this.lr * dz * h[i];
    }
    _ml.weights.b2 -= this.lr * dz;

    for (let i = 0; i < _ml.weights.w1.length; i++) {
      const inputIdx = Math.floor(i / this.hidden);
      const hiddenIdx = i % this.hidden;
      _ml.weights.w1[i] -= this.lr * x[inputIdx] * dh[hiddenIdx];
    }

    // Update embeddings
    this.updateEmbedding(_ml.embeddings.students, studentId, ds);
    this.updateEmbedding(_ml.embeddings.questions, questionId, dq);

    // Periodic normalization
    if (++_ml.updateCounter % 1000 === 0) {
      this._normalizeML();
    }
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

  private findWeakestTopic(student: StudentState): string | null {
    let weakest: string | null = null;
    let minMastery = 1;
    for (const [topic, mastery] of student.knowledge) {
      if (mastery < minMastery) {
        minMastery = mastery;
        weakest = topic;
      }
    }
    return weakest;
  }

  private findGaps(student: StudentState): Gap[] {
    const gaps: Gap[] = [];
    for (const [topic, mastery] of student.knowledge) {
      if (mastery < 0.6) {
        gaps.push({ topic, mastery, type: 'weak_knowledge' });
      }
    }
    for (const topic of this.state.space.topics) {
      const count = this.state.space.getCount(topic);
      if (count < 5) {
        gaps.push({ topic, mastery: 0, type: 'missing_questions', count });
      }
    }
    return gaps;
  }

  // ========== Additional ML Helpers ==========

  private mul(w: Float32Array, s: number): Float32Array {
    const out = new Float32Array(w.length);
    for (let i = 0; i < w.length; i++) out[i] = w[i] * s;
    return out;
  }

  private reluGrad(x: Float32Array, dy: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? dy[i] : 0;
    return out;
  }

  private updateEmbedding(
    map: Map<string, Float32Array>,
    id: string,
    grad: Float32Array
  ): void {
    const emb = map.get(id);
    if (emb) {
      for (let i = 0; i < emb.length; i++) {
        emb[i] -= this.lr * grad[i];
      }
    }
  }

  private _normalizeML(): void {
    const all = Array.from(this.state._ml.embeddings.students.values());
    if (all.length <= 10) return;

    let sum = 0, count = 0;
    for (const emb of all) {
      for (const v of emb) { sum += v; count++; }
    }
    const mu = sum / count;

    let varSum = 0;
    for (const emb of all) {
      for (const v of emb) { varSum += (v - mu) ** 2; }
    }
    const sigma = Math.sqrt(varSum / count);

    for (const emb of all) {
      for (let i = 0; i < emb.length; i++) {
        emb[i] = (emb[i] - mu) / sigma;
      }
    }
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
    x[this.dim * 2] = ctx.difficulty;
    x[this.dim * 2 + 1] = ctx.complexity;
    x[this.dim * 2 + 2] = ctx.difficulty * ctx.complexity;
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
