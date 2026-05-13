/**
 * 重复知识点合并脚本
 *
 * 用途：合并重复的同名知识点
 * 1. 按名称分组知识点
 * 2. 保留有题目的版本
 * 3. 将其他版本的 inAssess 设为 false
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DuplicateGroup {
  name: string
  count: number
  ids: string[]
  hasQuestions: string[]
}

interface MergeResult {
  totalKnowledgePoints: number
  duplicateGroups: DuplicateGroup[]
  disabledCount: number
  keptCount: number
}

async function diagnoseDuplicates(): Promise<Map<string, DuplicateGroup>> {
  console.log('🔍 开始诊断重复知识点...\n')

  // 1. 获取所有知识点
  const allKps = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      inAssess: true,
    },
  })

  console.log(`📊 知识点总数: ${allKps.length}`)

  // 2. 按名称分组
  const nameGroups = new Map<string, typeof allKps>()
  for (const kp of allKps) {
    if (!nameGroups.has(kp.name)) {
      nameGroups.set(kp.name, [])
    }
    nameGroups.get(kp.name)!.push(kp)
  }

  // 3. 找出重复的组
  const duplicateGroups = new Map<string, DuplicateGroup>()

  for (const [name, kps] of nameGroups.entries()) {
    if (kps.length > 1) {
      // 获取每个知识点的题目数量
      const questions = await prisma.question.findMany({
        select: { knowledgePoints: true },
      })

      const kpQuestionCount = new Map<string, number>()
      for (const q of questions) {
        try {
          const kpIds = JSON.parse(q.knowledgePoints || '[]') as string[]
          kpIds.forEach((id) => {
            kpQuestionCount.set(id, (kpQuestionCount.get(id) || 0) + 1)
          })
        } catch {
          // 忽略
        }
      }

      // 找出有题目的知识点
      const hasQuestions = kps.filter((kp) => (kpQuestionCount.get(kp.id) || 0) > 0).map((kp) => kp.id)

      duplicateGroups.set(name, {
        name,
        count: kps.length,
        ids: kps.map((kp) => kp.id),
        hasQuestions,
      })
    }
  }

  return duplicateGroups
}

async function mergeDuplicates(): Promise<MergeResult> {
  const duplicateGroups = await diagnoseDuplicates()

  console.log(`\n⚠️  发现 ${duplicateGroups.size} 组重复知识点\n`)

  let disabledCount = 0
  let keptCount = 0

  for (const [name, group] of duplicateGroups.entries()) {
    console.log(`📌 "${name}": ${group.count} 个重复记录`)
    console.log(`   IDs: ${group.ids.join(', ')}`)
    console.log(`   有题目的: ${group.hasQuestions.length > 0 ? group.hasQuestions.join(', ') : '无'}`)

    // 确定要保留的 ID（有题目的优先，否则保留第一个）
    const keepId = group.hasQuestions[0] || group.ids[0]
    const disableIds = group.ids.filter((id) => id !== keepId)

    console.log(`   保留: ${keepId}`)

    // 禁用其他
    for (const id of disableIds) {
      await prisma.knowledgePoint.update({
        where: { id },
        data: {
          inAssess: false,
          deletedAt: new Date(),
          generationStatus: 'failed',
          generationError: 'Duplicate: merged into ' + keepId,
        },
      })
      disabledCount++
      console.log(`   ❌ 已禁用: ${id}`)
    }
    keptCount++
    console.log('')
  }

  const allKps = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })

  return {
    totalKnowledgePoints: allKps.length,
    duplicateGroups: Array.from(duplicateGroups.values()),
    disabledCount,
    keptCount,
  }
}

async function main() {
  try {
    const result = await mergeDuplicates()

    console.log('\n' + '='.repeat(50))
    console.log('📋 合并总结')
    console.log('='.repeat(50))
    console.log(`知识点总数: ${result.totalKnowledgePoints}`)
    console.log(`重复组数: ${result.duplicateGroups.length}`)
    console.log(`已禁用: ${result.disabledCount} 个`)
    console.log(`已保留: ${result.keptCount} 个`)
    console.log('='.repeat(50))

    // 保存结果
    const fs = require('fs')
    fs.writeFileSync('./duplicate-kp-report.json', JSON.stringify(result, null, 2))
    console.log('\n📄 报告已保存到: duplicate-kp-report.json')

  } catch (error) {
    console.error('❌ 合并失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

export { mergeDuplicates, diagnoseDuplicates }