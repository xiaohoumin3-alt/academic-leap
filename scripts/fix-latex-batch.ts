/**
 * 批量修复数据库中AI生成题目的LaTeX语法
 * 运行: npx tsx scripts/fix-latex-batch.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fixLaTeX(content: string): string {
  if (!content) return content;
  let fixed = content;

  // sqrt{...} → \sqrt{...}
  fixed = fixed.replace(/(?<!\\)(sqrt)\{([^}]+)\}/g, '\\sqrt{$2}');
  // sqrt后直接跟字母 → \sqrt{字母}
  fixed = fixed.replace(/(?<!\\)(sqrt)\s+([a-zA-Z])/g, '\\sqrt{$2}');
  // sqrt后直接跟数字 → \sqrt{数字}
  fixed = fixed.replace(/(?<!\\)(sqrt)\s+(\d+)/g, '\\sqrt{$2}');
  // frac{...} → \frac{...}
  fixed = fixed.replace(/(?<!\\)(frac)\{([^}]+)\}/g, '\\frac{$2}');

  // 希腊字母和运算符（确保不匹配已带反斜杠的）
  if (!fixed.includes('\\Delta')) {
    fixed = fixed.replace(/(?<!\\)Delta(?![a-zA-Z])/g, '\\Delta');
  }
  if (!fixed.includes('\\times')) {
    fixed = fixed.replace(/(?<!\\)(?<= )times(?![a-zA-Z])/g, '\\times');
  }
  if (!fixed.includes('\\cdot')) {
    fixed = fixed.replace(/(?<!\\)(?<= )cdot(?![a-zA-Z])/g, '\\cdot');
  }

  return fixed;
}

async function fixQuestions() {
  console.log('开始修复AI生成题目的LaTeX问题...\n');

  const questions = await prisma.question.findMany({
    where: { isAI: true },
    select: { id: true, content: true }
  });

  console.log(`找到 ${questions.length} 条AI题目\n`);

  let fixedCount = 0;
  let errorCount = 0;

  for (const q of questions) {
    try {
      const parsed = JSON.parse(q.content);
      let changed = false;

      // 修复 question 字段
      if (parsed.question) {
        const newVal = fixLaTeX(parsed.question);
        if (newVal !== parsed.question) {
          parsed.question = newVal;
          changed = true;
        }
      }

      // 修复 options 字段
      if (parsed.options && Array.isArray(parsed.options)) {
        parsed.options = parsed.options.map((opt: string) => {
          const newOpt = fixLaTeX(opt);
          if (newOpt !== opt) {
            changed = true;
          }
          return newOpt;
        });
      }

      // 修复 explanation 字段
      if (parsed.explanation) {
        const newVal = fixLaTeX(parsed.explanation);
        if (newVal !== parsed.explanation) {
          parsed.explanation = newVal;
          changed = true;
        }
      }

      if (changed) {
        await prisma.question.update({
          where: { id: q.id },
          data: { content: JSON.stringify(parsed) }
        });
        fixedCount++;
        console.log(`✅ 修复: ${q.id.substring(0, 8)}...`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ 错误: ${q.id}`, error);
    }
  }

  console.log('\n========== 修复完成 ==========');
  console.log(`修复数量: ${fixedCount}`);
  console.log(`错误数量: ${errorCount}`);
  console.log(`总题数: ${questions.length}`);
}

fixQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
