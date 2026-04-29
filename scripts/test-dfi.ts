/**
 * DFI (Data Flow Integrity) Test
 * 测试数据链完整度：题目 → 作答 → 诊断 → 推荐 是否全链路可追踪
 *
 * 目标: DFI ≥ 0.99
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DFIResult {
  totalEvents: number;
  completeTraces: number;
  dfi: number;
  passed: boolean;
  brokenLinks: BrokenLink[];
}

interface BrokenLink {
  attemptId: string;
  userId: string;
  missingStage: string[];
}

/**
 * 检查单个 Attempt 的数据链完整性
 */
async function checkAttemptTrace(attemptId: string): Promise<{
  complete: boolean;
  missingStages: string[];
}> {
  const missingStages: string[] = [];

  // Stage 1: Attempt 存在
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { steps: true },
  });

  if (!attempt) {
    return { complete: false, missingStages: ['ATTEMPT'] };
  }

  // Stage 2: 有作答记录 (AttemptStep)
  if (!attempt.steps || attempt.steps.length === 0) {
    missingStages.push('ATTEMPT_STEP');
  }

  // Stage 3: 有用户知识更新 (UserKnowledge)
  const userKnowledge = await prisma.userKnowledge.findMany({
    where: {
      userId: attempt.userId,
      lastPractice: { gte: attempt.startedAt },
    },
  });
  if (userKnowledge.length === 0) {
    missingStages.push('USER_KNOWLEDGE');
  }

  // Stage 4: 有学习路径/推荐 (LearningPath 或 PathAdjustment)
  const learningPath = await prisma.learningPath.findFirst({
    where: {
      userId: attempt.userId,
      createdAt: { gte: attempt.startedAt },
    },
  });

  const pathAdjustment = await prisma.pathAdjustment.findFirst({
    where: {
      path: { userId: attempt.userId },
      createdAt: { gte: attempt.startedAt },
    },
  });

  if (!learningPath && !pathAdjustment) {
    missingStages.push('LEARNING_PATH');
  }

  return {
    complete: missingStages.length === 0,
    missingStages,
  };
}

/**
 * 计算 DFI
 */
export async function calculateDFI(
  sampleSize: number = 100,
  userId?: string
): Promise<DFIResult> {
  console.log(`🔍 计算 DFI (Data Flow Integrity)`);
  console.log(`   样本大小: ${sampleSize}`);

  // 获取样本 Attempts
  const where = userId ? { userId } : {};
  const attempts = await prisma.attempt.findMany({
    where: {
      ...where,
      completedAt: { not: null }, // 只检查已完成的练习
    },
    take: sampleSize,
    orderBy: { startedAt: 'desc' },
  });

  const totalEvents = attempts.length;
  console.log(`   总事件数: ${totalEvents}`);

  if (totalEvents === 0) {
    return {
      totalEvents: 0,
      completeTraces: 0,
      dfi: 0,
      passed: false,
      brokenLinks: [],
    };
  }

  const brokenLinks: BrokenLink[] = [];
  let completeTraces = 0;

  for (const attempt of attempts) {
    const { complete, missingStages } = await checkAttemptTrace(attempt.id);

    if (complete) {
      completeTraces++;
    } else {
      brokenLinks.push({
        attemptId: attempt.id,
        userId: attempt.userId,
        missingStage: missingStages,
      });
    }
  }

  const dfi = totalEvents > 0 ? completeTraces / totalEvents : 0;
  const passed = dfi >= 0.99;

  return {
    totalEvents,
    completeTraces,
    dfi,
    passed,
    brokenLinks,
  };
}

/**
 * 打印 DFI 报告
 */
export function printDFIReport(result: DFIResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 DFI (Data Flow Integrity) 报告');
  console.log('='.repeat(60));

  console.log(`\n📈 指标:`);
  console.log(`   总事件数:      ${result.totalEvents}`);
  console.log(`   完整追踪:      ${result.completeTraces}`);
  console.log(`   DFI:           ${(result.dfi * 100).toFixed(2)}%`);
  console.log(`   目标:          ≥ 99%`);

  console.log(`\n${result.passed ? '✅ 通过' : '❌ 失败'}`);

  if (!result.passed) {
    console.log(`\n🔗 断链详情 (前10条):`);
    result.brokenLinks.slice(0, 10).forEach((link, i) => {
      console.log(`   ${i + 1}. Attempt ${link.attemptId.slice(0, 8)}...`);
      console.log(`      缺失阶段: ${link.missingStage.join(', ')}`);
    });

    if (result.brokenLinks.length > 10) {
      console.log(`   ... 还有 ${result.brokenLinks.length - 10} 条`);
    }

    // 按缺失阶段统计
    const stageStats = new Map<string, number>();
    result.brokenLinks.forEach((link) => {
      link.missingStage.forEach((stage) => {
        stageStats.set(stage, (stageStats.get(stage) || 0) + 1);
      });
    });

    console.log(`\n📉 缺失阶段统计:`);
    stageStats.forEach((count, stage) => {
      const pct = ((count / result.totalEvents) * 100).toFixed(1);
      console.log(`   ${stage}: ${count} (${pct}%)`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const sampleSize = parseInt(args[0]) || 100;
  const userId = args[1];

  const result = await calculateDFI(sampleSize, userId);
  printDFIReport(result);

  // Exit with error code if failed
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
