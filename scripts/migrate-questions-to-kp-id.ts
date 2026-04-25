/**
 * 数据迁移：将 Question.knowledgePoints 从 name 改为 id
 *
 * 之前：knowledgePoints = ["二次函数"]
 * 之后：knowledgePoints = ["cmodriw6k00091ysgd3c6c0dw"]
 */

import { prisma } from '../lib/prisma';

async function migrate() {
  console.log('开始迁移 Question.knowledgePoints (name -> id)...\n');

  // 1. 获取所有知识点 name -> id 映射
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    select: { id: true, name: true }
  });
  const nameToId = new Map(knowledgePoints.map(kp => [kp.name, kp.id]));

  console.log(`知识点映射 (${nameToId.size} 个):`);
  nameToId.forEach((id, name) => console.log(`  ${name} -> ${id.slice(0, 12)}...`));
  console.log('');

  // 2. 获取所有 Question
  const questions = await prisma.question.findMany({
    select: { id: true, knowledgePoints: true }
  });

  console.log(`找到 ${questions.length} 道题目\n`);

  // 3. 迁移每条记录
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const question of questions) {
    try {
      const oldKps: string[] = JSON.parse(question.knowledgePoints || '[]');

      // 检查是否已经是 id 格式（长度 > 20 的 cuid）
      if (oldKps.length > 0 && oldKps[0].length > 20) {
        skipCount++;
        continue;
      }

      // 将 name 转换为 id
      const newKps: string[] = [];
      let hasUnknown = false;

      for (const name of oldKps) {
        const id = nameToId.get(name);
        if (id) {
          newKps.push(id);
        } else {
          console.log(`⚠ 警告: 找不到知识点 "${name}"`);
          hasUnknown = true;
        }
      }

      if (hasUnknown || newKps.length === 0) {
        failCount++;
        continue;
      }

      // 更新数据库
      await prisma.question.update({
        where: { id: question.id },
        data: { knowledgePoints: JSON.stringify(newKps) }
      });

      console.log(`✓ ${question.id.slice(0, 12)}...: ${JSON.stringify(oldKps)} -> ${JSON.stringify(newKps.map(id => id.slice(0, 12) + '...'))}`);
      successCount++;

    } catch (error) {
      console.log(`✗ 错误: ${question.id}`, error);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`迁移完成！成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}`);
  console.log('========================================\n');

  // 4. 验证
  const afterQuestions = await prisma.question.findMany({
    select: { knowledgePoints: true },
    take: 5
  });

  console.log('验证（随机5条）:');
  afterQuestions.forEach(q => {
    const kps: string[] = JSON.parse(q.knowledgePoints || '[]');
    const format = kps[0]?.length > 20 ? 'id' : 'name';
    console.log(`  ${JSON.stringify(kps.map(kp => kp.slice(0, 12) + '...'))} [${format}]`);
  });
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
