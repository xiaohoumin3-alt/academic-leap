/**
 * 重新处理 FAILED 状态的题目
 * 运行: npx tsx --env-file=.env.local scripts/reprocess-failed.ts
 */

import { prisma } from '@/lib/prisma';
import { ComplexityExtractor } from '@/lib/qie/complexity-extractor';

async function main() {
  console.log('=== 重新处理 FAILED 题目 ===\n');

  // 1. 获取所有 FAILED 题目
  const failedQuestions = await prisma.question.findMany({
    where: { extractionStatus: 'FAILED' },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`找到 ${failedQuestions.length} 个 FAILED 题目\n`);

  if (failedQuestions.length === 0) {
    console.log('没有需要处理的题目');
    return;
  }

  // 2. 创建 extractor
  const extractor = new ComplexityExtractor();

  // 3. 批量提取复杂度
  const questionsToUpdate: Array<{ id: string; content: string }> = [];

  for (const q of failedQuestions) {
    try {
      const content = JSON.parse(q.content);
      questionsToUpdate.push({
        id: q.id,
        content: content.question || content.title || '未知题目',
      });
    } catch {
      console.log(`跳过题目 ${q.id}（无法解析内容）`);
    }
  }

  console.log(`准备提取 ${questionsToUpdate.length} 个题目的复杂度\n`);

  // 4. 批量提取
  const results = await extractor.extractBatch(
    questionsToUpdate.map(q => ({
      id: q.id,
      content: { description: q.content },
    })),
    {
      batchSize: 8,
      onProgress: (current, total) => {
        console.log(`进度: ${current}/${total}`);
      },
    }
  );

  console.log(`\n提取完成: ${results.size}/${questionsToUpdate.length} 个成功\n`);

  // 5. 更新数据库
  let successCount = 0;
  let failCount = 0;

  for (const q of failedQuestions) {
    const result = results.get(q.id);

    if (result) {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          extractionStatus: 'SUCCESS',
          complexity: result.features.complexity,
          cognitiveLoad: result.features.cognitiveLoad,
          reasoningDepth: result.features.reasoningDepth,
          featuresExtractedAt: new Date(),
        },
      });
      successCount++;
      console.log(`✓ ${q.id}: complexity=${result.features.complexity.toFixed(2)}`);
    } else {
      await prisma.question.update({
        where: { id: q.id },
        data: {
          extractionStatus: 'FAILED',
          extractionError: '重新提取失败',
        },
      });
      failCount++;
      console.log(`✗ ${q.id}: 提取失败`);
    }
  }

  // 6. 最终统计
  console.log('\n=== 处理完成 ===');
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);

  const finalStatus = await prisma.question.groupBy({
    by: ['extractionStatus'],
    _count: { id: true },
  });
  console.log('\n最终状态:');
  finalStatus.forEach(s => console.log(`  ${s.extractionStatus}: ${s._count.id}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
