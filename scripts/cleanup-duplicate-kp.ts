/**
 * 清理重复知识点脚本
 *
 * 用途：清理数据库中的重复知识点
 * 1. 将没有题目的知识点设为 inAssess=false
 * 2. 对于重复的同名知识点，保留有题目的版本
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupResult {
  updatedCount: number;
  disabledKnowledgePoints: Array<{ id: string; name: string }>;
  remainingInAssess: number;
}

/**
 * 清理重复和无效的知识点
 * 策略：将没有题目的知识点设为 inAssess=false
 */
async function cleanup(): Promise<CleanupResult> {
  console.log('🧹 开始清理知识点数据...\n');

  // 1. 获取所有题目的知识点关联
  const allQuestions = await prisma.question.findMany({
    select: { id: true, knowledgePoints: true },
  });

  // 统计每个知识点的关联题目数
  const kpQuestionCount = new Map<string, number>();
  for (const q of allQuestions) {
    try {
      const kpList = JSON.parse(q.knowledgePoints) as string[];
      for (const kpId of kpList) {
        kpQuestionCount.set(kpId, (kpQuestionCount.get(kpId) || 0) + 1);
      }
    } catch (e) {
      // 忽略解析错误
    }
  }

  console.log(`📝 总题数: ${allQuestions.length}`);
  console.log(`📊 有关联题目的知识点: ${kpQuestionCount.size} 个\n`);

  // 2. 找出没有题目的知识点，将其设为 inAssess=false
  const allKnowledgePoints = await prisma.knowledgePoint.findMany({
    where: {
      inAssess: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });

  console.log(`✅ 当前 inAssess=true 的知识点: ${allKnowledgePoints.length} 个\n`);

  const toDisable: Array<{ id: string; name: string }> = [];
  for (const kp of allKnowledgePoints) {
    const count = kpQuestionCount.get(kp.id) || 0;
    if (count === 0) {
      toDisable.push(kp);
    }
  }

  console.log(`🔍 发现 ${toDisable.length} 个没有题目的知识点，将设为 inAssess=false\n`);

  // 3. 批量更新
  const disabledKnowledgePoints: Array<{ id: string; name: string }> = [];
  if (toDisable.length > 0) {
    console.log('🔄 正在更新...\n');

    for (const kp of toDisable) {
      await prisma.knowledgePoint.update({
        where: { id: kp.id },
        data: { inAssess: false },
      });
      disabledKnowledgePoints.push(kp);
      console.log(`  ✓ ${kp.name} (${kp.id})`);
    }
  }

  // 4. 验证结果
  const remainingInAssess = await prisma.knowledgePoint.count({
    where: {
      inAssess: true,
      deletedAt: null,
    },
  });

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📋 清理总结');
  console.log('='.repeat(50));
  console.log(`已禁用知识点: ${disabledKnowledgePoints.length} 个`);
  console.log(`剩余 inAssess=true: ${remainingInAssess} 个`);
  console.log('='.repeat(50));

  return {
    updatedCount: disabledKnowledgePoints.length,
    disabledKnowledgePoints,
    remainingInAssess,
  };
}

// 主函数
async function main() {
  try {
    const result = await cleanup();

    // 将结果保存到文件
    const fs = require('fs');
    const outputPath = './knowledge-points-cleanup.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ 清理结果已保存到: ${outputPath}`);

  } catch (error) {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { cleanup, CleanupResult };
