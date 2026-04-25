import { prisma } from '../lib/prisma';

async function migrate() {
  console.log('开始迁移 UserKnowledge 数据...\n');

  // 1. 获取所有 UserKnowledge 记录
  const userKnowledgeRecords = await prisma.userKnowledge.findMany();
  console.log('找到', userKnowledgeRecords.length, '条 UserKnowledge 记录\n');

  // 2. 获取 KnowledgePoint 映射 (name -> id)
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    select: { id: true, name: true }
  });
  const nameToId = new Map(knowledgePoints.map(kp => [kp.name, kp.id]));
  console.log('知识点映射:');
  nameToId.forEach((id, name) => console.log(`  ${name} -> ${id}`));
  console.log('');

  // 3. 迁移每条记录
  let successCount = 0;
  let failCount = 0;

  for (const record of userKnowledgeRecords) {
    const kpId = nameToId.get(record.knowledgePoint || '');

    if (kpId) {
      await prisma.userKnowledge.update({
        where: { id: record.id },
        data: {
          knowledgePointId: kpId,
        }
      });
      console.log(`✓ 迁移成功: ${record.knowledgePoint} -> ${kpId}`);
      successCount++;
    } else {
      console.log(`✗ 警告: 找不到知识点 "${record.knowledgePoint}" 的 ID，跳过`);
      failCount++;
    }
  }

  console.log('\n========================================');
  console.log(`迁移完成！成功: ${successCount}, 失败: ${failCount}`);
  console.log('========================================\n');

  // 4. 验证
  const recordsWithId = await prisma.userKnowledge.findMany({
    where: { knowledgePointId: { not: null } }
  });
  console.log('更新后有 knowledgePointId 的记录数:', recordsWithId.length);

  const recordsWithoutId = await prisma.userKnowledge.findMany({
    where: { knowledgePointId: null }
  });
  console.log('仍未有关PointId的记录数:', recordsWithoutId.length);
}

migrate().catch(console.error);