// scripts/validate-data-flow.ts
import { prisma } from '../lib/prisma';

async function validate() {
  console.log('=== 数据流验证 ===\n');

  // 1. 检查知识点
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true, weight: true, inAssess: true }
  });

  console.log('知识点状态:');
  kps.forEach(kp => {
    console.log(`  ${kp.name}: weight=${kp.weight}, inAssess=${kp.inAssess}`);
  });

  // 2. 检查模板
  const templates = await prisma.template.findMany({
    select: { id: true, name: true, knowledgeId: true }
  });

  const noKpTemplates = templates.filter(t => !t.knowledgeId);
  console.log(`\n模板状态: 总数 ${templates.length}, 无 knowledgeId: ${noKpTemplates.length}`);

  // 3. 检查题目
  const questions = await prisma.question.findMany({
    select: { knowledgePoints: true },
    take: 10
  });

  let idCount = 0;
  questions.forEach(q => {
    const kps = JSON.parse(q.knowledgePoints || '[]');
    if (kps[0]?.length > 20) idCount++;
  });

  console.log(`\n题目状态: 抽样 ${questions.length} 个, 使用 id: ${idCount}`);

  // 4. 总结
  const allValid = kps.every(kp => kp.weight > 0) &&
                   noKpTemplates.length === 0 &&
                   idCount === questions.length;

  console.log(`\n${allValid ? '✓ 验证通过' : '✗ 验证失败'}`);

  await prisma.$disconnect();
}

validate().catch(console.error);
