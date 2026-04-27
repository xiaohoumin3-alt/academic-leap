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

async function main() {
  console.log('=== CTG Verification ===\n');
  console.log('TODO: Implement verification');
}

main().catch(console.error);