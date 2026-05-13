/**
 * 数据迁移脚本：将 knowledgePoints (Name) 转换为 QuestionKnowledgePoint (ID)
 *
 * 用途：从 JSON 字段中解析知识点名称，查找对应的 ID，存入多对多关联表
 * 用法：pnpm tsx scripts/migrate-kp-name-to-id.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationResult {
  total: number;
  success: number;
  failed: number;
  unmatched: string[];
}

async function migrateKnowledgePoints(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    success: 0,
    failed: 0,
    unmatched: [],
  };

  console.log('开始知识点名称 → ID 迁移...\n');

  // 1. 获取所有问题
  const questions = await prisma.question.findMany({
    where: {
      knowledgePoints: {
        not: '[]',
      },
    },
    select: {
      id: true,
      knowledgePoints: true,
    },
  });

  result.total = questions.length;
  console.log(`找到 ${result.total} 个包含知识点的题目\n`);

  // 2. 构建知识点名称 → ID 映射
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  const nameToIdMap = new Map<string, string>();
  for (const kp of knowledgePoints) {
    nameToIdMap.set(kp.name, kp.id);
  }

  console.log(`知识点总数: ${nameToIdMap.size}\n`);

  // 3. 逐个处理题目
  for (const question of questions) {
    try {
      // 解析 knowledgePoints JSON
      const kpNamesRaw = question.knowledgePoints || '[]';
      const kpNames: string[] = typeof kpNamesRaw === 'string'
        ? JSON.parse(kpNamesRaw)
        : kpNamesRaw as string[];

      for (const name of kpNames) {
        const kpId = nameToIdMap.get(name);

        if (kpId) {
          // 创建关联记录
          await prisma.questionKnowledgePoint.upsert({
            where: {
              questionId_knowledgePointId: {
                questionId: question.id,
                knowledgePointId: kpId,
              },
            },
            create: {
              questionId: question.id,
              knowledgePointId: kpId,
            },
            update: {},
          });
        } else {
          // 记录未匹配的名称
          if (!result.unmatched.includes(name)) {
            result.unmatched.push(name);
          }
        }
      }

      result.success++;
    } catch (error) {
      console.error(`处理题目 ${question.id} 失败:`, error);
      result.failed++;
    }
  }

  return result;
}

async function main() {
  try {
    const result = await migrateKnowledgePoints();

    console.log('\n========== 迁移完成 ==========\n');
    console.log(`总题目数: ${result.total}`);
    console.log(`成功迁移: ${result.success}`);
    console.log(`迁移失败: ${result.failed}`);
    console.log(`成功率: ${((result.success / result.total) * 100).toFixed(1)}%`);

    if (result.unmatched.length > 0) {
      console.log(`\n⚠️  未匹配的知识点名称 (${result.unmatched.length}):`);
      result.unmatched.forEach((name) => console.log(`  - ${name}`));
    }

    // 返回码：成功则 0，失败则 1
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();