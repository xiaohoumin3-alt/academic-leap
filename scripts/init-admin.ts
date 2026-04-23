import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting initialization...');

  // Check if admin exists
  const existingAdmin = await prisma.admin.findFirst();
  if (existingAdmin) {
    console.log('Admin already exists:', existingAdmin.userId);
    return;
  }

  // Create or get user
  let user = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: 'admin123',
        grade: 9,
        targetScore: 90
      }
    });
    console.log('Created user:', user.id);
  }

  // Create admin
  const admin = await prisma.admin.create({
    data: {
      userId: user.id,
      role: 'admin'
    }
  });
  console.log('Created admin:', admin.id);

  // Create sample textbook, chapter, and concepts
  const textbook = await prisma.textbookVersion.upsert({
    where: { grade_subject_name: { grade: 8, subject: '数学', name: '人教版' } },
    update: {},
    create: { grade: 8, subject: '数学', name: '人教版', year: '2024', status: 'active' }
  });
  console.log('Created textbook:', textbook.name);

  const chapter = await prisma.chapter.create({
    data: { textbookId: textbook.id, chapterNumber: 1, chapterName: '代数基础', sort: 0 }
  });
  console.log('Created chapter:', chapter.chapterName);

  // Create concepts
  const concepts = await Promise.all([
    prisma.knowledgeConcept.create({ data: { name: '一元一次方程', category: '代数', weight: 25 } }),
    prisma.knowledgeConcept.create({ data: { name: '勾股定理', category: '几何', weight: 20 } }),
    prisma.knowledgeConcept.create({ data: { name: '二次函数', category: '代数', weight: 30 } }),
    prisma.knowledgeConcept.create({ data: { name: '概率统计', category: '统计', weight: 25 } }),
  ]);
  console.log('Created concepts:', concepts.length);

  // Create knowledge points
  const kps = await Promise.all(
    concepts.map(c =>
      prisma.knowledgePoint.create({
        data: { name: c.name, chapterId: chapter.id, conceptId: c.id, weight: 0, inAssess: true, status: 'active' }
      })
    )
  );
  console.log('Created knowledge points:', kps.length);

  console.log('Initialization complete!');
  console.log('Login credentials:');
  console.log('  Email: admin@example.com');
  console.log('  Password: admin123');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
