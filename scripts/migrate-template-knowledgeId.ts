/**
 * 数据迁移：将 Template.knowledgeId 从 KnowledgePoint.id 迁移到 KnowledgeConcept.id
 *
 * 背景：Schema 已将 Template.knowledge 外键从 KnowledgePoint 改为 KnowledgeConcept
 * 现有数据中的 knowledgeId 仍指向旧的 KnowledgePoint.id，需要更新为对应的 KnowledgeConcept.id
 *
 * 映射关系：Template.knowledgeId (KnowledgePoint.id) -> KnowledgePoint.conceptId -> KnowledgeConcept.id
 */

import { prisma } from '../lib/prisma';

interface MigrationResult {
  templateId: string;
  templateName: string;
  oldKnowledgeId: string | null;
  newKnowledgeId: string | null;
  status: 'migrated' | 'skipped' | 'failed';
  error?: string;
}

async function migrate() {
  console.log('========================================');
  console.log('开始迁移 Template.knowledgeId');
  console.log('从: KnowledgePoint.id');
  console.log('到: KnowledgeConcept.id');
  console.log('========================================\n');

  // 1. 获取所有 KnowledgePoint 的 id -> conceptId 映射
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    select: { id: true, conceptId: true, name: true }
  });

  const kpIdToConceptId = new Map<string, string>();
  const kpNames = new Map<string, string>();

  for (const kp of knowledgePoints) {
    if (kp.conceptId) {
      kpIdToConceptId.set(kp.id, kp.conceptId);
      kpNames.set(kp.id, kp.name);
    }
  }

  console.log(`KnowledgePoint 映射 (${kpIdToConceptId.size} 个):`);
  kpIdToConceptId.forEach((conceptId, kpId) => {
    const name = kpNames.get(kpId) || 'unknown';
    console.log(`  ${kpId.slice(0, 12)}... (${name}) -> ${conceptId.slice(0, 12)}...`);
  });
  console.log('');

  // 2. 验证所有 conceptId 都存在于 KnowledgeConcept 表中
  const concepts = await prisma.knowledgeConcept.findMany({
    select: { id: true, name: true }
  });
  const conceptIds = new Set(concepts.map(c => c.id));
  const conceptNames = new Map(concepts.map(c => [c.id, c.name]));

  console.log(`验证 KnowledgeConcept (${conceptIds.size} 个):`);
  for (const [kpId, conceptId] of kpIdToConceptId) {
    const exists = conceptIds.has(conceptId);
    const status = exists ? '✓' : '✗';
    const kpName = kpNames.get(kpId) || 'unknown';
    const conceptName = conceptNames.get(conceptId) || 'NOT FOUND';
    console.log(`  ${status} ${kpId.slice(0, 12)}... (${kpName}) -> ${conceptId.slice(0, 12)}... (${conceptName})`);
  }
  console.log('');

  // 3. 获取所有需要迁移的 Template
  const templates = await prisma.template.findMany({
    select: { id: true, name: true, knowledgeId: true }
  });

  console.log(`找到 ${templates.length} 个模板\n`);

  // 4. 迁移每条记录
  const results: MigrationResult[] = [];
  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const template of templates) {
    const result: MigrationResult = {
      templateId: template.id,
      templateName: template.name,
      oldKnowledgeId: template.knowledgeId,
      newKnowledgeId: null,
      status: 'skipped'
    };

    try {
      // 跳过 NULL knowledgeId
      if (!template.knowledgeId) {
        result.status = 'skipped';
        results.push(result);
        skippedCount++;
        continue;
      }

      // 检查是否已经是 KnowledgeConcept ID
      // 如果 knowledgeId 存在于 KnowledgeConcept 表中，说明已经迁移过了
      if (conceptIds.has(template.knowledgeId)) {
        result.status = 'skipped';
        result.newKnowledgeId = template.knowledgeId;
        results.push(result);
        skippedCount++;
        continue;
      }

      // 尝试通过 KnowledgePoint 映射找到对应的 conceptId
      const newConceptId = kpIdToConceptId.get(template.knowledgeId);

      if (!newConceptId) {
        result.status = 'failed';
        result.error = `找不到 KnowledgePoint.id=${template.knowledgeId} 对应的 conceptId`;
        results.push(result);
        failedCount++;
        console.log(`✗ ${template.id.slice(0, 12)}... (${template.name}): 找不到 KnowledgePoint 映射`);
        continue;
      }

      // 更新数据库
      await prisma.template.update({
        where: { id: template.id },
        data: { knowledgeId: newConceptId }
      });

      result.newKnowledgeId = newConceptId;
      result.status = 'migrated';
      results.push(result);
      migratedCount++;

      const oldKpName = kpNames.get(template.knowledgeId) || 'unknown';
      const newConceptName = conceptNames.get(newConceptId) || 'unknown';

      console.log(`✓ ${template.id.slice(0, 12)}... (${template.name})`);
      console.log(`  ${template.knowledgeId.slice(0, 12)}... (${oldKpName}) -> ${newConceptId.slice(0, 12)}... (${newConceptName})`);

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      results.push(result);
      failedCount++;
      console.log(`✗ ${template.id.slice(0, 12)}... (${template.name}): ${error}`);
    }
  }

  console.log('\n========================================');
  console.log('迁移完成！');
  console.log(`成功: ${migratedCount}, 跳过: ${skippedCount}, 失败: ${failedCount}`);
  console.log('========================================\n');

  // 5. 验证迁移后的数据
  console.log('验证迁移结果（显示前5条有 knowledgeId 的记录）:');
  const afterTemplates = await prisma.template.findMany({
    where: { knowledgeId: { not: null } },
    select: { id: true, name: true, knowledgeId: true },
    take: 5
  });

  for (const t of afterTemplates) {
    const conceptName = conceptNames.get(t.knowledgeId!) || 'NOT FOUND';
    console.log(`  ${t.id.slice(0, 12)}... (${t.name}) -> ${t.knowledgeId!.slice(0, 12)}... (${conceptName})`);
  }

  // 6. 打印失败的记录（如果有）
  if (failedCount > 0) {
    console.log('\n失败的记录:');
    for (const r of results) {
      if (r.status === 'failed') {
        console.log(`  ${r.templateId.slice(0, 12)}... (${r.templateName}): ${r.error}`);
      }
    }
  }

  return { migratedCount, skippedCount, failedCount, results };
}

migrate()
  .then((result) => {
    if (result.failedCount > 0) {
      process.exit(1);
    }
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
