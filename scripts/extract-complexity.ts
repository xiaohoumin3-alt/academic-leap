#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { ComplexityExtractor, ExtractionFailedError } from '../lib/qie/complexity-extractor';

const prisma = new PrismaClient();

interface Options {
  limit?: number;
  batchSize?: number;
  delayMs?: number;
  dryRun?: boolean;
  retryFailed?: boolean;
  force?: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--help' || arg === '-h') {
      console.log(`
题目复杂度特征批量提取脚本

用法:
  tsx scripts/extract-complexity.ts [选项]

选项:
  --limit <n>           限制处理的题目数量 (默认: 100)
  --batch-size <n>      批量大小 (默认: 8)
  --delay <ms>          批次间延迟毫秒数 (默认: 1000)
  --dry-run             干运行模式，不更新数据库
  --retry-failed        仅重试失败的题目
  --force               处理所有题目（包括已提取的）
  --help, -h            显示帮助信息

示例:
  tsx scripts/extract-complexity.ts --limit 10 --dry-run
  tsx scripts/extract-complexity.ts --batch-size 5 --delay 2000
  tsx scripts/extract-complexity.ts --retry-failed
      `);
      process.exit(0);
    }
    if (arg === '--limit' && next) options.limit = parseInt(next, 10);
    if (arg === '--batch-size' && next) options.batchSize = parseInt(next, 10);
    if (arg === '--delay' && next) options.delayMs = parseInt(next, 10);
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--retry-failed') options.retryFailed = true;
    if (arg === '--force') options.force = true;
  }

  return options;
}

function parseQuestionContent(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    return { description: content };
  }
}

async function main() {
  console.log('=== 题目复杂度特征批量提取 ===\n');

  const options = parseArgs();
  const extractor = new ComplexityExtractor();

  console.log('配置:');
  console.log(`  限制: ${options.limit || '无'}`);
  console.log(`  批量大小: ${options.batchSize || 8}`);
  console.log(`  延迟: ${options.delayMs || 1000}ms`);
  console.log(`  干运行: ${options.dryRun ? '是' : '否'}`);
  console.log(`  重试失败: ${options.retryFailed ? '是' : '否'}`);
  console.log();

  // Build where clause
  // Note: We can't use extractionStatus: null in OR clauses due to Prisma limitation
  // Instead, we query for non-SUCCESS statuses
  const where: any = {};

  if (options.retryFailed) {
    where.extractionStatus = 'FAILED';
  } else if (!options.force) {
    where.extractionStatus = { in: ['PENDING', 'FAILED'] };
  }

  const questions = await prisma.question.findMany({
    where,
    take: options.limit || 100,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
    },
  });

  console.log(`找到 ${questions.length} 道题目\n`);

  if (questions.length === 0) {
    console.log('没有需要处理的题目');
    return;
  }

  const items = questions.map(q => ({
    id: q.id,
    content: parseQuestionContent(q.content),
  }));

  console.log('开始批量提取...\n');

  const results = await extractor.extractBatch(items, {
    batchSize: options.batchSize || 8,
    delayMs: options.delayMs || 1000,
    onProgress: (current, total) => {
      const percent = ((current / total) * 100).toFixed(1);
      console.log(`  进度: ${current}/${total} (${percent}%)`);
    },
  });

  console.log('\n提取完成!\n');

  // Statistics
  const featuresArray = Array.from(results.values());
  const stats = {
    total: featuresArray.length,
    highConfidence: featuresArray.filter(r => r.confidence > 0.8).length,
    lowConfidence: featuresArray.filter(r => r.confidence < 0.5).length,
    avgCognitiveLoad: featuresArray.reduce((sum, r) => sum + r.features.cognitiveLoad, 0) / featuresArray.length,
    avgReasoningDepth: featuresArray.reduce((sum, r) => sum + r.features.reasoningDepth, 0) / featuresArray.length,
    avgComplexity: featuresArray.reduce((sum, r) => sum + r.features.complexity, 0) / featuresArray.length,
  };

  console.log('=== 统计 ===');
  console.log(`  总数: ${stats.total}`);
  console.log(`  高置信度 (>0.8): ${stats.highConfidence}`);
  console.log(`  低置信度 (<0.5): ${stats.lowConfidence}`);
  console.log(`  平均认知负荷: ${stats.avgCognitiveLoad.toFixed(3)}`);
  console.log(`  平均推理深度: ${stats.avgReasoningDepth.toFixed(3)}`);
  console.log(`  平均复杂度: ${stats.avgComplexity.toFixed(3)}`);

  // Show low confidence
  const lowConf = featuresArray.filter(r => r.confidence < 0.5);
  if (lowConf.length > 0) {
    console.log('\n=== 低置信度题目 ===');
    lowConf.forEach(r => {
      console.log(`  ${r.questionId}: confidence=${r.confidence.toFixed(2)}`);
    });
  }

  if (!options.dryRun) {
    console.log('\n更新数据库...');
    let successCount = 0;
    let errorCount = 0;

    for (const [questionId, result] of results) {
      try {
        await prisma.question.update({
          where: { id: questionId },
          data: {
            cognitiveLoad: result.features.cognitiveLoad,
            reasoningDepth: result.features.reasoningDepth,
            complexity: result.features.complexity,
            extractionStatus: 'SUCCESS',
            featuresExtractedAt: new Date(),
            extractionModel: 'gemma-4-31b-it-v1',
            extractionError: null,
          },
        });
        successCount++;
      } catch (error) {
        console.error(`  更新失败 ${questionId}:`, error);
        errorCount++;
      }
    }

    console.log(`  成功: ${successCount}`);
    console.log(`  失败: ${errorCount}`);
  } else {
    console.log('\n干运行模式 - 跳过数据库更新');
  }

  console.log('\n完成!');
}

main().catch(console.error);
