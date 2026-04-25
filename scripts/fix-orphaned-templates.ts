// scripts/fix-orphaned-templates.ts
import { prisma } from '../lib/prisma';

async function fix() {
  // 找到所有没有 knowledgeId 的模板
  const templates = await prisma.template.findMany({
    where: { knowledgeId: null },
    select: { id: true, name: true, templateKey: true }
  });

  console.log(`找到 ${templates.length} 个无 knowledgeId 的模板`);

  // 获取知识点映射
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true }
  });

  const nameToId = new Map(kps.map(kp => [kp.name, kp.id]));

  // 根据模板名称推断知识点
  const keyToKpName: Record<string, string> = {
    'quadratic_vertex': '二次函数',
    'linear_equation': '一元一次方程',
    'pythagorean': '勾股定理',
    'probability': '概率统计'
  };

  for (const template of templates) {
    const kpName = keyToKpName[template.templateKey || ''] || template.name.includes('二次') ? '二次函数' :
                   template.name.includes('一元') ? '一元一次方程' :
                   template.name.includes('勾股') ? '勾股定理' :
                   template.name.includes('概率') ? '概率统计' : '';

    const kpId = kpName ? nameToId.get(kpName) : null;

    if (kpId) {
      await prisma.template.update({
        where: { id: template.id },
        data: { knowledgeId: kpId }
      });
      console.log(`✓ ${template.name} -> ${kpName}`);
    } else {
      console.log(`⚠ 无法推断: ${template.name}`);
    }
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
