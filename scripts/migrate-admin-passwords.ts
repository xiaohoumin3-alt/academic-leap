import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migrateAdminPasswords() {
  console.log('Starting admin password migration...');

  const admins = await prisma.admin.findMany({
    include: { user: true }
  });

  let migrated = 0;
  let skipped = 0;

  for (const admin of admins) {
    const user = admin.user;
    if (!user) continue;

    // 明文密码长度通常 < 60，bcrypt 哈希是 60 字符
    if (user.password.length < 60) {
      console.log(`Migrating: ${user.email}`);
      const hashed = await bcrypt.hash(user.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed }
      });
      migrated++;
    } else {
      skipped++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} already hashed`);
  await prisma.$disconnect();
}

migrateAdminPasswords().catch(console.error);