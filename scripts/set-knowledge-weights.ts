// scripts/set-knowledge-weights.ts
import { prisma } from '../lib/prisma';

async function setWeights() {
  // 获取四个核心知识点
  const kps = await prisma.knowledgePoint.findMany({
    where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
    select: { id: true, name: true }
  });

  const weights: Record<string, number> = {
    '一元一次方程': 3,
    '二次函数': 4,
    '勾股定理': 3,
    '概率统计': 2
  };

  for (const kp of kps) {
    await prisma.knowledgePoint.update({
      where: { id: kp.id },
      data: { weight: weights[kp.name] }
    });
    console.log(`✓ ${kp.name}: weight = ${weights[kp.name]}`);
  }

  await prisma.$disconnect();
}

setWeights().catch(console.error);
