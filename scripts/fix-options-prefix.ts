/**
 * 修复选项前缀问题
 * 将 "A. xxx" 改为纯内容 "xxx"，因为渲染时会自动加上圆圈字母
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOptions() {
  const questions = await prisma.question.findMany({
    where: {
      content: {
        contains: '"options":',
      },
    },
    select: { id: true, content: true }
  });

  console.log('Found', questions.length, 'questions with options');

  let fixed = 0;
  for (const q of questions) {
    try {
      const parsed = JSON.parse(q.content);
      if (parsed.options && Array.isArray(parsed.options)) {
        let changed = false;
        const newOptions = parsed.options.map(opt => {
          // 去掉开头的 "A. ", "B. ", "C. ", "D. " 前缀
          const trimmed = opt.replace(/^[A-D]\.\s*/, '');
          if (trimmed !== opt) changed = true;
          return trimmed;
        });

        if (changed) {
          parsed.options = newOptions;
          await prisma.question.update({
            where: { id: q.id },
            data: { content: JSON.stringify(parsed) }
          });
          fixed++;
          console.log(`Fixed: ${q.id.substring(0, 8)}...`);
        }
      }
    } catch (e) {
      console.error(`Error: ${q.id}`, e);
    }
  }

  console.log(`\nTotal fixed: ${fixed}`);
}

fixOptions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
