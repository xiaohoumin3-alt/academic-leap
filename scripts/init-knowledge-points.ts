import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化核心知识点...\n');

  // 1. 获取或创建教材和章节
  const textbook = await prisma.textbookVersion.upsert({
    where: { grade_subject_name: { grade: 8, subject: '数学', name: '人教版' } },
    update: {},
    create: { grade: 8, subject: '数学', name: '人教版', year: '2024', status: 'active' }
  });
  console.log('✓ 教材:', textbook.name);

  const chapter = await prisma.chapter.upsert({
    where: { id: textbook.id + '-chapter-1' },
    update: {},
    create: {
      id: textbook.id + '-chapter-1',
      textbookId: textbook.id,
      chapterNumber: 1,
      chapterName: '代数与几何',
      sort: 0
    }
  });
  console.log('✓ 章节:', chapter.chapterName);

  // 2. 定义四个核心知识点
  const coreKnowledgePoints = [
    { name: '一元一次方程', category: '代数', weight: 25 },
    { name: '勾股定理', category: '几何', weight: 20 },
    { name: '二次函数', category: '代数', weight: 30 },
    { name: '概率统计', category: '统计', weight: 25 },
  ];

  // 3. 创建知识概念和知识点实例
  for (const kp of coreKnowledgePoints) {
    // 检查概念是否已存在
    let concept = await prisma.knowledgeConcept.findFirst({
      where: { name: kp.name }
    });

    if (!concept) {
      concept = await prisma.knowledgeConcept.create({
        data: { name: kp.name, category: kp.category, weight: kp.weight }
      });
      console.log(`✓ 创建概念: ${kp.name} (${kp.category})`);
    } else {
      console.log(`  概念已存在: ${kp.name}`);
    }

    // 检查知识点是否已存在
    let knowledgePoint = await prisma.knowledgePoint.findFirst({
      where: {
        name: kp.name,
        deletedAt: null
      }
    });

    if (!knowledgePoint) {
      knowledgePoint = await prisma.knowledgePoint.create({
        data: {
          name: kp.name,
          chapterId: chapter.id,
          conceptId: concept.id,
          weight: 0,
          inAssess: true,
          status: 'active'
        }
      });
      console.log(`  ✓ 创建知识点: ${knowledgePoint.id} - ${kp.name}`);
    } else {
      console.log(`    知识点已存在: ${knowledgePoint.id} - ${kp.name}`);
    }
  }

  console.log('\n========================================');
  console.log('初始化完成！');
  console.log('========================================\n');

  // 4. 验证结果
  const allConcepts = await prisma.knowledgeConcept.findMany();
  const allKnowledgePoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null }
  });

  console.log('当前知识概念数量:', allConcepts.length);
  console.log('当前知识点数量:', allKnowledgePoints.length);
  console.log('\n知识点列表:');
  for (const kp of allKnowledgePoints) {
    const concept = await prisma.knowledgeConcept.findUnique({
      where: { id: kp.conceptId }
    });
    console.log(`  - ${kp.name} (${concept?.category || 'N/A'}) [${kp.status}]`);
  }
}

main()
  .catch((e) => {
    console.error('错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
