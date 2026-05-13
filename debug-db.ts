import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 检查题库总数
  const totalQuestions = await prisma.question.count({
    where: {
      type: { in: ['multiple_choice', 'fill_blank'] }
    }
  });
  
  console.log('题库总数:', totalQuestions);
  
  // 检查按知识点分布
  const byKp = await prisma.question.groupBy({
    by: ['generatedFrom'],
    where: {
      type: { in: ['multiple_choice', 'fill_blank'] },
      generatedFrom: { not: null }
    },
    _count: { id: true }
  });
  
  console.log('\n各知识点题目数:');
  for (const row of byKp) {
    console.log(`  ${row.generatedFrom}: ${row._count.id}`);
  }
  
  // 检查按 difficulty 分布
  const byDiff = await prisma.question.groupBy({
    by: ['difficulty'],
    where: {
      type: { in: ['multiple_choice', 'fill_blank'] }
    },
    _count: { id: true }
  });
  
  console.log('\n按难度分布:');
  for (const row of byDiff) {
    console.log(`  L${row.difficulty}: ${row._count.id}`);
  }
  
  // 检查测评start API的查询逻辑 - 看它选了什么知识点
  const kps = await prisma.knowledgePoint.findMany({
    where: {
      inAssess: true,
      status: 'active',
      chapter: { textbookId: 'cmow9rpyz00031ymdpetii8el' }
    },
    select: { id: true, name: true },
    take: 7
  });

  // Fetch all questions and filter in memory (Json field)
  const allQuestions = await prisma.question.findMany({
    select: { id: true, knowledgePoints: true }
  });

  console.log('\n测评选取的知识点:');
  for (const kp of kps) {
    const count = allQuestions.filter(q => {
      const kps = q.knowledgePoints;
      if (Array.isArray(kps)) {
        return kps.some(kpItem => {
          if (typeof kpItem === 'string') return kpItem === kp.id;
          if (typeof kpItem === 'object' && kpItem !== null) {
            return (kpItem as { id?: string }).id === kp.id;
          }
          return false;
        });
      }
      return false;
    }).length;
    console.log(`  ${kp.name}: ${count} 题`);
  }
}

main().finally(() => prisma.$disconnect());
