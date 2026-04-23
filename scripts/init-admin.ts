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

  // Create sample knowledge points
  const kp1 = await prisma.knowledgePoint.create({
    data: { name: '一元一次方程', subject: '初中', category: '代数', weight: 25, inAssess: true, status: 'active' }
  });
  console.log('Created KP:', kp1.name);

  const kp2 = await prisma.knowledgePoint.create({
    data: { name: '勾股定理', subject: '初中', category: '几何', weight: 20, inAssess: true, status: 'active' }
  });
  console.log('Created KP:', kp2.name);

  const kp3 = await prisma.knowledgePoint.create({
    data: { name: '二次函数', subject: '初中', category: '代数', weight: 30, inAssess: true, status: 'active' }
  });
  console.log('Created KP:', kp3.name);

  const kp4 = await prisma.knowledgePoint.create({
    data: { name: '概率统计', subject: '初中', category: '统计', weight: 25, inAssess: true, status: 'active' }
  });
  console.log('Created KP:', kp4.name);

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
