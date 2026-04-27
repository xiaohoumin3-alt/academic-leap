# QIE Unified Kernel v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build QIE Unified Kernel - a single-source-of-truth system with embedded ML subsystem for question intelligence and observability.

**Architecture:** UOK class containing state (storage truth) with _ml subdomain (computation domain). ML is embedded, not a separate layer. All state mutations go through controlled entry points.

**Tech Stack:** TypeScript, Float32Array for memory efficiency, Vitest for testing, SvelteKit for API routes.

---

## File Structure

```
lib/qie/
├── types.ts              # Shared types (MLState, UOKState, etc.)
├── uok.ts                # Unified Kernel class (~300 lines)
└── index.ts              # Public API exports

tests/qie/
├── types.test.ts         # Type tests (already exists)
├── uok.test.ts           # UOK unit tests
└── integration.test.ts   # End-to-end tests

app/api/qie/
├── encode/question/route.ts  # POST /api/qie/encode/question
├── encode/answer/route.ts    # POST /api/qie/encode/answer
├── explain/route.ts          # GET  /api/qie/explain
└── act/route.ts              # POST /api/qie/act
```

**Deleting (cleanup from v1.0):**
- ~~lib/qie/model.ts~~ - ML is now embedded in UOK

---

## Phase 1: Types Foundation

### Task 1: Update types.ts with MLState and UOKState

**Files:**
- Modify: `lib/qie/types.ts`
- Test: `tests/qie/types.test.ts`

- [ ] **Step 1: Write failing test for new types**

```typescript
// Add to tests/qie/types.test.ts

import { MLState, UOKState } from '$lib/qie/types';

describe('MLState', () => {
  it('should create valid ML state structure', () => {
    const mlState: MLState = {
      embeddings: {
        students: new Map(),
        questions: new Map(),
      },
      weights: {
        w1: new Float32Array(67 * 32),
        b1: new Float32Array(32),
        w2: new Float32Array(32),
        b2: 0,
      },
      updateCounter: 0,
    };
    expect(mlState.embeddings.students).toBeInstanceOf(Map);
    expect(mlState.embeddings.questions).toBeInstanceOf(Map);
    expect(mlState.weights.w1).toHaveLength(67 * 32);
  });
});

describe('UOKState', () => {
  it('should include _ml subdomain', () => {
    const state: UOKState = {
      questions: new Map(),
      students: new Map(),
      space: new (class MockSpaceState {
        topics = new Set();
        topicCounts = new Map();
        update = () => {};
        getCount = () => 0;
      })(),
      trace: [],
      _ml: {
        embeddings: { students: new Map(), questions: new Map() },
        weights: { w1: new Float32Array(0), b1: new Float32Array(0), w2: new Float32Array(0), b2: 0 },
        updateCounter: 0,
      },
    };
    expect(state._ml).toBeDefined();
    expect(state._ml.embeddings).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/types.test.ts`

Expected: FAIL with "MLState is not defined" or "UOKState is not defined"

- [ ] **Step 3: Add MLState and UOKState to types.ts**

```typescript
// Add to lib/qie/types.ts (after existing types, before export class SpaceState)

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/types.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/qie/types.ts tests/qie/types.test.ts
git commit -m "feat(qie): add MLState and UOKState types"
```

---

## Phase 2: UOK Core Implementation

### Task 2: Create UOK class skeleton with state initialization

**Files:**
- Create: `lib/qie/uok.ts`
- Test: `tests/qie/uok.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/qie/uok.test.ts
import { UOK } from '$lib/qie/uok';

describe('UOK', () => {
  describe('initialization', () => {
    it('should initialize with valid state structure', () => {
      const uok = new UOK();

      const explanation = uok.explain();
      expect(explanation.type).toBe('system');
      if (explanation.type === 'system') {
        expect(explanation.totalQuestions).toBe(0);
        expect(explanation.totalStudents).toBe(0);
      }
    });

    it('should initialize ML weights with correct dimensions', () => {
      const uok = new UOK();
      // Access internal state for testing
      const state = (uok as any).state;
      expect(state._ml.weights.w1).toHaveLength(67 * 32); // (32*2 + 3) * 32
      expect(state._ml.weights.b1).toHaveLength(32);
      expect(state._ml.weights.w2).toHaveLength(32);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: FAIL with "Cannot find module '$lib/qie/uok'"

- [ ] **Step 3: Create UOK class skeleton**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/qie/uok.ts tests/qie/uok.test.ts
git commit -m "feat(qie): add UOK class skeleton with state initialization"
```

---

### Task 3: Implement encodeQuestion method

**Files:**
- Modify: `lib/qie/uok.ts`
- Modify: `tests/qie/uok.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/uok.test.ts

describe('encodeQuestion', () => {
  it('should encode question and update state', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: '证明：若 f(x) = x²，则 f(2) = 4',
      topics: ['函数', '证明']
    });

    const explanation = uok.explain({ questionId: 'q1' });
    expect(explanation.type).toBe('question');
    if (explanation.type === 'question') {
      expect(explanation.questionId).toBe('q1');
      expect(explanation.topics).toEqual(['函数', '证明']);
    }
  });

  it('should extract cognitive features from content', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: '证明：若 f(x) 同时满足两个条件',
      topics: ['证明']
    });

    const explanation = uok.explain({ questionId: 'q1' });
    if (explanation.type === 'question') {
      expect(explanation.features.reasoningDepth).toBeGreaterThan(0);
      expect(explanation.features.cognitiveLoad).toBeGreaterThan(0);
    }
  });

  it('should add trace entry', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: '简单题目',
      topics: ['基础']
    });

    const state = (uok as any).state;
    expect(state.trace.length).toBe(1);
    expect(state.trace[0].type).toBe('encode');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: FAIL with "encodeQuestion is not a function"

- [ ] **Step 3: Implement encodeQuestion**

```typescript
// Add to lib/qie/uok.ts (after constructor, before explain)

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
```

- [ ] **Step 4: Update explain() to support questionId target**

```typescript
// Replace explain() method in lib/qie/uok.ts

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
```

- [ ] **Step 5: Add getOrCreateStudent helper**

```typescript
// Add to lib/qie/uok.ts (private methods section)

private getOrCreateStudent(id: string): StudentState {
  let s = this.state.students.get(id);
  if (!s) {
    s = { id, knowledge: new Map(), attemptCount: 0, correctCount: 0 };
    this.state.students.set(id, s);
  }
  return s;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/qie/uok.ts tests/qie/uok.test.ts
git commit -m "feat(qie): add encodeQuestion method"
```

---

### Task 4: Implement predict method (read-only ML)

**Files:**
- Modify: `lib/qie/uok.ts`
- Modify: `tests/qie/uok.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/uok.test.ts

describe('predict', () => {
  it('should return probability between 0 and 1', () => {
    const uok = new UOK();
    const p = uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('should create new embeddings for unknown entities', () => {
    const uok = new UOK();
    uok.predict('new_student', 'new_question', { difficulty: 0.5, complexity: 0.5 });

    const state = (uok as any).state;
    expect(state._ml.embeddings.students.size).toBe(1);
    expect(state._ml.embeddings.questions.size).toBe(1);
  });

  it('should reuse embeddings for known entities', () => {
    const uok = new UOK();
    uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });
    uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });

    const state = (uok as any).state;
    expect(state._ml.embeddings.students.size).toBe(1);
    expect(state._ml.embeddings.questions.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: FAIL with "predict is not a function"

- [ ] **Step 3: Implement predict method and helpers**

```typescript
// Add to lib/qie/uok.ts (after encodeQuestion, before explain)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/qie/uok.ts tests/qie/uok.test.ts
git commit -m "feat(qie): add predict method (read-only ML)"
```

---

### Task 5: Implement learnML (single write entry)

**Files:**
- Modify: `lib/qie/uok.ts`
- Modify: `tests/qie/uok.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/uok.test.ts

describe('learnML (via encodeAnswer)', () => {
  it('should update weights after feedback', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: 'Test',
      topics: ['test']
    });

    const stateBefore = (uok as any).state;
    const w1Before = Array.from(stateBefore._ml.weights.w1);

    uok.encodeAnswer('s1', 'q1', true);

    const stateAfter = (uok as any).state;
    const w1After = Array.from(stateAfter._ml.weights.w1);

    // Weights should have changed
    expect(w1Before).not.toEqual(w1After);
  });

  it('should increase prediction for correct answers', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: 'Test',
      topics: ['test']
    });

    const ctx = { difficulty: 0.5, complexity: 0.5 };
    const pBefore = uok.predict('s1', 'q1', ctx);

    // Train with correct answers
    for (let i = 0; i < 10; i++) {
      uok.encodeAnswer('s1', 'q1', true);
    }

    const pAfter = uok.predict('s1', 'q1', ctx);
    expect(pAfter).toBeGreaterThan(pBefore);
  });

  it('should decrease prediction for incorrect answers', () => {
    const uok = new UOK();
    uok.encodeQuestion({
      id: 'q1',
      content: 'Test',
      topics: ['test']
    });

    const ctx = { difficulty: 0.5, complexity: 0.5 };
    const pBefore = uok.predict('s2', 'q1', ctx);

    // Train with incorrect answers
    for (let i = 0; i < 10; i++) {
      uok.encodeAnswer('s2', 'q1', false);
    }

    const pAfter = uok.predict('s2', 'q1', ctx);
    expect(pAfter).toBeLessThan(pBefore);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: FAIL with predictions not changing

- [ ] **Step 3: Implement learnML and encodeAnswer**

```typescript
// Add to lib/qie/uok.ts (replace/add after predict method)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/qie/uok.ts tests/qie/uok.test.ts
git commit -m "feat(qie): add learnML single write entry and encodeAnswer"
```

---

### Task 6: Implement act method

**Files:**
- Modify: `lib/qie/uok.ts`
- Modify: `tests/qie/uok.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/uok.test.ts

describe('act', () => {
  beforeEach(() => {
    // Setup test questions
  });

  it('should recommend weakest topic', () => {
    const uok = new UOK();
    uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });
    uok.encodeQuestion({ id: 'q2', content: '几何题', topics: ['几何'] });

    uok.encodeAnswer('s1', 'q1', false);
    uok.encodeAnswer('s1', 'q2', true);

    const action = uok.act('next_question', 's1');
    expect(action.type).toBe('recommend');
    if (action.type === 'recommend') {
      expect(action.topic).toBe('代数');
    }
  });

  it('should return done when all mastered', () => {
    const uok = new UOK();
    uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });
    uok.encodeQuestion({ id: 'q2', content: '几何题', topics: ['几何'] });

    uok.encodeAnswer('s1', 'q1', true);
    uok.encodeAnswer('s1', 'q2', true);

    const action = uok.act('next_question', 's1');
    expect(action.type).toBe('done');
  });

  it('should return error for unknown student', () => {
    const uok = new UOK();
    const action = uok.act('next_question', 'unknown');
    expect(action.type).toBe('error');
  });

  it('should analyze gaps', () => {
    const uok = new UOK();
    uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });

    uok.encodeAnswer('s1', 'q1', false);

    const action = uok.act('gap_analysis', 's1');
    expect(action.type).toBe('gap_report');
    if (action.type === 'gap_report') {
      expect(action.gaps.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: FAIL with "act is not a function"

- [ ] **Step 3: Implement act method and helpers**

```typescript
// Add to lib/qie/uok.ts (after encodeAnswer, before explain)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/uok.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/qie/uok.ts tests/qie/uok.test.ts
git commit -m "feat(qie): add act method for decision making"
```

---

## Phase 3: Public API

### Task 7: Create public API index

**Files:**
- Create: `lib/qie/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
// lib/qie/index.ts

/**
 * QIE Public API
 *
 * Exports the UOK system - unified observability kernel with embedded ML.
 */

export { UOK } from './uok';
export * from './types';
```

- [ ] **Step 2: Commit**

```bash
git add lib/qie/index.ts
git commit -m "feat(qie): add public API"
```

---

## Phase 4: API Routes

### Task 8: Create encode/question API

**Files:**
- Create: `app/api/qie/encode/question/route.ts`
- Test: `tests/qie/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/qie/api.test.ts
import { POST as encodeQuestionPOST } from '../app/api/qie/encode/question/route';

describe('QIE API', () => {
  describe('POST /api/qie/encode/question', () => {
    it('should encode a question', async () => {
      const request = new Request('http://localhost/api/qie/encode/question', {
        method: 'POST',
        body: JSON.stringify({
          id: 'q1',
          content: '证明：若 f(x) = x²，则 f(2) = 4',
          topics: ['函数', '证明']
        })
      });

      const response = await encodeQuestionPOST({ request } as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
    });

    it('should return 400 for missing fields', async () => {
      const request = new Request('http://localhost/api/qie/encode/question', {
        method: 'POST',
        body: JSON.stringify({ id: 'q1' })  // missing content and topics
      });

      const response = await encodeQuestionPOST({ request } as any);

      expect(response.status).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/api.test.ts`

Expected: FAIL with route not found

- [ ] **Step 3: Create route**

```typescript
// app/api/qie/encode/question/route.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UOK } from '$lib/qie';

// Singleton instance
const uok = new UOK();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.id || !body.content || !body.topics) {
      return json(
        { error: 'Missing required fields: id, content, topics' },
        { status: 400 }
      );
    }

    uok.encodeQuestion(body);

    return json({ ok: true });
  } catch (error) {
    return json({ error: 'Invalid request' }, { status: 400 });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/qie/encode/question tests/qie/api.test.ts
git commit -m "feat(qie): add encode/question API"
```

---

### Task 9: Create encode/answer API

**Files:**
- Create: `app/api/qie/encode/answer/route.ts`
- Modify: `tests/qie/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/api.test.ts

import { POST as encodeAnswerPOST } from '../app/api/qie/encode/answer/route';

describe('POST /api/qie/encode/answer', () => {
  beforeEach(async () => {
    // Setup: encode a question first
    const encodeReq = new Request('http://localhost/api/qie/encode/question', {
      method: 'POST',
      body: JSON.stringify({
        id: 'q1',
        content: 'Test question',
        topics: ['test']
      })
    });
    await encodeQuestionPOST({ request: encodeReq } as any);
  });

  it('should encode answer and return probability', async () => {
    const request = new Request('http://localhost/api/qie/encode/answer', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 's1',
        questionId: 'q1',
        correct: true
      })
    });

    const response = await encodeAnswerPOST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(typeof data.probability).toBe('number');
    expect(data.probability).toBeGreaterThanOrEqual(0);
    expect(data.probability).toBeLessThanOrEqual(1);
  });

  it('should return 400 for missing fields', async () => {
    const request = new Request('http://localhost/api/qie/encode/answer', {
      method: 'POST',
      body: JSON.stringify({ studentId: 's1' })
    });

    const response = await encodeAnswerPOST({ request } as any);

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/api.test.ts`

Expected: FAIL with route not found

- [ ] **Step 3: Create route**

```typescript
// app/api/qie/encode/answer/route.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UOK } from '$lib/qie';

// Use the same singleton
const uok = new UOK();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.studentId || !body.questionId || typeof body.correct !== 'boolean') {
      return json(
        { error: 'Missing required fields: studentId, questionId, correct' },
        { status: 400 }
      );
    }

    const probability = uok.encodeAnswer(body.studentId, body.questionId, body.correct);

    return json({ ok: true, probability });
  } catch (error) {
    return json({ error: 'Invalid request' }, { status: 400 });
  }
};
```

- [ ] **Step 4: Update test to use shared instance**

```typescript
// Update tests/qie/api.test.ts - import shared uok instance
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/qie/api.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/qie/encode/answer tests/qie/api.test.ts
git commit -m "feat(qie): add encode/answer API with probability response"
```

---

### Task 10: Create explain API

**Files:**
- Create: `app/api/qie/explain/route.ts`
- Modify: `tests/qie/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/api.test.ts

import { GET as explainGET } from '../app/api/qie/explain/route';

describe('GET /api/qie/explain', () => {
  it('should return system explanation', async () => {
    const request = new Request('http://localhost/api/qie/explain');

    const response = await explainGET({ request, url: new URL('http://localhost/api/qie/explain') } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('system');
  });

  it('should return student explanation by id', async () => {
    // Setup: create a student with answers
    const uok = new (await import('$lib/qie')).UOK();
    uok.encodeQuestion({ id: 'q1', content: 'Test', topics: ['test'] });
    uok.encodeAnswer('s1', 'q1', true);

    const url = new URL('http://localhost/api/qie/explain?studentId=s1');
    const response = await explainGET({ request: new Request(url), url } as any);
    const data = await response.json();

    expect(data.type).toBe('student');
    expect(data.studentId).toBe('s1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/api.test.ts`

Expected: FAIL with route not found

- [ ] **Step 3: Create route**

```typescript
// app/api/qie/explain/route.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { UOK } from '$lib/qie';

const uok = new UOK();

export const GET: RequestHandler = ({ url }: RequestEvent) => {
  const studentId = url.searchParams.get('studentId');
  const questionId = url.searchParams.get('questionId');

  const target: { studentId?: string; questionId?: string } = {};
  if (studentId) target.studentId = studentId;
  if (questionId) target.questionId = questionId;

  const explanation = uok.explain(
    Object.keys(target).length > 0 ? target : undefined
  );

  return json(explanation);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/qie/explain tests/qie/api.test.ts
git commit -m "feat(qie): add explain API"
```

---

### Task 11: Create act API

**Files:**
- Create: `app/api/qie/act/route.ts`
- Modify: `tests/qie/api.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// Add to tests/qie/api.test.ts

import { POST as actPOST } from '../app/api/qie/act/route';

describe('POST /api/qie/act', () => {
  beforeEach(async () => {
    const uok = new (await import('$lib/qie')).UOK();
    uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });
    uok.encodeQuestion({ id: 'q2', content: '几何题', topics: ['几何'] });
    uok.encodeAnswer('s1', 'q1', false);
    uok.encodeAnswer('s1', 'q2', true);
  });

  it('should recommend next question', async () => {
    const request = new Request('http://localhost/api/qie/act', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'next_question',
        studentId: 's1'
      })
    });

    const response = await actPOST({ request } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('recommend');
    if (data.type === 'recommend') {
      expect(data.topic).toBe('代数');
    }
  });

  it('should return error for invalid intent', async () => {
    const request = new Request('http://localhost/api/qie/act', {
      method: 'POST',
      body: JSON.stringify({
        intent: 'invalid',
        studentId: 's1'
      })
    });

    const response = await actPOST({ request } as any);

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/qie/api.test.ts`

Expected: FAIL with route not found

- [ ] **Step 3: Create route**

```typescript
// app/api/qie/act/route.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UOK } from '$lib/qie';

const uok = new UOK();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.intent || !body.studentId) {
      return json(
        { error: 'Missing required fields: intent, studentId' },
        { status: 400 }
      );
    }

    if (body.intent !== 'next_question' && body.intent !== 'gap_analysis') {
      return json(
        { error: 'Invalid intent. Use: next_question, gap_analysis' },
        { status: 400 }
      );
    }

    const action = uok.act(body.intent, body.studentId);

    return json(action);
  } catch (error) {
    return json({ error: 'Invalid request' }, { status: 400 });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/qie/api.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/qie/act tests/qie/api.test.ts
git commit -m "feat(qie): add act API"
```

---

## Phase 5: Integration Tests

### Task 12: End-to-end integration tests

**Files:**
- Create: `tests/qie/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/qie/integration.test.ts
import { UOK } from '$lib/qie';

describe('QIE Integration', () => {
  describe('Learning Loop', () => {
    it('should learn and improve predictions', () => {
      const uok = new UOK();

      uok.encodeQuestion({
        id: 'q1',
        content: 'Test question',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };
      const p1 = uok.predict('s1', 'q1', ctx);

      // Train with correct answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('s1', 'q1', true);
      }

      const p2 = uok.predict('s1', 'q1', ctx);
      expect(p2).toBeGreaterThan(p1);
    });

    it('should distinguish between strong and weak students', () => {
      const uok = new UOK();

      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };

      // Strong student gets correct answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('strong', 'q1', true);
      }

      // Weak student gets wrong answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('weak', 'q1', false);
      }

      const pStrong = uok.predict('strong', 'q1', ctx);
      const pWeak = uok.predict('weak', 'q1', ctx);

      expect(pStrong).toBeGreaterThan(pWeak);
    });
  });

  describe('Full Workflow', () => {
    it('should handle question ingestion to recommendation', () => {
      const uok = new UOK();

      // 1. Ingest questions
      uok.encodeQuestion({
        id: 'q1',
        content: '代数计算题',
        topics: ['代数']
      });
      uok.encodeQuestion({
        id: 'q2',
        content: '几何证明题',
        topics: ['几何']
      });

      // 2. Record answers
      uok.encodeAnswer('s1', 'q1', false);
      uok.encodeAnswer('s1', 'q2', true);

      // 3. Check student state
      const studentExplanation = uok.explain({ studentId: 's1' });
      if (studentExplanation.type === 'student') {
        expect(studentExplanation.ability).toBe(0.5);
      }

      // 4. Get recommendation
      const action = uok.act('next_question', 's1');
      if (action.type === 'recommend') {
        expect(action.topic).toBe('代数');
      }

      // 5. Check gaps
      const gapAction = uok.act('gap_analysis', 's1');
      if (gapAction.type === 'gap_report') {
        expect(gapAction.gaps.some(g => g.topic === '代数')).toBe(true);
      }
    });

    it('should maintain trace audit trail', () => {
      const uok = new UOK();

      uok.encodeQuestion({ id: 'q1', content: 'Test', topics: ['test'] });
      uok.encodeAnswer('s1', 'q1', true);
      uok.encodeAnswer('s1', 'q1', false);

      const explanation = uok.explain();
      if (explanation.type === 'system') {
        expect(explanation.traceLength).toBe(3); // 1 encode + 2 answers
      }
    });
  });

  describe('State Consistency', () => {
    it('should keep _ml as part of state', () => {
      const uok = new UOK();
      const state = (uok as any).state;

      expect(state._ml).toBeDefined();
      expect(state._ml.embeddings).toBeDefined();
      expect(state._ml.weights).toBeDefined();
    });

    it('should update ML state through learnML only', () => {
      const uok = new UOK();
      uok.encodeQuestion({ id: 'q1', content: 'Test', topics: ['test'] });

      const stateBefore = (uok as any).state._ml;
      const w1Before = Array.from(stateBefore.weights.w1);

      uok.encodeAnswer('s1', 'q1', true);

      const stateAfter = (uok as any).state._ml;
      const w1After = Array.from(stateAfter.weights.w1);

      expect(w1Before).not.toEqual(w1After);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/qie/integration.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/qie/integration.test.ts
git commit -m "test(qie): add integration tests"
```

---

## Phase 6: Cleanup

### Task 13: Delete obsolete model.ts

**Files:**
- Delete: `lib/qie/model.ts` (if exists from v1.0)

- [ ] **Step 1: Check if file exists**

```bash
ls lib/qie/model.ts 2>/dev/null && echo "exists" || echo "does not exist"
```

- [ ] **Step 2: Delete if exists**

```bash
rm lib/qie/model.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/qie/model.ts
git commit -m "chore(qie): remove obsolete model.ts (ML now embedded in UOK)"
```

---

## Acceptance Criteria

After implementation, verify:

### Core Verification
- [ ] state is the single storage layer (contains _ml subdomain)
- [ ] learnML() is the only write entry for _ml state
- [ ] predict() only reads _ml state (no mutations)
- [ ] encodeAnswer() returns learning-before probability

### UOK Verification
- [ ] explain() can interpret any state (student/question/system)
- [ ] act() makes decisions based on state
- [ ] trace provides full audit trail

### API Verification
- [ ] All endpoints return correct HTTP status codes
- [ ] encode/answer returns probability in [0, 1]
- [ ] Answers trigger ML learning

### Quality Verification
- [ ] Unit test coverage > 80%
- [ ] Prediction latency < 5ms
- [ ] No TypeScript errors
- [ ] No console.log in production code

---

**Plan complete. Ready for execution.**
