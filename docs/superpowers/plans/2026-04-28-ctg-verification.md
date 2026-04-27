# CTG Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify if Complexity Transfer is effective by comparing Acc_baseline vs Acc_transfer on a "cold start" test (train on simple questions, test on complex questions).

**Architecture:** Offline verification script that:
1. Creates synthetic test data with S/C classification
2. Trains UOK on simple questions
3. Compares Baseline vs Transfer accuracy on complex questions
4. Outputs CTG metric

**Tech Stack:** TypeScript, existing UOK class, Jest for testing

---

## Task 1: Create CTG Verification Script Structure

**Files:**
- Create: `scripts/verify-ctg.ts`

- [ ] **Step 1: Create the script file**

```typescript
// scripts/verify-ctg.ts
import { UOK } from '../lib/qie';
import { QuestionState } from '../lib/qie/types';

interface TestQuestion {
  id: string;
  content: string;
  topics: string[];
  complexity: number; // 0-1
  attempts: boolean[]; // true = correct
}

interface CTGResult {
  summary: {
    CTG: number;
    CTG_avg: number;
    winRate: number;
    totalStudents: number;
    totalTests: number;
  };
  perStudent: {
    studentId: string;
    Acc_baseline: number;
    Acc_transfer: number;
    CTG: number;
    testCount: number;
  }[];
  verdict: 'SUCCESS' | 'FAILURE';
}

async function main() {
  console.log('=== CTG Verification ===\n');
  
  // TODO: Implement verification
  const result = await verifyCTG();
  
  console.log('\n=== Results ===');
  console.log(`CTG (weighted): ${result.summary.CTG.toFixed(4)}`);
  console.log(`CTG (avg):     ${result.summary.CTG_avg.toFixed(4)}`);
  console.log(`Win Rate:      ${(result.summary.winRate * 100).toFixed(1)}%`);
  console.log(`Total Tests:   ${result.summary.totalTests}`);
  console.log(`\nVerdict: ${result.verdict}`);
}

main().catch(console.error);
```

- [ ] **Step 2: Test script runs**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Outputs "=== CTG Verification ===" (script runs, TODOs will error)

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: create CTG verification script structure"
```

---

## Task 2: Implement Synthetic Data Generation

**Files:**
- Modify: `scripts/verify-ctg.ts`

- [ ] **Step 1: Add synthetic data generation function**

```typescript
/**
 * Generate synthetic test data with known S/C classification
 * 
 * Creates students with:
 * - Simple questions (complexity < threshold): used for training
 * - Complex questions (complexity >= threshold): used for testing
 */
function generateSyntheticData(): TestQuestion[] {
  const questions: TestQuestion[] = [];
  
  // Simple questions (training data)
  const simpleContents = [
    '计算 1 + 1',
    '计算 2 × 3',
    '求 10 的平方',
    '计算 15 - 7',
    '求 100 ÷ 4',
  ];
  
  for (let i = 0; i < simpleContents.length; i++) {
    questions.push({
      id: `simple_${i}`,
      content: simpleContents[i],
      topics: ['math'],
      complexity: 0.1 + Math.random() * 0.15, // 0.1-0.25
      attempts: generateAttempts(0.7, 5), // 70% correct rate, 5 attempts
    });
  }
  
  // Complex questions (testing data)
  const complexContents = [
    '证明: 如果 a² = b², 则 a = b 或 a = -b',
    '推导: (a+b)³ 的展开式',
    '分析: 二次函数 y = ax² + bx + c 的顶点坐标与系数关系',
    '计算并证明: 已知三角形三边长, 求其面积',
    '综合: 结合几何与代数方法求解复杂应用题',
  ];
  
  for (let i = 0; i < complexContents.length; i++) {
    questions.push({
      id: `complex_${i}`,
      content: complexContents[i],
      topics: ['math'],
      complexity: 0.5 + Math.random() * 0.5, // 0.5-1.0
      attempts: generateAttempts(0.5, 3), // 50% correct rate, 3 attempts
    });
  }
  
  return questions;
}

/**
 * Generate random attempt history
 */
function generateAttempts(baseRate: number, count: number): boolean[] {
  const attempts: boolean[] = [];
  for (let i = 0; i < count; i++) {
    attempts.push(Math.random() < baseRate);
  }
  return attempts;
}
```

- [ ] **Step 2: Test data generation**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Script runs without errors (TODOs remain)

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add synthetic data generation for CTG verification"
```

---

## Task 3: Implement UOK Training with Synthetic Data

**Files:**
- Modify: `scripts/verify-ctg.ts`

- [ ] **Step 1: Add training function**

```typescript
/**
 * Train UOK on simple questions only
 */
function trainUOK(questions: TestQuestion[]): UOK {
  const uok = new UOK();
  
  // Encode all questions first
  for (const q of questions) {
    uok.encodeQuestion({
      id: q.id,
      content: q.content,
      topics: q.topics,
    });
  }
  
  // Train on simple questions (complexity < 0.3)
  for (const q of questions) {
    if (q.complexity < 0.3) {
      for (const correct of q.attempts) {
        uok.encodeAnswer('student1', q.id, correct);
      }
    }
  }
  
  return uok;
}
```

- [ ] **Step 2: Test training function**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Script runs, UOK trains without errors

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add UOK training with synthetic data"
```

---

## Task 4: Implement Baseline and Transfer Accuracy Calculation

**Files:**
- Modify: `scripts/verify-ctg.ts`

- [ ] **Step 1: Add accuracy calculation functions**

```typescript
/**
 * Calculate baseline accuracy (pure MLP prediction)
 */
function calculateBaselineAccuracy(
  uok: UOK,
  testQuestions: TestQuestion[]
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  
  for (const q of testQuestions) {
    if (q.attempts.length === 0) continue;
    
    // Get the actual result (latest attempt)
    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    
    // Get baseline prediction
    const ctx = {
      difficulty: 0.5,
      complexity: q.complexity,
    };
    const prediction = uok.predict('student1', q.id, ctx);
    
    // Check if prediction matches actual
    if (Math.round(prediction) === actual) {
      correct++;
    }
    total++;
  }
  
  return { correct, total };
}

/**
 * Calculate transfer accuracy (with complexity transfer)
 */
function calculateTransferAccuracy(
  uok: UOK,
  testQuestions: TestQuestion[],
  trainQuestions: TestQuestion[]
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  
  // Find the best reference question (simplest from training set)
  const refQuestion = trainQuestions.reduce((best, q) => 
    q.complexity < best.complexity ? q : best
  );
  
  for (const q of testQuestions) {
    if (q.attempts.length === 0) continue;
    
    // Get the actual result (latest attempt)
    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    
    // Get transfer prediction
    const prediction = uok.predictWithComplexityTransfer(
      'student1',
      refQuestion.id,
      q.id
    );
    
    // Check if prediction matches actual
    if (Math.round(prediction) === actual) {
      correct++;
    }
    total++;
  }
  
  return { correct, total };
}
```

- [ ] **Step 2: Test accuracy calculation**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Outputs accuracy values

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add baseline and transfer accuracy calculation"
```

---

## Task 5: Implement CTG Aggregation and Output

**Files:**
- Modify: `scripts/verify-ctg.ts`

- [ ] **Step 1: Complete the verifyCTG function**

```typescript
async function verifyCTG(): Promise<CTGResult> {
  // 1. Generate synthetic data
  const allQuestions = generateSyntheticData();
  
  // 2. Split into train and test
  const trainQuestions = allQuestions.filter(q => q.complexity < 0.3);
  const testQuestions = allQuestions.filter(q => q.complexity >= 0.3);
  
  console.log(`Train questions: ${trainQuestions.length}`);
  console.log(`Test questions: ${testQuestions.length}`);
  
  // 3. Train UOK
  const uok = trainUOK(allQuestions);
  
  // 4. Calculate accuracies
  const baseline = calculateBaselineAccuracy(uok, testQuestions);
  const transfer = calculateTransferAccuracy(uok, testQuestions, trainQuestions);
  
  const Acc_baseline = baseline.correct / baseline.total;
  const Acc_transfer = transfer.correct / transfer.total;
  
  console.log(`\nBaseline accuracy: ${Acc_baseline.toFixed(4)} (${baseline.correct}/${baseline.total})`);
  console.log(`Transfer accuracy: ${Acc_transfer.toFixed(4)} (${transfer.correct}/${transfer.total})`);
  
  // 5. Calculate CTG
  const CTG = Acc_transfer - Acc_baseline;
  
  return {
    summary: {
      CTG,
      CTG_avg: CTG,
      winRate: CTG > 0 ? 1 : 0,
      totalStudents: 1,
      totalTests: testQuestions.length,
    },
    perStudent: [{
      studentId: 'student1',
      Acc_baseline,
      Acc_transfer,
      CTG,
      testCount: testQuestions.length,
    }],
    verdict: CTG > 0 ? 'SUCCESS' : 'FAILURE',
  };
}
```

- [ ] **Step 2: Test full verification**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Outputs full CTG results

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add CTG aggregation and output"
```

---

## Task 6: Run Multiple Trials for Statistical Significance

**Files:**
- Modify: `scripts/verify-ctg.ts`

- [ ] **Step 1: Add multiple trials**

```typescript
async function verifyCTGWithTrials(numTrials: number = 10): Promise<CTGResult> {
  const allResults: { Acc_baseline: number; Acc_transfer: number; CTG: number }[] = [];
  
  for (let trial = 0; trial < numTrials; trial++) {
    // Use seeded random for reproducibility
    Math.seedrandom?.(trial);
    
    const allQuestions = generateSyntheticData();
    const trainQuestions = allQuestions.filter(q => q.complexity < 0.3);
    const testQuestions = allQuestions.filter(q => q.complexity >= 0.3);
    
    const uok = trainUOK(allQuestions);
    
    const baseline = calculateBaselineAccuracy(uok, testQuestions);
    const transfer = calculateTransferAccuracy(uok, testQuestions, trainQuestions);
    
    const Acc_baseline = baseline.correct / baseline.total;
    const Acc_transfer = transfer.correct / transfer.total;
    const CTG = Acc_transfer - Acc_baseline;
    
    allResults.push({ Acc_baseline, Acc_transfer, CTG });
    
    console.log(`Trial ${trial + 1}: CTG = ${CTG.toFixed(4)}`);
  }
  
  // Aggregate results
  const avgCTG = allResults.reduce((sum, r) => sum + r.CTG, 0) / numTrials;
  const winRate = allResults.filter(r => r.CTG > 0).length / numTrials;
  
  return {
    summary: {
      CTG: avgCTG,
      CTG_avg: avgCTG,
      winRate,
      totalStudents: numTrials,
      totalTests: allResults[0].Acc_baseline > 0 ? allResults.length * 5 : 0,
    },
    perStudent: allResults.map((r, i) => ({
      studentId: `trial_${i}`,
      Acc_baseline: r.Acc_baseline,
      Acc_transfer: r.Acc_transfer,
      CTG: r.CTG,
      testCount: 5,
    })),
    verdict: avgCTG > 0 ? 'SUCCESS' : 'FAILURE',
  };
}
```

- [ ] **Step 2: Update main function**

```typescript
async function main() {
  console.log('=== CTG Verification ===\n');
  
  const result = await verifyCTGWithTrials(10);
  
  console.log('\n=== Aggregated Results ===');
  console.log(`CTG (avg):     ${result.summary.CTG.toFixed(4)}`);
  console.log(`Win Rate:      ${(result.summary.winRate * 100).toFixed(1)}%`);
  console.log(`\nVerdict: ${result.verdict}`);
}
```

- [ ] **Step 3: Test with multiple trials**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Outputs results from 10 trials

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add multiple trials for statistical significance"
```

---

## Task 7: Final Verification and Analysis

**Files:**
- All modified files

- [ ] **Step 1: Run final test**

Run: `pnpm ts-node scripts/verify-ctg.ts`
Expected: Complete CTG output

- [ ] **Step 2: Analyze results**

Based on the output:
- If CTG > 0: Complexity Transfer is effective
- If CTG <= 0: Complexity Transfer is NOT effective

- [ ] **Step 3: Add diagnostic output**

```typescript
// After verification, show weight analysis
console.log('\n=== Weight Analysis ===');
const weights = uok.getComplexityTransferWeights();
console.log(`cognitiveLoad: ${weights.cognitiveLoad.toFixed(4)}`);
console.log(`reasoningDepth: ${weights.reasoningDepth.toFixed(4)}`);
console.log(`complexity: ${weights.complexity.toFixed(4)}`);
```

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-ctg.ts
git commit -m "feat: add weight analysis for CTG verification"
```

---

## Summary

This plan implements the CTG verification as specified in the design document:

1. **Script Structure** (Task 1): Create verify-ctg.ts with basic structure
2. **Synthetic Data** (Task 2): Generate questions with known S/C classification
3. **Training** (Task 3): Train UOK on simple questions only
4. **Accuracy Calculation** (Task 4): Calculate baseline and transfer accuracy
5. **Aggregation** (Task 5): Calculate CTG metric
6. **Statistical Significance** (Task 6): Run multiple trials
7. **Analysis** (Task 7): Final verification and diagnostic output

The verification answers the core question:
> **"Does Complexity Transfer help predict complex question performance?"**

- CTG > 0: YES - transfer improves prediction
- CTG <= 0: NO - transfer does not help (or hurts)
