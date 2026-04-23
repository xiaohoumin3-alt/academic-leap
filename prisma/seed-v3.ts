import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始迁移知识点到 v3 结构...');

  // 1. 创建8年级数学教材
  const textbook = await prisma.textbookVersion.upsert({
    where: {
      grade_subject_name: {
        grade: 8,
        subject: '数学',
        name: '人教版',
      },
    },
    update: {},
    create: {
      grade: 8,
      subject: '数学',
      name: '人教版',
      year: '2024',
      status: 'active',
    },
  });
  console.log(`教材: ${textbook.name} ${textbook.grade}年级 (${textbook.id})`);

  // 2. 创建默认章节
  const chapter = await prisma.chapter.create({
    data: {
      textbookId: textbook.id,
      chapterNumber: 0,
      chapterName: '未分类（迁移数据）',
      sort: 999,
    },
  });
  console.log(`章节: ${chapter.chapterName} (${chapter.id})`);

  // 3. 获取现有知识点并分组创建概念
  const existingPoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
  });

  const groupedByName = new Map<string, typeof existingPoints>();
  for (const point of existingPoints) {
    if (!groupedByName.has(point.name)) {
      groupedByName.set(point.name, []);
    }
    groupedByName.get(point.name)!.push(point);
  }

  console.log(`找到 ${existingPoints.length} 个知识点，${groupedByName.size} 个唯一概念`);

  // 4. 创建概念并更新知识点
  let conceptCount = 0;
  let pointCount = 0;

  for (const [name, points] of groupedByName) {
    const firstPoint = points[0] as any;

    // 创建概念
    const concept = await prisma.knowledgeConcept.create({
      data: {
        name,
        category: (firstPoint.category as string) || null,
        weight: (firstPoint.weight as number) || 0,
      },
    });
    conceptCount++;

    // 更新知识点实例
    for (const point of points) {
      await prisma.knowledgePoint.update({
        where: { id: point.id },
        data: {
          chapterId: chapter.id,
          conceptId: concept.id,
          weight: 0, // 使用概念权重
        },
      });
      pointCount++;
    }
  }

  console.log(`迁移完成: ${conceptCount} 个概念，${pointCount} 个实例`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
