import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local'), override: true });
config({ path: resolve(process.cwd(), '.env'), override: true });
import { prisma } from '../lib/prisma';

async function main() {
  // 模拟评估API的查询条件
  const questions = await prisma.question.findMany({
    where: {
      difficulty: { gte: 4, lte: 6 },
      type: 'multiple_choice',
    },
    select: {
      id: true,
      knowledgePoints: true,
      difficulty: true,
      isAI: true,
    },
  });

  // 按知识点分组统计
  const kpCounts = new Map<string, number>();
  questions.forEach(q => {
    const kps = JSON.parse(q.knowledgePoints || '[]');
    kps.forEach(kp => {
      kpCounts.set(kp, (kpCounts.get(kp) || 0) + 1);
    });
  });

  console.log(`评估API可用的题目总数: ${questions.length}`);
  console.log(`可用的知识点数: ${kpCounts.size}`);
  console.log(`\n各知识点可用题目数（难度4-6）:`);
  
  for (const [kp, count] of kpCounts) {
    const kpName = kp.replace('kp', '');
    console.log(`  ${kp}: ${count}题`);
  }
}

main().catch(console.error);
