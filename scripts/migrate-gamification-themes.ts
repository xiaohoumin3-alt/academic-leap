/**
 * 游戏化主题迁移脚本
 *
 * 将旧主题名称迁移到新名称
 * adventure -> magic-academy
 * sci-fi -> career
 * fantasy -> racing
 * sports -> detective
 *
 * Run: npx tsx scripts/migrate-gamification-themes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const THEME_MAPPING: Record<string, string> = {
  'adventure': 'magic-academy',
  'sci-fi': 'career',
  'fantasy': 'racing',
  'sports': 'detective',
};

async function migrate() {
  console.log('开始迁移游戏化主题...');

  let totalMigrated = 0;

  for (const [oldTheme, newTheme] of Object.entries(THEME_MAPPING)) {
    const result = await prisma.playerProfile.updateMany({
      where: { theme: oldTheme },
      data: { theme: newTheme },
    });

    if (result.count > 0) {
      console.log(`  ${oldTheme} -> ${newTheme}: ${result.count} 条记录`);
      totalMigrated += result.count;
    }
  }

  console.log(`\n迁移完成，共更新 ${totalMigrated} 条记录`);
}

migrate()
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
