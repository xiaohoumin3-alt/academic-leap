const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('查询知识点数据...');

  try {
    // 查询前几个知识点
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      select: {
        id: true,
        name: true,
        chapterId: true,
        chapter: {
          select: {
            id: true,
            chapterName: true,
            textbookId: true,
            textbook: {
              select: {
                id: true,
                name: true,
                subject: true,
                grade: true
              }
            }
          }
        },
        conceptId: true,
        concept: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      },
      take: 10
    });

    console.log('\n知识点列表:');
    knowledgePoints.forEach(kp => {
      console.log(`\nID: ${kp.id}`);
      console.log(`名称: ${kp.name}`);
      console.log(`教材: ${kp.chapter?.textbook?.name} (${kp.chapter?.textbook?.subject}-${kp.chapter?.textbook?.grade}年级)`);
      console.log(`章节: ${kp.chapter?.chapterName}`);
      console.log(`概念: ${kp.concept?.name} (${kp.concept?.category})`);
    });

    // 查看具体知识点
    const specificKp = await prisma.knowledgePoint.findMany({
      where: {
        OR: [
          { name: { contains: 'cmorz' } },
          { name: { contains: 'cmose' } }
        ]
      }
    });

    console.log('\n特定知识点:');
    specificKp.forEach(kp => {
      console.log(`\nID: ${kp.id}`);
      console.log(`名称: ${kp.name}`);
    });

  } catch (error) {
    console.error('错误:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });