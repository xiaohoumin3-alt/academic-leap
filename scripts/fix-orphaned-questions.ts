/**
 * 孤儿题目修复脚本
 *
 * 用途：修复"题目引用的知识点不存在"的问题
 * 1. 找出所有题目引用的知识点 ID
 * 2. 找出不存在于 KnowledgePoint 表的 ID
 * 3. 创建占位知识点（inAssess=false，标记为"待清理"）
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface OrphanResult {
  totalQuestions: number
  orphansFound: string[]
  fixedCount: number
  skippedCount: number
}

async function fixOrphanedQuestions(): Promise<OrphanResult> {
  console.log('🔧 开始修复孤儿题目...\n')

  // 1. 获取所有题目
  const questions = await prisma.question.findMany({
    select: { id: true, knowledgePoints: true },
  })

  console.log(`📝 总题数: ${questions.length}`)

  // 2. 收集所有引用的知识点 ID
  const referencedKpIds = new Set<string>()
  for (const q of questions) {
    try {
      const kpIds = JSON.parse(q.knowledgePoints || '[]') as string[]
      kpIds.forEach((id) => referencedKpIds.add(id))
    } catch {
      // 忽略解析错误
    }
  }

  console.log(`📊 引用知识点数: ${referencedKpIds.size}`)

  // 3. 获取存在的知识点 ID
  const existingKpIds = new Set<string>()
  const existingKps = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })
  existingKps.forEach((kp) => existingKpIds.add(kp.id))

  // 4. 找出孤儿知识点 ID
  const orphanIds: string[] = []
  referencedKpIds.forEach((id) => {
    if (!existingKpIds.has(id)) {
      orphanIds.push(id)
    }
  })

  console.log(`⚠️  孤儿知识点数: ${orphanIds.length}`)

  if (orphanIds.length === 0) {
    console.log('✅ 没有发现孤儿知识点')
    return { totalQuestions: questions.length, orphansFound: [], fixedCount: 0, skippedCount: 0 }
  }

  // 5. 输出孤儿 ID（供诊断用）
  console.log('\n发现以下孤儿知识点 ID:')
  orphanIds.forEach((id) => console.log(`  - ${id}`))

  // 6. 创建占位知识点（可选：启用此段代码来创建占位知识点）
  // let fixedCount = 0
  // for (const orphanId of orphanIds) {
  //   try {
  //     await prisma.knowledgePoint.create({
  //       data: {
  //         id: orphanId, // 保持原有 ID
  //         chapterId: 'PLACEHOLDER', // 需要替换为实际 chapterId
  //         conceptId: 'PLACEHOLDER', // 需要替换为实际 conceptId
  //         name: `孤儿知识点-${orphanId.slice(0, 8)}`,
  //         inAssess: false,
  //         status: 'orphaned',
  //         generationStatus: 'failed',
  //       },
  //     })
  //     fixedCount++
  //     console.log(`  ✅ 已创建占位知识点: ${orphanId}`)
  //   } catch (error) {
  //     console.log(`  ❌ 创建失败: ${orphanId}`, error)
  //   }
  // }

  // 7. 清理引用这些孤儿知识点的题目（可选）
  // let fixedCount = 0
  // for (const q of questions) {
  //   try {
  //     const kpIds = JSON.parse(q.knowledgePoints || '[]') as string[]
  //     const hasOrphan = kpIds.some(id => orphanIds.includes(id))
  //     if (hasOrphan) {
  //       const cleanKpIds = kpIds.filter(id => !orphanIds.includes(id))
  //       await prisma.question.update({
  //         where: { id: q.id },
  //         data: { knowledgePoints: JSON.stringify(cleanKpIds) },
  //       })
  //       fixedCount++
  //     }
  //   } catch (error) {
  //     console.error(`清理题目失败: ${q.id}`, error)
  //   }
  // }

  return {
    totalQuestions: questions.length,
    orphansFound: orphanIds,
    fixedCount: 0,
    skippedCount: orphanIds.length,
  }
}

async function main() {
  try {
    const result = await fixOrphanedQuestions()

    console.log('\n' + '='.repeat(50))
    console.log('📋 修复总结')
    console.log('='.repeat(50))
    console.log(`总题数: ${result.totalQuestions}`)
    console.log(`孤儿知识点: ${result.orphansFound.length} 个`)
    console.log(`已修复: ${result.fixedCount} 个`)
    console.log(`跳过: ${result.skippedCount} 个`)
    console.log('='.repeat(50))

    // 保存结果
    const fs = require('fs')
    fs.writeFileSync('./orphan-questions-report.json', JSON.stringify(result, null, 2))
    console.log('\n📄 报告已保存到: orphan-questions-report.json')

  } catch (error) {
    console.error('❌ 修复失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { fixOrphanedQuestions }