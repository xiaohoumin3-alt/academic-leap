/**
 * 修复数据库中现有题目的 LaTeX 转义问题
 *
 * 问题：数据库中存储的题目内容包含错误的 \\$（两个反斜杠+美元）
 * 经过 JSON.parse 后变成 \$（一个反斜杠+美元）
 * 这导致 MathRenderer 无法正确识别公式定界符
 *
 * 修复：将 JSON 中解析后会变成 \$ 的 \\$ 替换为 $（正确的公式定界符）
 *
 * 使用方法：npx tsx scripts/fix-existing-latex.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 修复 JSON 字符串中的 LaTeX 转义字符
 * 与 minimax.ts 中的 fixLaTeXEscapes 保持一致
 */
function fixLaTeXEscapes(jsonString: string): string {
  let fixed = jsonString
  // 匹配 JSON 中错误的 \\$（两个反斜杠+美元）
  // 与 minimax.ts 中的 fixLaTeXEscapes 保持一致
  fixed = fixed.replace(/\\\\\\\\\\$/g, '$')
  return fixed
}

async function fixExistingLatex() {
  console.log('=== 修复现有题目的 LaTeX 转义问题 ===\n')

  // 查找所有 AI 生成的题目
  const questions = await prisma.question.findMany({
    where: {
      isAI: true,
    },
    select: { id: true, content: true, type: true },
  })

  console.log(`共有 ${questions.length} 个 AI 生成题目\n`)

  let fixedCount = 0
  let errorCount = 0
  let alreadyFixed = 0

  for (const q of questions) {
    try {
      // 应用修复
      const fixedContent = fixLaTeXEscapes(q.content)

      // 检查是否有变化
      if (fixedContent === q.content) {
        alreadyFixed++
        continue
      }

      // 更新数据库
      await prisma.question.update({
        where: { id: q.id },
        data: { content: fixedContent },
      })

      fixedCount++
      console.log(`修复成功: ${q.id} (${q.type})`)
    } catch (e) {
      errorCount++
      console.error(`修复失败: ${q.id} - ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\n=== 修复完成 ===`)
  console.log(`新增修复: ${fixedCount}`)
  console.log(`已正常: ${alreadyFixed}`)
  console.log(`失败: ${errorCount}`)
}

fixExistingLatex()
  .then(() => {
    console.log('\n脚本执行完成')
    process.exit(0)
  })
  .catch((e) => {
    console.error('脚本执行失败:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })