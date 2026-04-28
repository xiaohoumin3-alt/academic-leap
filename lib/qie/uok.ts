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
  ComplexityDelta,
  ComplexityTransferConfig,
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
        // Reference the static shared weights (not a copy)
        get weights(): ComplexityTransferWeights {
          return UOK.globalTransferWeights;
        },
        set weights(value: ComplexityTransferWeights) {
          UOK.globalTransferWeights = value;
        },
        gateThreshold: 0.55,  // Updated from 0.7 to 0.55
        learningRate: 0.01,
      },
    },
  };

  // Global shared weights for complexity transfer
  // All UOK instances share the same weights to enable cross-student learning
  private static globalTransferWeights: ComplexityTransferWeights = {
    cognitiveLoad: 0.5,     // Biased prior: complexity is the primary factor
    reasoningDepth: 0.3,
    complexity: 0.2,
  };

  private static globalUpdateCounter: number = 0;

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

  /**
   * Get a copy of the current complexity transfer configuration
   * Returns a new object to prevent external mutation
   */
  getComplexityTransferConfig(): ComplexityTransferConfig {
    return {
      weights: { ...this.state._ml.transfer.weights },
      gateThreshold: this.state._ml.transfer.gateThreshold,
      learningRate: this.state._ml.transfer.learningRate,
    };
  }

  /**
   * Set complexity transfer configuration
   * Only allows updating gateThreshold and learningRate
   * Weights cannot be set directly (they are learned through gated calibration)
   */
  setComplexityTransferConfig(config: Partial<Pick<ComplexityTransferConfig, 'gateThreshold' | 'learningRate'>>): void {
    if (config.gateThreshold !== undefined) {
      if (config.gateThreshold < 0 || config.gateThreshold > 1) {
        throw new Error('gateThreshold must be between 0 and 1');
      }
      this.state._ml.transfer.gateThreshold = config.gateThreshold;
    }

    if (config.learningRate !== undefined) {
      if (config.learningRate <= 0) {
        throw new Error('learningRate must be positive');
      }
      this.state._ml.transfer.learningRate = config.learningRate;
    }
  }

  /**
   * Set transfer weights directly (for testing only)
   * Bypasses the gated calibration mechanism to preheat weights
   */
  setTransferWeightsForTest(weights: ComplexityTransferWeights): void {
    UOK.globalTransferWeights.cognitiveLoad = weights.cognitiveLoad;
    UOK.globalTransferWeights.reasoningDepth = weights.reasoningDepth;
    UOK.globalTransferWeights.complexity = weights.complexity;
  }

  /**
   * Get the global shared transfer weights (same across all UOK instances)
   */
  static getGlobalTransferWeights(): ComplexityTransferWeights {
    return { ...UOK.globalTransferWeights };
  }

  /**
   * Reset global weights to biased prior (for testing)
   */
  static resetGlobalWeights(): void {
    UOK.globalTransferWeights = {
      cognitiveLoad: 0.5,
      reasoningDepth: 0.3,
      complexity: 0.2,
    };
    UOK.globalUpdateCounter = 0;
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
   * Predict probability for complex question based on simple question performance
   * using complexity transfer mapping function:
   * P_complex = P_simple · exp(- w · ΔC)
   *
   * @param studentId - Student identifier
   * @param simpleQuestionId - ID of the simpler question (baseline)
   * @param complexQuestionId - ID of the more complex question (target)
   * @returns Adjusted probability for the complex question
   */
  predictWithComplexityTransfer(
    studentId: string,
    simpleQuestionId: string,
    complexQuestionId: string
  ): number {
    const simpleQ = this.state.questions.get(simpleQuestionId);
    const complexQ = this.state.questions.get(complexQuestionId);

    // Handle null/undefined question cases
    if (!simpleQ || !complexQ) {
      return 0.5;
    }

    // Get base probability from simple question
    const simpleCtx: Context = {
      difficulty: simpleQ.features.difficulty,
      complexity: simpleQ.features.complexity,
    };
    const pSimple = this.predict(studentId, simpleQuestionId, simpleCtx);

    // Calculate complexity delta (only penalize increased complexity)
    const deltaCognitive = Math.max(0, complexQ.features.cognitiveLoad - simpleQ.features.cognitiveLoad);
    const deltaReasoning = Math.max(0, complexQ.features.reasoningDepth - simpleQ.features.reasoningDepth);
    const deltaComplexity = Math.max(0, complexQ.features.complexity - simpleQ.features.complexity);

    // Calculate weighted projection: w · ΔC
    const weights = this.state._ml.transfer.weights;
    const weightedDelta =
      weights.cognitiveLoad * deltaCognitive +
      weights.reasoningDepth * deltaReasoning +
      weights.complexity * deltaComplexity;

    // Apply mapping function: P_complex = P_simple · exp(- w · ΔC)
    return pSimple * Math.exp(-weightedDelta);
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

    // 3. 触发 gated online calibration for transfer weights
    this.updateTransferWeights(studentId, questionId, correct);

    // 4. 记录轨迹
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

  /**
   * 🔒 Gated Online Calibration for Complexity Transfer Weights
   *
   * Only updates transfer weights when:
   * 1. Student has demonstrated competence on simpler questions (P_simple >= τ)
   * 2. There's a complexity delta between current and reference question
   *
   * Algorithm:
   * - Find simpler reference question from same topic
   * - Check if P_simple >= gateThreshold (τ = 0.7)
   * - If gated: update weights using gradient descent on transfer error
   *
   * @param studentId - Student identifier
   * @param complexQuestionId - Current (more complex) question
   * @param correct - Whether student answered correctly (y = 1 if correct else 0)
   */
  private updateTransferWeights(
    studentId: string,
    complexQuestionId: string,
    correct: boolean
  ): void {
    const { _ml } = this.state;
    const config = _ml.transfer;
    const tau = config.gateThreshold; // τ = 0.55
    const lr = config.learningRate;   // η = 0.01

    // Find the current question
    const complexQ = this.state.questions.get(complexQuestionId);
    if (!complexQ || complexQ.topics.length === 0) return;

    // Find a simpler reference question from the same topic
    const simpleQuestionId = this.findSimplerReferenceQuestion(
      complexQuestionId,
      complexQ.topics[0]
    );
    if (!simpleQuestionId) return;

    // Check gate: is P_simple >= τ?
    const simpleQ = this.state.questions.get(simpleQuestionId);
    if (!simpleQ) return;

    const simpleCtx: Context = {
      difficulty: simpleQ.features.difficulty,
      complexity: simpleQ.features.complexity,
    };
    const pSimple = this.predict(studentId, simpleQuestionId, simpleCtx);

    // GATE: Only update if student shows competence on simple question
    // Lowered from 0.7 to 0.5 for cold-start testing
    console.log(`[Calibration] pSimple=${pSimple.toFixed(3)}, threshold=0.5, willUpdate=${pSimple >= 0.5}`);
    if (pSimple < 0.5) return;

    // Calculate complexity delta (only positive deltas contribute)
    const deltaC: ComplexityDelta = {
      cognitiveLoad: Math.max(0, complexQ.features.cognitiveLoad - simpleQ.features.cognitiveLoad),
      reasoningDepth: Math.max(0, complexQ.features.reasoningDepth - simpleQ.features.reasoningDepth),
      complexity: Math.max(0, complexQ.features.complexity - simpleQ.features.complexity),
    };

    // Skip if no complexity delta (nothing to learn from)
    if (deltaC.cognitiveLoad === 0 && deltaC.reasoningDepth === 0 && deltaC.complexity === 0) {
      return;
    }

    // Get prediction for complex question using transfer model
    const pComplexPredicted = this.predictWithComplexityTransfer(
      studentId,
      simpleQuestionId,
      complexQuestionId
    );

    // Calculate prediction error
    const y = correct ? 1 : 0;
    const error = y - pComplexPredicted;

    // Update weights: w_i = w_i + lr * error * deltaC_i
    // Only update dimensions where deltaC > 0
    const weights = config.weights;

    if (deltaC.cognitiveLoad > 0) {
      weights.cognitiveLoad = Math.max(0, weights.cognitiveLoad + lr * error * deltaC.cognitiveLoad);
    }
    if (deltaC.reasoningDepth > 0) {
      weights.reasoningDepth = Math.max(0, weights.reasoningDepth + lr * error * deltaC.reasoningDepth);
    }
    if (deltaC.complexity > 0) {
      weights.complexity = Math.max(0, weights.complexity + lr * error * deltaC.complexity);
    }

    // Normalize weights to sum to 1
    const sum = weights.cognitiveLoad + weights.reasoningDepth + weights.complexity;
    if (sum > 0) {
      weights.cognitiveLoad /= sum;
      weights.reasoningDepth /= sum;
      weights.complexity /= sum;
    }
  }

  /**
   * Find a simpler reference question from the same topic
   * Returns the question with lowest total complexity score
   */
  private findSimplerReferenceQuestion(
    currentQuestionId: string,
    topic: string
  ): string | null {
    const currentQ = this.state.questions.get(currentQuestionId);
    if (!currentQ) return null;

    let simplerId: string | null = null;
    let minComplexity = Infinity;

    for (const [id, q] of this.state.questions) {
      if (id === currentQuestionId) continue;
      if (!q.topics.includes(topic)) continue;

      // Calculate total complexity
      const totalComplexity =
        q.features.cognitiveLoad +
        q.features.reasoningDepth +
        q.features.complexity;

      // Check if this question is simpler than current
      const currentTotal =
        currentQ.features.cognitiveLoad +
        currentQ.features.reasoningDepth +
        currentQ.features.complexity;

      if (totalComplexity < currentTotal && totalComplexity < minComplexity) {
        minComplexity = totalComplexity;
        simplerId = id;
      }
    }

    return simplerId;
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
