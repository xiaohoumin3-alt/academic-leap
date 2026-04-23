/**
 * 数据迁移脚本：标记旧格式题目
 *
 * 旧题目（没有 templateId 和 params）无法使用新的判题引擎
 * 这个脚本会标记这些题目，让前端可以识别并提示用户重新生成
 */

import { prisma } from '../lib/prisma';

async function migrateLegacyQuestions() {
  console.log('=== 开始迁移旧题目 ===');

  try {
    // 1. 统计旧题目数量
    const legacyCount = await prisma.question.count({
      where: {
        templateId: null,
      },
    });

    console.log(`发现 ${legacyCount} 个旧格式题目（无 templateId）`);

    if (legacyCount === 0) {
      console.log('没有需要迁移的题目');
      return;
    }

    // 2. 为旧题目添加标记
    // 由于我们不能轻易推断出 templateId，这里只做统计
    // 实际使用时，前端会检查 templateId 是否为 null
    const result = await prisma.question.findMany({
      where: {
        templateId: null,
      },
      select: {
        id: true,
        createdAt: true,
      },
      take: 10,
    });

    console.log('旧题目示例（前10个）：');
    result.forEach(q => {
      console.log(`  - ${q.id} (创建于: ${q.createdAt.toISOString()})`);
    });

    console.log('\n建议：');
    console.log('1. 前端会检测到 templateId 为 null 的题目');
    console.log('2. 提示用户"该题目使用旧格式，请重新生成"');
    console.log('3. 用户重新生成后会自动使用新格式');

    // 3. 可选：批量删除旧题目（如果需要）
    // const deleteResult = await prisma.question.deleteMany({
    //   where: { templateId: null },
    // });
    // console.log(`已删除 ${deleteResult.count} 个旧题目`);

    console.log('\n=== 迁移完成 ===');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接运行
migrateLegacyQuestions();
