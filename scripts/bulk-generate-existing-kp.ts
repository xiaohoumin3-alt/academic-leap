/**
 * 批量生成现有知识点的题目
 *
 * 用途：为所有 inAssess=true 且 generationStatus=pending 的知识点
 * 批量调度题目生成任务
 */

import { PrismaClient } from '@prisma/client'
import { questionGenerationService } from '@/lib/question-generation/service'

const prisma = new PrismaClient()

interface BulkGenerateOptions {
  mode?: 'core' | 'edge' | 'all'
  questionsPerLevel?: number
  dryRun?: boolean
}

interface BulkGenerateResult {
  totalKnowledgePoints: number
  eligibleCount: number
  scheduledCount: number
  skippedCount: number
  errors: string[]
}

async function bulkGenerate(options: BulkGenerateOptions = {}): Promise<BulkGenerateResult> {
  const mode = options.mode || 'all'
  const questionsPerLevel = options.questionsPerLevel || 10
  const dryRun = options.dryRun || false

  console.log('🚀 开始批量生成题目...')
  console.log(`   模式: ${mode}`)
  console.log(`   每等级题目数: ${questionsPerLevel}`)
  console.log(`   干跑模式: ${dryRun ? '是' : '否'}\n`)

  // 1. 获取符合条件的知识点
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: {
      inAssess: true,
      deletedAt: null,
      generationStatus: { in: ['pending', 'failed'] },
    },
    select: {
      id: true,
      name: true,
      generationStatus: true,
      generationProgress: true,
    },
  })

  console.log(`📊 符合条件的知识点: ${knowledgePoints.length} 个`)

  if (knowledgePoints.length === 0) {
    return {
      totalKnowledgePoints: await prisma.knowledgePoint.count({ where: { deletedAt: null } }),
      eligibleCount: 0,
      scheduledCount: 0,
      skippedCount: 0,
      errors: [],
    }
  }

  if (dryRun) {
    console.log('\n📋 干跑模式 - 将调度的知识点:')
    knowledgePoints.forEach((kp) => {
      const progress = kp.generationProgress as Record<string, number> | null
      const generated = progress ? Object.values(progress).reduce((sum, c) => sum + c, 0) : 0
      console.log(`   - ${kp.name} (${kp.id}) - 状态: ${kp.generationStatus}, 已生成: ${generated} 题`)
    })
    return {
      totalKnowledgePoints: await prisma.knowledgePoint.count({ where: { deletedAt: null } }),
      eligibleCount: knowledgePoints.length,
      scheduledCount: 0,
      skippedCount: 0,
      errors: [],
    }
  }

  // 2. 批量调度
  let scheduledCount = 0
  let skippedCount = 0
  const errors: string[] = []

  // 使用 service 调度
  const kpIds = knowledgePoints.map((kp) => kp.id)

  try {
    const result = await questionGenerationService.scheduleAll({
      mode,
      knowledgePointIds: kpIds,
      questionsPerLevel,
    })

    scheduledCount = result.scheduled
    skippedCount = result.skipped

    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((e) => errors.push(`[${e.knowledgePointId}] ${e.error}`))
    }

    console.log(`\n✅ 调度完成:`)
    console.log(`   成功调度: ${scheduledCount} 个`)
    console.log(`   跳过: ${skippedCount} 个`)
    console.log(`   预计生成题目: ${result.totalQuestions} 题`)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(errorMsg)
    console.error(`\n❌ 调度失败: ${errorMsg}`)
  }

  return {
    totalKnowledgePoints: await prisma.knowledgePoint.count({ where: { deletedAt: null } }),
    eligibleCount: knowledgePoints.length,
    scheduledCount,
    skippedCount,
    errors,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const options: BulkGenerateOptions = {}

  // 解析参数
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode':
        options.mode = args[++i] as 'core' | 'edge' | 'all'
        break
      case '--count':
        options.questionsPerLevel = parseInt(args[++i], 10)
        break
      case '--dry-run':
        options.dryRun = true
        break
    }
  }

  try {
    const result = await bulkGenerate(options)

    console.log('\n' + '='.repeat(50))
    console.log('📋 批量生成总结')
    console.log('='.repeat(50))
    console.log(`知识点总数: ${result.totalKnowledgePoints}`)
    console.log(`符合条件: ${result.eligibleCount} 个`)
    console.log(`成功调度: ${result.scheduledCount} 个`)
    console.log(`跳过: ${result.skippedCount} 个`)
    if (result.errors.length > 0) {
      console.log(`错误: ${result.errors.length} 个`)
      result.errors.forEach((e) => console.log(`   - ${e}`))
    }
    console.log('='.repeat(50))

    // 保存结果
    const fs = require('fs')
    fs.writeFileSync('./bulk-generate-report.json', JSON.stringify(result, null, 2))
    console.log('\n📄 报告已保存到: bulk-generate-report.json')

  } catch (error) {
    console.error('❌ 批量生成失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { bulkGenerate, BulkGenerateOptions, BulkGenerateResult }