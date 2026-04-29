#!/usr/bin/env tsx

/**
 * Extract complexity features for all questions using individual LLM calls
 */

import { PrismaClient } from '@prisma/client';
import { ComplexityExtractor } from '../lib/qie/complexity-extractor';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 逐个提取模式 ===\n');

  const extractor = new ComplexityExtractor();

  // Get all pending questions
  const questions = await prisma.question.findMany({
    where: { extractionStatus: 'PENDING' },
    select: { id: true, content: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`找到 ${questions.length} 道待处理题目\n`);

  if (questions.length === 0) {
    console.log('没有需要处理的题目');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const content = JSON.parse(q.content);

    try {
      const result = await extractor.extract(q.id, content);

      await prisma.$executeRaw`
        UPDATE "Question"
        SET "cognitiveLoad" = ${result.features.cognitiveLoad},
            "reasoningDepth" = ${result.features.reasoningDepth},
            "complexity" = ${result.features.complexity},
            "extractionStatus" = 'SUCCESS',
            "featuresExtractedAt" = datetime('now'),
            "extractionModel" = 'gemma-4-31b-it-v1'
        WHERE id = ${q.id}
      `;

      successCount++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  [${i + 1}/${questions.length}] ERROR ${q.id.substring(0, 6)}: ${message.substring(0, 50)}`);
      errorCount++;
    }

    // Progress every 50 questions
    if ((i + 1) % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const eta = (elapsed / (i + 1)) * (questions.length - i - 1);
      console.log(`  进度: ${i + 1}/${questions.length} (${((i + 1) / questions.length * 100).toFixed(1)}%) | 成功: ${successCount} | 失败: ${errorCount} | ETA: ${Math.round(eta / 60)}分钟`);
    }

    // Small delay to avoid rate limiting
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n=== 完成 ===');
  console.log(`总耗时: ${Math.round(elapsed / 60)} 分钟`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${errorCount}`);

  // Show final stats
  const stats = await prisma.$queryRaw`
    SELECT
      AVG("cognitiveLoad") as avgCog,
      AVG("reasoningDepth") as avgRea,
      AVG("complexity") as avgCom
    FROM "Question"
    WHERE "extractionStatus" = 'SUCCESS'
  ` as Array<{ avgCog: string | null; avgRea: string | null; avgCom: string | null }>;
  console.log('\n最终统计:');
  console.log(`  cognitiveLoad: ${Number(stats[0]?.avgCog ?? 0).toFixed(3)}`);
  console.log(`  reasoningDepth: ${Number(stats[0]?.avgRea ?? 0).toFixed(3)}`);
  console.log(`  complexity: ${Number(stats[0]?.avgCom ?? 0).toFixed(3)}`);

  await prisma.$disconnect();
}

main().catch(console.error);
