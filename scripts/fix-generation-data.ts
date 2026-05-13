#!/usr/bin/env tsx
/**
 * 修复题目生成数据不一致问题
 * - 重建 generationProgress（基于 Question 表实际数据）
 * - 根据实际题目数量更新 generationStatus
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== 开始修复题目生成数据 ===\n')

  // 获取所有 inAssess 的知识点
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: {
      inAssess: true,
      deletedAt: null,
    },
  })

  console.log(`共 ${knowledgePoints.length} 个知识点\n`)

  let fixed = 0
  let completed = 0
  let failed = 0

  for (const kp of knowledgePoints) {
    // 统计该知识点实际题目数（按难度分组）
    const questions = await prisma.question.groupBy({
      by: ['difficulty'],
      where: {
        generatedFrom: kp.id,
      },
      _count: { id: true },
    })

    // 构建新的 generationProgress
    const newProgress: Record<string, number> = {}
    let totalActual = 0

    for (let level = 1; level <= 12; level++) {
      const found = questions.find(q => q.difficulty === level)
      const count = found?._count.id ?? 0
      newProgress[String(level)] = count
      totalActual += count
    }

    // 计算进度总和（各难度题目数之和）
    const progressSum = Object.values(newProgress).reduce((sum, count) => sum + count, 0)

    // 判断生成状态
    // completed: 至少有一些题目（>0）
    // pending: 没有题目但之前是 pending
    // failed: 没有题目但之前是 completed（说明之前的数据是假的）
    let newStatus = kp.generationStatus
    let hasChange = false

    if (kp.generationStatus === 'completed' && totalActual === 0) {
      // 之前标记完成但实际没题目，说明数据是假的
      newStatus = 'pending'
      hasChange = true
    } else if (kp.generationStatus === 'in_progress' && progressSum === 0) {
      newStatus = 'failed'
      hasChange = true
    } else if (totalActual > 0 && kp.generationStatus !== 'completed') {
      // 有题目但不是completed，可能是之前的in_progress/failed
      newStatus = 'completed'
      hasChange = true
    }

    const oldProgressSum = Object.values(kp.generationProgress as Record<string, number> || {}).reduce((sum, count) => sum + count, 0)

    if (totalActual !== oldProgressSum || hasChange) {
      console.log(`📌 ${kp.name}`)
      console.log(`   之前: ${kp.generationStatus}, 进度=${oldProgressSum}`)
      console.log(`   现在: ${newStatus}, 进度=${totalActual}`)

      // 如果状态是 completed，必须清除 generationError
      const shouldClearError = newStatus === 'completed'

      await prisma.knowledgePoint.update({
        where: { id: kp.id },
        data: {
          generationStatus: newStatus,
          generationProgress: newProgress as any,
          generationError: shouldClearError ? null : (kp.generationError || null),
        },
      })

      fixed++
      if (newStatus === 'completed') completed++
      if (newStatus === 'failed') failed++
    }
  }

  console.log(`\n=== 修复完成 ===`)
  console.log(`共修复 ${fixed} 个知识点`)
  console.log(`其中 completed: ${completed}, failed: ${failed}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())