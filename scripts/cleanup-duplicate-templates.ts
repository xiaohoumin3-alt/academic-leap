// scripts/cleanup-duplicate-templates.ts
import { prisma } from '../lib/prisma';

async function cleanup() {
  // 找到二次函数知识点 id
  const kp = await prisma.knowledgePoint.findFirst({
    where: { name: '二次函数' },
    select: { id: true }
  });

  if (!kp) {
    console.error('找不到二次函数知识点');
    return;
  }

  // 找到所有 quadratic_vertex 模板
  const templates = await prisma.template.findMany({
    where: { templateKey: 'quadratic_vertex' },
    select: { id: true, knowledgeId: true, name: true }
  });

  console.log(`找到 ${templates.length} 个 quadratic_vertex 模板`);

  // 保留第一个有 knowledgeId 的模板，删除其他
  const keepId = templates.find(t => t.knowledgeId === kp.id)?.id || templates[0].id;
  const deleteIds = templates.filter(t => t.id !== keepId).map(t => t.id);

  console.log(`保留: ${keepId.slice(0, 12)}...`);
  console.log(`删除: ${deleteIds.length} 个`);

  // 删除重复模板
  for (const id of deleteIds) {
    await prisma.template.delete({ where: { id } });
    console.log(`✓ 删除 ${id.slice(0, 12)}...`);
  }

  // 确保保留的模板有 knowledgeId
  const keepTemplate = await prisma.template.findUnique({
    where: { id: keepId },
    select: { knowledgeId: true }
  });

  if (!keepTemplate?.knowledgeId) {
    await prisma.template.update({
      where: { id: keepId },
      data: { knowledgeId: kp.id }
    });
    console.log(`✓ 更新模板 knowledgeId`);
  }

  await prisma.$disconnect();
}

cleanup().catch(console.error);
