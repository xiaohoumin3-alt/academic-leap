/**
 * 知识点诊断脚本
 *
 * 用途：诊断数据库中知识点的问题
 * 1. 找出重复的同名知识点
 * 2. 找出 inAssess=true 但没有题目的知识点
 * 3. 统计每个知识点的关联题目数量
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DiagnosisResult {
  totalKnowledgePoints: number;
  inAssessTrueCount: number;
  duplicateGroups: Array<{
    name: string;
    count: number;
    ids: string[];
  }>;
  inAssessWithoutQuestions: Array<{
    id: string;
    name: string;
  }>;
  questionDistribution: Array<{
    knowledgePointId: string;
    knowledgePointName: string;
    questionCount: number;
  }>;
}

async function diagnose(): Promise<DiagnosisResult> {
  console.log('🔍 开始诊断知识点数据...\n');

  // 1. 获取所有知识点
  const allKnowledgePoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      inAssess: true,
      status: true,
    },
  });

  console.log(`📊 知识点总数: ${allKnowledgePoints.length}`);

  // 2. 统计 inAssess=true 的知识点
  const inAssessTrue = allKnowledgePoints.filter(kp => kp.inAssess);
  console.log(`✅ inAssess=true 的知识点: ${inAssessTrue.length}\n`);

  // 3. 找出重复知识点（按名称分组）
  console.log('🔍 查找重复知识点...');
  const nameGroups = new Map<string, typeof allKnowledgePoints>();
  for (const kp of allKnowledgePoints) {
    if (!nameGroups.has(kp.name)) {
      nameGroups.set(kp.name, []);
    }
    nameGroups.get(kp.name)!.push(kp);
  }

  const duplicateGroups: Array<{ name: string; count: number; ids: string[] }> = [];
  for (const [name, kps] of nameGroups.entries()) {
    if (kps.length > 1) {
      duplicateGroups.push({
        name,
        count: kps.length,
        ids: kps.map(kp => kp.id),
      });
      console.log(`  ⚠️  "${name}": ${kps.length} 个重复记录`);
    }
  }
  console.log(`\n发现 ${duplicateGroups.length} 组重复知识点\n`);

  // 4. 获取所有题目的知识点关联
  console.log('📝 分析题目关联...');
  const allQuestions = await prisma.question.findMany({
    select: {
      id: true,
      knowledgePoints: true,
    },
  });

  // 统计每个知识点的关联题目数
  const kpQuestionCount = new Map<string, number>();
  for (const q of allQuestions) {
    try {
      const kpList = JSON.parse(q.knowledgePoints) as string[];
      for (const kpId of kpList) {
        kpQuestionCount.set(kpId, (kpQuestionCount.get(kpId) || 0) + 1);
      }
    } catch (e) {
      // 忽略解析错误
    }
  }

  // 5. 找出 inAssess=true 但没有题目的知识点
  console.log('⚠️  查找 inAssess=true 但没有题目的知识点...');
  const inAssessWithoutQuestions: Array<{ id: string; name: string }> = [];
  for (const kp of inAssessTrue) {
    const count = kpQuestionCount.get(kp.id) || 0;
    if (count === 0) {
      inAssessWithoutQuestions.push({ id: kp.id, name: kp.name });
      console.log(`  - ${kp.name} (${kp.id})`);
    }
  }
  console.log(`\n共 ${inAssessWithoutQuestions.length} 个知识点没有题目\n`);

  // 6. 题目分布统计
  console.log('📊 题目分布统计 (Top 20):');
  const questionDistribution = Array.from(kpQuestionCount.entries())
    .map(([kpId, count]) => {
      const kp = allKnowledgePoints.find(k => k.id === kpId);
      return {
        knowledgePointId: kpId,
        knowledgePointName: kp?.name || 'Unknown',
        questionCount: count,
      };
    })
    .sort((a, b) => b.questionCount - a.questionCount)
    .slice(0, 20);

  for (const item of questionDistribution) {
    console.log(`  ${item.knowledgePointName}: ${item.questionCount} 题`);
  }

  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📋 诊断总结');
  console.log('='.repeat(50));
  console.log(`知识点总数: ${allKnowledgePoints.length}`);
  console.log(`inAssess=true: ${inAssessTrue.length}`);
  console.log(`重复知识点组数: ${duplicateGroups.length}`);
  console.log(`inAssess=true 但无题目: ${inAssessWithoutQuestions.length}`);
  console.log('='.repeat(50));

  return {
    totalKnowledgePoints: allKnowledgePoints.length,
    inAssessTrueCount: inAssessTrue.length,
    duplicateGroups,
    inAssessWithoutQuestions,
    questionDistribution,
  };
}

// 主函数
async function main() {
  try {
    const result = await diagnose();

    // 将结果保存到文件
    const fs = require('fs');
    const outputPath = './knowledge-points-diagnosis.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n✅ 诊断结果已保存到: ${outputPath}`);

  } catch (error) {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { diagnose, DiagnosisResult };
