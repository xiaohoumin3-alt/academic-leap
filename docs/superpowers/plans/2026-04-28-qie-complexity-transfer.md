# QIE Complexity Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complexity transfer mechanism to enable predictions from simple questions to complex scenarios through feature space mapping.

**Architecture:** Extend v2.0 UOK with (1) complexity transfer prediction method, (2) weight vector in MLState, (3) gated online calibration in encodeAnswer, (4) monitoring API.

**Tech Stack:** TypeScript, Float32Array for ML operations, existing v2.0 UOK architecture

---

## Task 1: Add Complexity Transfer Types

**Files:**
- Modify: `lib/qie/types.ts`

- [ ] **Step 1: Add ComplexityTransferWeights interface**

```typescript
// Add after MLState interface (around line 54)

/**
 * Complexity transfer weights for feature space mapping
 * w = (w_cognitive, w_reasoning, w_complexity)
 */
export interface ComplexityTransferWeights {
  cognitiveLoad: number;    // w₁: cognitive load penalty weight
  reasoningDepth: number;   // w₂: reasoning depth penalty weight
  complexity: number;       // w₃: structural complexity penalty weight
}
```

- [ ] **Step 2: Add ComplexityDelta interface**

```typescript
// Add after ComplexityTransferWeights interface

/**
 * Complexity difference vector between two questions
 * ΔC = (ΔcognitiveLoad, ΔreasoningDepth, Δcomplexity)
 */
export interface ComplexityDelta {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}
```

- [ ] **Step 3: Add ComplexityTransferConfig interface**

```typescript
// Add after ComplexityDelta interface

/**
 * Configuration for complexity transfer mechanism
 */
export interface ComplexityTransferConfig {
  weights: ComplexityTransferWeights;     // Current weight vector
  gateThreshold: number;                  // τ: minimum P_simple for calibration
  learningRate: number;                   // η: weight update step size
}
```

- [ ] **Step 4: Extend MLState to include transfer weights**

```typescript
// Modify MLState interface (around line 42-53)

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
  transfer: ComplexityTransferConfig;     // NEW: complexity transfer state
}
```

- [ ] **Step 5: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add lib/qie/types.ts
git commit -m "feat: add complexity transfer types"
```

---

## Task 2: Initialize Transfer Weights in UOK Constructor

**Files:**
- Modify: `lib/qie/uok.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/qie/integration.test.ts in describe('Complexity Transfer')

describe('Complexity Transfer', () => {
  it('should initialize with uniform weights', () => {
    const uok = new UOK();
    const weights = uok.getComplexityTransferWeights();

    expect(weights.cognitiveLoad).toBeCloseTo(1/3, 5);
    expect(weights.reasoningDepth).toBeCloseTo(1/3, 5);
    expect(weights.complexity).toBeCloseTo(1/3, 5);
  });

  it('should sum to 1', () => {
    const uok = new UOK();
    const weights = uok.getComplexityTransferWeights();
    const sum = weights.cognitiveLoad + weights.reasoningDepth + weights.complexity;

    expect(sum).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: FAIL with "getComplexityTransferWeights is not a function"

- [ ] **Step 3: Initialize transfer config in constructor**

```typescript
// Modify UOK constructor (around line 23-41)

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
```

- [ ] **Step 4: Add getComplexityTransferWeights method**

```typescript
// Add after get method (around line 107)

/**
 * Get current complexity transfer weights (for debugging/monitoring)
 */
getComplexityTransferWeights(): ComplexityTransferWeights {
  return { ...this.state._ml.transfer.weights };
}
```

- [ ] **Step 5: Add import for ComplexityTransferWeights**

```typescript
// Add to imports (around line 3-14)

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
  ComplexityTransferWeights,    // NEW
} from './types';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/qie/uok.ts tests/qie/integration.test.ts
git commit -m "feat: initialize and expose complexity transfer weights"
```

---

## Task 3: Implement predictWithComplexityTransfer Method

**Files:**
- Modify: `lib/qie/uok.ts`
- Test: `tests/qie/integration.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/qie/integration.test.ts in describe('Complexity Transfer')

it('should predict lower probability for more complex questions', () => {
  const uok = new UOK();

  // Encode simple question
  uok.encodeQuestion({
    id: 'simple',
    content: '计算',
    topics: ['math']
  });

  // Encode complex question
  uok.encodeQuestion({
    id: 'complex',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // Train student on simple question
  for (let i = 0; i < 5; i++) {
    uok.encodeAnswer('student1', 'simple', true);
  }

  // Get base prediction for simple question
  const ctxSimple = { difficulty: 0.5, complexity: 0.2 };
  const pSimple = uok.predict('student1', 'simple', ctxSimple);

  // Predict for complex question via transfer
  const pComplex = uok.predictWithComplexityTransfer('student1', 'simple', 'complex');

  expect(pComplex).toBeLessThan(pSimple);
  expect(pComplex).toBeGreaterThan(0);
});

it('should return same probability when questions have equal complexity', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'q1',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'q2',
    content: '计算',
    topics: ['math']
  });

  const p1 = uok.predictWithComplexityTransfer('s1', 'q1', 'q2');
  const p2 = uok.predict('s1', 'q1', { difficulty: 0.5, complexity: 0 });

  expect(p1).toBeCloseTo(p2, 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: FAIL with "predictWithComplexityTransfer is not a function"

- [ ] **Step 3: Implement predictWithComplexityTransfer method**

```typescript
// Add after predict method (around line 107)

/**
 * Predict with complexity transfer from simple to complex question
 *
 * P_complex = P_simple · exp(- w · ΔC)
 *
 * @param studentId - Student identifier
 * @param simpleQuestionId - Reference question with known complexity
 * @param complexQuestionId - Target question with higher complexity
 * @returns Predicted probability for complex question
 */
predictWithComplexityTransfer(
  studentId: string,
  simpleQuestionId: string,
  complexQuestionId: string
): number {
  const simpleQ = this.state.questions.get(simpleQuestionId);
  const complexQ = this.state.questions.get(complexQuestionId);

  if (!simpleQ || !complexQ) {
    return 0.5;
  }

  // Get base prediction for simple question
  const ctxSimple: Context = {
    difficulty: simpleQ.features.difficulty,
    complexity: simpleQ.features.complexity,
  };
  const pSimple = this.predict(studentId, simpleQuestionId, ctxSimple);

  // Calculate complexity delta
  const deltaC: ComplexityDelta = {
    cognitiveLoad: complexQ.features.cognitiveLoad - simpleQ.features.cognitiveLoad,
    reasoningDepth: complexQ.features.reasoningDepth - simpleQ.features.reasoningDepth,
    complexity: complexQ.features.complexity - simpleQ.features.complexity,
  };

  // Apply transfer function
  const w = this.state._ml.transfer.weights;
  const weightedProjection =
    w.cognitiveLoad * Math.max(0, deltaC.cognitiveLoad) +
    w.reasoningDepth * Math.max(0, deltaC.reasoningDepth) +
    w.complexity * Math.max(0, deltaC.complexity);

  return pSimple * Math.exp(-weightedProjection);
}
```

- [ ] **Step 4: Add ComplexityDelta import**

```typescript
// Add to imports

import {
  // ... existing imports
  ComplexityDelta,    // NEW
} from './types';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/qie/uok.ts tests/qie/integration.test.ts
git commit -m "feat: implement predictWithComplexityTransfer method"
```

---

## Task 4: Implement Gated Online Calibration in encodeAnswer

**Files:**
- Modify: `lib/qie/uok.ts`
- Test: `tests/qie/integration.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/qie/integration.test.ts in describe('Complexity Transfer')

it('should update weights when P_simple >= gate threshold', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'simple',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'complex',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // Train to get high P_simple
  for (let i = 0; i < 10; i++) {
    uok.encodeAnswer('student1', 'simple', true);
  }

  const weightsBefore = uok.getComplexityTransferWeights();

  // Now answer complex question correctly
  uok.encodeAnswer('student1', 'complex', true);

  const weightsAfter = uok.getComplexityTransferWeights();

  // Weights should have changed (not necessarily same value, but different)
  const changed =
    weightsAfter.cognitiveLoad !== weightsBefore.cognitiveLoad ||
    weightsAfter.reasoningDepth !== weightsBefore.reasoningDepth ||
    weightsAfter.complexity !== weightsBefore.complexity;

  expect(changed).toBe(true);
});

it('should NOT update weights when P_simple < gate threshold', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'simple',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'complex',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // Don't train - P_simple will be low
  const weightsBefore = uok.getComplexityTransferWeights();

  uok.encodeAnswer('student1', 'complex', false);

  const weightsAfter = uok.getComplexityTransferWeights();

  // Weights should NOT have changed
  expect(weightsAfter.cognitiveLoad).toBeCloseTo(weightsBefore.cognitiveLoad, 10);
  expect(weightsAfter.reasoningDepth).toBeCloseTo(weightsBefore.reasoningDepth, 10);
  expect(weightsAfter.complexity).toBeCloseTo(weightsBefore.complexity, 10);
});

it('should keep weights normalized (sum = 1)', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'simple',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'complex',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // Train and trigger multiple updates
  for (let i = 0; i < 10; i++) {
    uok.encodeAnswer('student1', 'simple', true);
  }
  for (let i = 0; i < 10; i++) {
    uok.encodeAnswer('student1', 'complex', true);
  }

  const weights = uok.getComplexityTransferWeights();
  const sum = weights.cognitiveLoad + weights.reasoningDepth + weights.complexity;

  expect(sum).toBeCloseTo(1, 5);
});

it('should keep weights non-negative', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'simple',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'complex',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // Train and trigger updates
  for (let i = 0; i < 20; i++) {
    uok.encodeAnswer('student1', 'simple', i % 2 === 0);
    uok.encodeAnswer('student1', 'complex', i % 2 === 0);
  }

  const weights = uok.getComplexityTransferWeights();

  expect(weights.cognitiveLoad).toBeGreaterThanOrEqual(0);
  expect(weights.reasoningDepth).toBeGreaterThanOrEqual(0);
  expect(weights.complexity).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: FAIL (weights not updating)

- [ ] **Step 3: Add private helper method for weight update**

```typescript
// Add after learnML method (around line 253)

/**
 * Update complexity transfer weights with gated calibration
 *
 * Only updates when P_simple >= τ (gate threshold)
 * This prevents model error from being misattributed to complexity penalty
 *
 * @param studentId - Student identifier
 * @param questionId - Question that was answered
 * @param pSimple - Prediction probability for reference simple question
 * @param correct - Actual answer result
 */
private updateTransferWeights(
  studentId: string,
  questionId: string,
  pSimple: number,
  correct: boolean
): void {
  const { transfer } = this.state._ml;

  // Gate: only calibrate when we trust the simple prediction
  if (pSimple < transfer.gateThreshold) {
    return;
  }

  // Find a simpler reference question from same topic
  const currentQ = this.state.questions.get(questionId);
  if (!currentQ) return;

  // Find simplest question in same topic
  let simpleQuestionId: string | null = null;
  let minComplexity = Infinity;

  for (const [qid, q] of this.state.questions) {
    if (qid === questionId) continue;
    if (q.topics.some(t => currentQ.topics.includes(t))) {
      const qComplexity = q.features.cognitiveLoad + q.features.reasoningDepth + q.features.complexity;
      if (qComplexity < minComplexity) {
        minComplexity = qComplexity;
        simpleQuestionId = qid;
      }
    }
  }

  if (!simpleQuestionId) return;

  const simpleQ = this.state.questions.get(simpleQuestionId);
  if (!simpleQ) return;

  // Calculate delta
  const deltaC: ComplexityDelta = {
    cognitiveLoad: currentQ.features.cognitiveLoad - simpleQ.features.cognitiveLoad,
    reasoningDepth: currentQ.features.reasoningDepth - simpleQ.features.reasoningDepth,
    complexity: currentQ.features.complexity - simpleQ.features.complexity,
  };

  // Predict what complex probability should be
  const ctxSimple: Context = {
    difficulty: simpleQ.features.difficulty,
    complexity: simpleQ.features.complexity,
  };
  const pComplexPredicted = this.predict(studentId, questionId, {
    difficulty: currentQ.features.difficulty,
    complexity: currentQ.features.complexity,
  });

  // Calculate error
  const y = correct ? 1 : 0;
  const error = y - pComplexPredicted;

  // Update weights (only for dimensions where delta > 0)
  const w = transfer.weights;
  const lr = transfer.learningRate;

  if (deltaC.cognitiveLoad > 0) {
    w.cognitiveLoad = Math.max(0, w.cognitiveLoad + lr * error * deltaC.cognitiveLoad);
  }
  if (deltaC.reasoningDepth > 0) {
    w.reasoningDepth = Math.max(0, w.reasoningDepth + lr * error * deltaC.reasoningDepth);
  }
  if (deltaC.complexity > 0) {
    w.complexity = Math.max(0, w.complexity + lr * error * deltaC.complexity);
  }

  // Normalize to sum = 1
  const sum = w.cognitiveLoad + w.reasoningDepth + w.complexity;
  if (sum > 0) {
    w.cognitiveLoad /= sum;
    w.reasoningDepth /= sum;
    w.complexity /= sum;
  }
}
```

- [ ] **Step 4: Modify encodeAnswer to call updateTransferWeights**

```typescript
// Modify encodeAnswer method (around line 114-156)

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

  // 3. NEW: Update complexity transfer weights
  this.updateTransferWeights(studentId, questionId, probability, correct);

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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/qie/uok.ts tests/qie/integration.test.ts
git commit -m "feat: implement gated online calibration for transfer weights"
```

---

## Task 5: Add Configuration API

**Files:**
- Modify: `lib/qie/uok.ts`
- Test: `tests/qie/integration.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to tests/qie/integration.test.ts in describe('Complexity Transfer')

it('should allow setting transfer configuration', () => {
  const uok = new UOK();

  uok.setComplexityTransferConfig({
    gateThreshold: 0.8,
    learningRate: 0.02,
  });

  const config = uok.getComplexityTransferConfig();

  expect(config.gateThreshold).toBe(0.8);
  expect(config.learningRate).toBe(0.02);
  // Weights should remain unchanged
  expect(config.weights.cognitiveLoad).toBeCloseTo(1/3, 5);
});

it('should validate gate threshold is between 0 and 1', () => {
  const uok = new UOK();

  expect(() => {
    uok.setComplexityTransferConfig({ gateThreshold: -0.1 });
  }).toThrow();

  expect(() => {
    uok.setComplexityTransferConfig({ gateThreshold: 1.5 });
  }).toThrow();
});

it('should validate learning rate is positive', () => {
  const uok = new UOK();

  expect(() => {
    uok.setComplexityTransferConfig({ learningRate: 0 });
  }).toThrow();

  expect(() => {
    uok.setComplexityTransferConfig({ learningRate: -0.01 });
  }).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: FAIL with "setComplexityTransferConfig is not a function"

- [ ] **Step 3: Add setComplexityTransferConfig method**

```typescript
// Add after getComplexityTransferWeights method

/**
 * Set complexity transfer configuration
 * @param config - Partial config to update (weights cannot be set directly)
 */
setComplexityTransferConfig(config: {
  gateThreshold?: number;
  learningRate?: number;
}): void {
  const { transfer } = this.state._ml;

  if (config.gateThreshold !== undefined) {
    if (config.gateThreshold < 0 || config.gateThreshold > 1) {
      throw new Error('gateThreshold must be between 0 and 1');
    }
    transfer.gateThreshold = config.gateThreshold;
  }

  if (config.learningRate !== undefined) {
    if (config.learningRate <= 0) {
      throw new Error('learningRate must be positive');
    }
    transfer.learningRate = config.learningRate;
  }
}
```

- [ ] **Step 4: Add getComplexityTransferConfig method**

```typescript
// Add after setComplexityTransferConfig method

/**
 * Get current complexity transfer configuration
 */
getComplexityTransferConfig(): ComplexityTransferConfig {
  return {
    weights: { ...this.state._ml.transfer.weights },
    gateThreshold: this.state._ml.transfer.gateThreshold,
    learningRate: this.state._ml.transfer.learningRate,
  };
}
```

- [ ] **Step 5: Add ComplexityTransferConfig import**

```typescript
// Add to imports

import {
  // ... existing imports
  ComplexityTransferConfig,    // NEW
} from './types';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/qie/uok.ts tests/qie/integration.test.ts
git commit -m "feat: add complexity transfer configuration API"
```

---

## Task 6: Update Public API (index.ts)

**Files:**
- Modify: `lib/qie/index.ts`

- [ ] **Step 1: Read current index.ts**

Run: `cat lib/qie/index.ts`
Expected: See current exports

- [ ] **Step 2: Add new exports to index.ts**

```typescript
// lib/qie/index.ts

export { UOK } from './uok';
export type {
  Context,
  QuestionFeatures,
  ModelExport,
  MLState,
  QuestionState,
  StudentState,
  UOKState,
  SpaceState,
  TraceEntry,
  Explanation,
  Action,
  Gap,
  ComplexityTransferWeights,      // NEW
  ComplexityDelta,                // NEW
  ComplexityTransferConfig,       // NEW
} from './types';
```

- [ ] **Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/qie/index.ts
git commit -m "feat: export complexity transfer types"
```

---

## Task 7: Full Integration Test

**Files:**
- Test: `tests/qie/integration.test.ts`

- [ ] **Step 1: Write the full workflow test**

```typescript
// Add to tests/qie/integration.test.ts in describe('Complexity Transfer')

it('should handle full complexity transfer workflow', () => {
  const uok = new UOK();

  // 1. Encode question spectrum
  uok.encodeQuestion({
    id: 'easy',
    content: '计算',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'medium',
    content: '计算并分析',
    topics: ['math']
  });

  uok.encodeQuestion({
    id: 'hard',
    content: '证明并推导分析至少两个情况',
    topics: ['math']
  });

  // 2. Train student on easy questions
  for (let i = 0; i < 10; i++) {
    uok.encodeAnswer('student', 'easy', true);
  }

  // 3. Get predictions via transfer
  const pEasyToMedium = uok.predictWithComplexityTransfer('student', 'easy', 'medium');
  const pEasyToHard = uok.predictWithComplexityTransfer('student', 'easy', 'hard');

  // 4. Verify monotonicity
  expect(pEasyToHard).toBeLessThan(pEasyToMedium);
  expect(pEasyToMedium).toBeLessThan(1);

  // 5. Answer medium question
  uok.encodeAnswer('student', 'medium', true);

  // 6. Weights should have updated
  const weights = uok.getComplexityTransferWeights();
  const sum = weights.cognitiveLoad + weights.reasoningDepth + weights.complexity;
  expect(sum).toBeCloseTo(1, 5);

  // 7. Predictions remain consistent
  const pEasyToHardAfter = uok.predictWithComplexityTransfer('student', 'easy', 'hard');
  expect(pEasyToHardAfter).toBeGreaterThan(0);
});

it('should maintain state consistency across operations', () => {
  const uok = new UOK();

  uok.encodeQuestion({
    id: 'q1',
    content: '计算',
    topics: ['math']
  });

  // Multiple encode/answer cycles
  for (let i = 0; i < 5; i++) {
    uok.encodeAnswer('s1', 'q1', i % 2 === 0);
  }

  // State should be valid
  const explanation = uok.explain({ studentId: 's1' });
  expect(explanation.type).toBe('student');

  const config = uok.getComplexityTransferConfig();
  expect(config.weights.cognitiveLoad).toBeGreaterThanOrEqual(0);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/qie/integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/qie/integration.test.ts
git commit -m "test: add full complexity transfer workflow tests"
```

---

## Task 8: Final Verification

**Files:**
- All modified files

- [ ] **Step 1: Run all tests**

Run: `pnpm test tests/qie/`
Expected: All PASS (including existing tests)

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Build verification**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Dev server smoke test**

Run: `pnpm dev` (in background)
Expected: Server starts on localhost:3000 or 3001

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete QIE complexity transfer mechanism

- Add complexity transfer types (ComplexityTransferWeights, ComplexityDelta, ComplexityTransferConfig)
- Implement predictWithComplexityTransfer method with mapping function: P_complex = P_simple · exp(- w · ΔC)
- Add gated online calibration in encodeAnswer with τ = 0.7 gate threshold
- Add configuration API (setComplexityTransferConfig, getComplexityTransferConfig)
- Add comprehensive integration tests

Design: docs/superpowers/specs/2026-04-28-qie-complexity-transfer-design.md
"
```

---

## Summary

This plan implements the complexity transfer mechanism as specified in the design document:

1. **Types** (Task 1): Add type definitions for transfer weights, delta, and config
2. **Initialization** (Task 2): Initialize uniform weights and expose via getter
3. **Prediction** (Task 3): Implement `predictWithComplexityTransfer` with mapping function
4. **Calibration** (Task 4): Add gated online weight updates in `encodeAnswer`
5. **Configuration** (Task 5): Add API for setting gate threshold and learning rate
6. **Exports** (Task 6): Export new types via index.ts
7. **Integration** (Task 7): Full workflow tests
8. **Verification** (Task 8): Final checks and commit

The implementation follows the design constraints:
- No new external data
- No offline training
- Extends existing v2.0 architecture
- Includes gated calibration to prevent model error pollution
