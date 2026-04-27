// scripts/verify-ctg.ts
import { UOK } from '../lib/qie';

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

async function main() {
  console.log('=== CTG Verification ===\n');
  console.log('TODO: Implement verification');
}

main().catch(console.error);