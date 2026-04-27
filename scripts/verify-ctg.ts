// scripts/verify-ctg.ts
import { UOK } from '../lib/qie/index.js';

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

/**
 * Generate synthetic test data with known S/C classification
 */
function generateSyntheticData(): TestQuestion[] {
  const questions: TestQuestion[] = [];

  // Simple questions (complexity 0.1-0.25)
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
      complexity: 0.1 + Math.random() * 0.15,
      attempts: generateAttempts(0.7, 5), // 70% correct
    });
  }

  // Complex questions (complexity 0.5-1.0)
  const complexContents = [
    '证明: 如果 a² = b², 则 a = b 或 a = -b',
    '推导: (a+b)³ 的展开式',
    '分析: 二次函数 y = ax² + bx + c 的顶点坐标',
    '计算并证明: 已知三角形三边长, 求其面积',
    '综合: 结合几何与代数方法求解复杂应用题',
  ];

  for (let i = 0; i < complexContents.length; i++) {
    questions.push({
      id: `complex_${i}`,
      content: complexContents[i],
      topics: ['math'],
      complexity: 0.5 + Math.random() * 0.5,
      attempts: generateAttempts(0.5, 3), // 50% correct
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

/**
 * Train UOK on simple questions only
 */
function trainUOK(allQuestions: TestQuestion[]): UOK {
  const uok = new UOK();

  // Encode all questions first
  for (const q of allQuestions) {
    uok.encodeQuestion({
      id: q.id,
      content: q.content,
      topics: q.topics,
    });
  }

  // Train on simple questions only (complexity < 0.3)
  for (const q of allQuestions) {
    if (q.complexity < 0.3) {
      for (const correct of q.attempts) {
        uok.encodeAnswer('student1', q.id, correct);
      }
    }
  }

  return uok;
}

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

    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    const ctx = { difficulty: 0.5, complexity: q.complexity };
    const prediction = uok.predict('student1', q.id, ctx);

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

  // Find the simplest question from training set as reference
  const refQuestion = trainQuestions.reduce((best, q) =>
    q.complexity < best.complexity ? q : best
  );

  for (const q of testQuestions) {
    if (q.attempts.length === 0) continue;

    const actual = q.attempts[q.attempts.length - 1] ? 1 : 0;
    const prediction = uok.predictWithComplexityTransfer(
      'student1',
      refQuestion.id,
      q.id
    );

    if (Math.round(prediction) === actual) {
      correct++;
    }
    total++;
  }

  return { correct, total };
}

/**
 * Run multiple trials for statistical significance
 */
async function runMultipleTrials(numTrials: number = 10): Promise<void> {
  const results: number[] = [];
  let lastUok: UOK | null = null;

  for (let i = 0; i < numTrials; i++) {
    const allQuestions = generateSyntheticData();
    const trainQuestions = allQuestions.filter(q => q.complexity < 0.3);
    const testQuestions = allQuestions.filter(q => q.complexity >= 0.3);

    const uok = trainUOK(allQuestions);
    lastUok = uok;

    const baseline = calculateBaselineAccuracy(uok, testQuestions);
    const transfer = calculateTransferAccuracy(uok, testQuestions, trainQuestions);

    const Acc_baseline = baseline.correct / baseline.total;
    const Acc_transfer = transfer.correct / transfer.total;
    const CTG = Acc_transfer - Acc_baseline;

    results.push(CTG);
    console.log(`Trial ${i + 1}: CTG = ${CTG.toFixed(4)}`);
  }

  const avgCTG = results.reduce((a, b) => a + b, 0) / numTrials;
  const winRate = results.filter(r => r > 0).length / numTrials;

  console.log(`\n=== Aggregated Results ===`);
  console.log(`Average CTG: ${avgCTG.toFixed(4)}`);
  console.log(`Win Rate: ${(winRate * 100).toFixed(1)}%`);
  console.log(`Verdict: ${avgCTG > 0 ? 'SUCCESS' : 'FAILURE'}`);

  // After printing results, add weight analysis
  console.log('\n=== Weight Analysis ===');
  if (lastUok) {
    try {
      const weights = lastUok.getComplexityTransferWeights();
      console.log(`cognitiveLoad: ${weights.cognitiveLoad.toFixed(4)}`);
      console.log(`reasoningDepth: ${weights.reasoningDepth.toFixed(4)}`);
      console.log(`complexity: ${weights.complexity.toFixed(4)}`);
    } catch (e) {
      console.log('Weights not available');
    }
  }

  // Add analysis of why transfer might be failing
  console.log('\n=== Analysis ===');
  console.log('The negative CTG suggests:');
  console.log('1. Complexity transfer weights may not be learning correctly');
  console.log('2. The mapping function P_complex = P_simple * exp(-w*ΔC) may need tuning');
  console.log('3. The fusion function λ * P_mlp + (1-λ) * P_transfer may need adjustment');
  console.log('4. More training data may be needed for weights to converge');
}

async function main() {
  console.log('=== CTG Verification ===\n');
  await runMultipleTrials(10);
}

main().catch(console.error);