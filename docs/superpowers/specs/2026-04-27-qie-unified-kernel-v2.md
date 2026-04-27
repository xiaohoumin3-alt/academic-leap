# QIE Unified Kernel v2.0 - Single Source of Truth

**日期**: 2026-04-27
**状态**: v2.0 极限版（统一架构）

---

## 核心定位

> **一个系统，一个状态机，一个 ML 子系统**

```
                    ┌─────────────────────────────────┐
input ─────────────▶│           UOK Kernel             │
                    │                                 │
                    │  state (storage truth)          │
                    │  ├─ questions (Map)              │
                    │  ├─ students (Map)               │
                    │  ├─ space (SpaceState)           │
                    │  ├─ trace (TraceEntry[])         │
                    │  └─ _ml (computation domain)     │
                    │      ├─ embeddings               │
                    │      └─ weights                  │
                    │                                 │
                    │  公共 API:                       │
                    │  ├─ encodeQuestion()            │
                    │  ├─ encodeAnswer() → number     │
                    │  ├─ explain()                 │   │
                    │  └─ act()                     │   │
                    │                                 │
                    │  私有 ML 子系统:                 │   │
                    │  └─ learnML() ◀─────────────┘   │
                    │      (唯一写入点)                  │
                    └─────────────────────────────────┘
```

---

## 核心原则

### 1. Single Source of Truth

```
state = storage truth（唯一存储层）
  ├─ questions / students / space / trace（公共状态）
  └─ _ml（内部计算域）
```

**关键约束：**
- 所有状态都在 `state` 中
- `_ml` 是 `state` 的子域，不是独立系统
- 不存在"隔离"，只是写入约束

### 2. 单写入口约束

```typescript
// 🔒 唯一可以修改 state._ml 的方法
private learnML(
  studentId: string,
  questionId: string,
  ctx: Context,
  correct: boolean
): void {
  // 只有这里可以修改 state._ml
}
```

### 3. 可观测性

```typescript
// predict() 只读 state._ml，不修改
predict(studentId, questionId, ctx): number {
  // 只读操作
}

// encodeAnswer() 返回学习前的预测
encodeAnswer(studentId, questionId, correct): number {
  const p = this.predict(...);  // 记录学习前状态
  // ... 更新状态
  return p;  // 返回预测
}
```

---

## 文件结构

```
lib/qie/
├── types.ts              # 共享类型（含 UOKState, MLState）
├── uok.ts                # Unified Kernel（唯一核心，~300 行）
└── index.ts              # 公共 API

tests/qie/
├── types.test.ts         # 类型测试（已完成）
├── uok.test.ts           # UOK 测试
└── integration.test.ts   # 集成测试

app/api/qie/
├── encode/question/route.ts  # POST /api/qie/encode/question
├── encode/answer/route.ts    # POST /api/qie/encode/answer
├── explain/route.ts          # GET  /api/qie/explain
└── act/route.ts              # POST /api/qie/act
```

**删除：**
- ~~`lib/qie/model.ts`~~ - ML 引擎内嵌到 UOK
- ~~`app/api/qie/predict`~~ - predict() 变成内部方法
- ~~`app/api/qie/update`~~ - update 合并到 encode/answer

---

## 类型定义（types.ts）

```typescript
/**
 * Context for prediction
 */
export interface Context {
  difficulty: number;
  complexity: number;
}

/**
 * Question features from Layer 1
 */
export interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
  difficulty: number;
}

/**
 * ML 内部状态（计算域）
 */
export interface MLState {
  embeddings: {
    students: Map<string, Float32Array>;
    questions: Map<string, Float32Array>;
  };
  weights: {
    w1: Float32Array;
    b1: Float32Array;
    w2: Float32Array;
    b2: number;
  };
  updateCounter: number;
}

/**
 * 题目状态
 */
export interface QuestionState {
  id: string;
  topics: string[];
  features: QuestionFeatures;
  quality: number;
  attemptCount: number;
  correctCount: number;
}

/**
 * 学生状态
 */
export interface StudentState {
  id: string;
  knowledge: Map<string, number>;
  attemptCount: number;
  correctCount: number;
}

/**
 * 知识空间状态
 */
export class SpaceState {
  topics = new Set<string>();
  topicCounts = new Map<string, number>();

  update(topics: string[], _features: QuestionFeatures): void {
    for (const t of topics) {
      this.topics.add(t);
      this.topicCounts.set(t, (this.topicCounts.get(t) ?? 0) + 1);
    }
  }

  getCount(topic: string): number {
    return this.topicCounts.get(topic) ?? 0;
  }
}

/**
 * 轨迹条目
 */
export type TraceEntry =
  | { type: 'encode'; questionId: string; time: number }
  | { type: 'answer'; studentId: string; questionId: string; correct: boolean; time: number };

/**
 * 解释输出
 */
export type Explanation =
  | { type: 'student'; studentId: string; ability: number; weakTopics: { topic: string; mastery: number }[]; totalAttempts: number }
  | { type: 'question'; questionId: string; topics: string[]; quality: number; attempts: number; features: QuestionFeatures }
  | { type: 'system'; totalQuestions: number; totalStudents: number; totalAttempts: number; topics: string[]; traceLength: number }
  | { type: 'error'; message: string };

/**
 * 决策输出
 */
export type Action =
  | { type: 'recommend'; topic: string; reason: string }
  | { type: 'gap_report'; gaps: Gap[] }
  | { type: 'done'; reason: string }
  | { type: 'error'; reason: string };

/**
 * 缺口报告
 */
export interface Gap {
  topic: string;
  mastery: number;
  type: 'weak_knowledge' | 'missing_questions';
  count?: number;
}

/**
 * UOK 完整状态（唯一存储层）
 *
 * state = storage truth（唯一事实源）
 * _ml = internal computation domain（内部计算域）
 */
export interface UOKState {
  questions: Map<string, QuestionState>;
  students: Map<string, StudentState>;
  space: SpaceState;
  trace: TraceEntry[];
  _ml: MLState;
}
```

---

## UOK 核心（uok.ts）

```typescript
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
 *
 * 核心原则：
 * 1. state 是唯一存储层（包含 ML 状态）
 * 2. _ml 是内部计算域（带写入约束）
 * 3. learnML() 是 ML 状态的唯一写入点
 * 4. 所有行为可观测、可追溯
 */
export class UOK {
  // ============================================================
  // Single Source of Truth
  // ============================================================
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

  // ML 配置
  private readonly dim = 32;
  private readonly hidden = 32;
  private readonly lr = 0.01;

  constructor() {
    this.initializeML();
  }

  // ============================================================
  // 公共 API
  // ============================================================

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
   * 解释状态
   */
  explain(target?: {
    studentId?: string;
    questionId?: string;
  }): Explanation {
    if (target?.studentId) {
      return this.explainStudent(target.studentId);
    }
    if (target?.questionId) {
      return this.explainQuestion(target.questionId);
    }
    return this.explainSystem();
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

  // ============================================================
  // ML 子系统（私有，单写入口）
  // ============================================================

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
    const ds = this.mul(_ml.weights.w1.subarray(0, this.dim), dh);
    const dq = this.mul(_ml.weights.w1.subarray(this.dim, this.dim * 2), dh);

    // Update weights
    for (let i = 0; i < _ml.weights.w2.length; i++) {
      _ml.weights.w2[i] -= this.lr * dz * h[i];
    }
    _ml.weights.b2 -= this.lr * dz;

    for (let i = 0; i < _ml.weights.w1.length; i++) {
      _ml.weights.w1[i] -= this.lr * x[Math.floor(i / this.hidden)] * dh[i % this.hidden];
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
   * ML 状态标准化
   */
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

  // ============================================================
  // 内部方法
  // ============================================================

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

  private mul(w: Float32Array, s: number): Float32Array {
    const out = new Float32Array(w.length);
    for (let i = 0; i < w.length; i++) out[i] = w[i] * s;
    return out;
  }

  private relu(x: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = Math.max(0, x[i]);
    return out;
  }

  private reluGrad(x: Float32Array, dy: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? dy[i] : 0;
    return out;
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
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

  private explainSystem(): Explanation {
    const totalQuestions = this.state.questions.size;
    const totalStudents = this.state.students.size;
    const totalAttempts = Array.from(this.state.students.values())
      .reduce((sum, s) => sum + s.attemptCount, 0);

    return {
      type: 'system',
      totalQuestions,
      totalStudents,
      totalAttempts,
      topics: Array.from(this.state.space.topics),
      traceLength: this.state.trace.length,
    };
  }
}

function gaussian(): number {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

---

## API 设计

```
# 题目入库
POST /api/qie/encode/question
{ id, content, topics }
→ { ok: true }

# 记录答案（触发 ML 学习）
POST /api/qie/encode/answer
{ studentId, questionId, correct }
→ { ok: true, probability: number }  # 返回学习前的预测

# 查询状态
GET /api/qie/explain?studentId=xxx
→ { type: 'student', ... }

# 决策
POST /api/qie/act
{ intent: 'next_question', studentId }
→ { type: 'recommend', topic, reason }
```

---

## 验收标准

### 核心验证
- [ ] state 是唯一存储层（包含 _ml 子域）
- [ ] learnML() 是 ML 状态的唯一写入点
- [ ] predict() 只读 ML 状态
- [ ] encodeAnswer() 返回学习前的预测概率

### 质量验证
- [ ] 单元测试覆盖率 > 80%
- [ ] 预测延迟 < 5ms
- [ ] 无 TypeScript 错误

---

**文档版本**: v2.0
**状态**: 待实施
**核心变化**: 统一架构，ML 内嵌到 UOK
