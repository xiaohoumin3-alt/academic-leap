/**
 * 批量生成测评题目
 *
 * 为所有 inAssess=true 但没有题目的知识点生成选择题
 * 难度范围：4-6
 * 题型：multiple_choice
 * 目标：每个知识点至少10题
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量（override: true 让.env文件覆盖系统环境变量）
config({ path: resolve(process.cwd(), '.env.local'), override: true });
config({ path: resolve(process.cwd(), '.env'), override: true });

import { prisma } from '../lib/prisma';
import { generateAndSaveCards } from '../lib/ai/generation';
import type { QuestionType } from '../lib/ai/generation';

interface KPMissingQuestions {
  id: string;
  name: string;
  conceptName: string;
  chapterInfo: string;
}

async function main() {
  console.log('=== 开始补齐测评题库 ===\n');

  // 1. 查找所有需要生成题目的知识点
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: {
      inAssess: true,
      status: 'active',
      deletedAt: null,
    },
    include: {
      concept: {
        select: {
          name: true,
        },
      },
      chapter: {
        include: {
          textbook: {
            select: {
              name: true,
              grade: true,
            },
          },
        },
      },
    },
    orderBy: {
      weight: 'desc',
    },
  });

  console.log(`找到 ${knowledgePoints.length} 个测评知识点\n`);

  // 2. 找出没有题目的知识点（难度4-6，选择题）
  const missingQuestionsKPs: KPMissingQuestions[] = [];

  for (const kp of knowledgePoints) {
    const questionCount = await prisma.question.count({
      where: {
        knowledgePoints: { contains: kp.id },
        difficulty: { gte: 4, lte: 6 },
        type: 'multiple_choice',
        extractionStatus: 'SUCCESS',
      },
    });

    if (questionCount === 0) {
      const textbook = kp.chapter?.textbook;
      missingQuestionsKPs.push({
        id: kp.id,
        name: kp.name,
        conceptName: kp.concept?.name || '未分类',
        chapterInfo: textbook
          ? `${textbook.name}（${textbook.grade}年级）`
          : '未知教材',
      });
    }
  }

  console.log(`发现 ${missingQuestionsKPs.length} 个知识点缺失题目\n`);

  if (missingQuestionsKPs.length === 0) {
    console.log('✅ 所有知识点都有题目，无需生成');
    return;
  }

  // 3. 批量生成题目
  const TARGET_QUESTIONS_PER_KP = 10;
  const DIFFICULTY = 5; // 中等难度
  const TYPES: QuestionType[] = ['multiple_choice'];

  let successCount = 0;
  let failedCount = 0;
  const failedKPs: string[] = [];

  for (let i = 0; i < missingQuestionsKPs.length; i++) {
    const kp = missingQuestionsKPs[i];
    const progress = `${i + 1}/${missingQuestionsKPs.length}`;

    console.log(`\n[${progress}] 生成题目：${kp.name}`);
    console.log(`  概念：${kp.conceptName}`);
    console.log(`  教材：${kp.chapterInfo}`);

    // 构建生成内容
    const content = [
      `知识点：${kp.name}`,
      `概念分类：${kp.conceptName}`,
      `教材：${kp.chapterInfo}`,
      `难度：${DIFFICULTY}`,
    ].join('\n');

    try {
      const result = await generateAndSaveCards({
        knowledgePointId: kp.id,
        content,
        types: TYPES,
        count: TARGET_QUESTIONS_PER_KP,
        difficulty: DIFFICULTY,
        onProgress: (batch, total, cards) => {
          console.log(`    进度：${batch}/${total}批次，已生成${cards.length}题`);
        },
      });

      console.log(`  ✅ 成功生成 ${result.questions.length} 道题目`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ 生成失败：`, error instanceof Error ? error.message : error);
      failedCount++;
      failedKPs.push(kp.name);
    }

    // 避免请求过快
    if (i < missingQuestionsKPs.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 4. 输出总结
  console.log('\n\n=== 生成总结 ===');
  console.log(`成功：${successCount}/${missingQuestionsKPs.length}`);
  console.log(`失败：${failedCount}/${missingQuestionsKPs.length}`);

  if (failedKPs.length > 0) {
    console.log('\n失败的知识点：');
    failedKPs.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n=== 验证结果 ===');

  // 5. 验证生成结果
  const stillMissing: string[] = [];

  for (const kp of missingQuestionsKPs) {
    const count = await prisma.question.count({
      where: {
        knowledgePoints: { contains: kp.id },
        difficulty: { gte: 4, lte: 6 },
        type: 'multiple_choice',
        extractionStatus: 'SUCCESS',
      },
    });

    if (count === 0) {
      stillMissing.push(kp.name);
    } else {
      console.log(`✅ ${kp.name}：${count}题`);
    }
  }

  if (stillMissing.length > 0) {
    console.log(`\n⚠️  仍然缺失题目的知识点（${stillMissing.length}个）：`);
    stillMissing.forEach(name => console.log(`  - ${name}`));
  } else {
    console.log('\n🎉 所有知识点都已补齐题目！');
  }
}

main()
  .then(() => {
    console.log('\n脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败：', error);
    process.exit(1);
  });
