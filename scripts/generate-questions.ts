#!/usr/bin/env tsx
/**
 * 批量生成题目脚本
 *
 * 运行: npx tsx scripts/generate-questions.ts
 */

import { QuestionGenerator, GeneratedQuestionResult } from '../lib/qie/generator/generator';
import { ComplexitySpec } from '../lib/qie/generator/types';

const CONFIG = {
  structures: ['linear', 'nested', 'multi_equation', 'constraint_chain'] as const,
  depths: [1, 2, 3, 4] as const,
  distractions: [0, 1, 2, 3] as const,
  samplesPerSpec: 3,
};

function generateAllSpecs(): ComplexitySpec[] {
  const specs: ComplexitySpec[] = [];

  for (const structure of CONFIG.structures) {
    for (const depth of CONFIG.depths) {
      for (const distraction of CONFIG.distractions) {
        specs.push({ structure, depth, distraction });
      }
    }
  }

  return specs;
}

async function main() {
  console.log('🔧 Question Generator - 批量生成\n');

  const generator = new QuestionGenerator();
  const specs = generateAllSpecs();

  console.log(`📋 生成 ${specs.length} 个复杂度组合`);
  console.log(`📦 每个组合生成 ${CONFIG.samplesPerSpec} 道题`);
  console.log(`📊 总计: ${specs.length * CONFIG.samplesPerSpec} 道题\n`);

  const batchId = `batch_${Date.now()}`;

  let successCount = 0;
  let failCount = 0;
  const results: GeneratedQuestionResult[] = [];

  for (let specIndex = 0; specIndex < specs.length; specIndex++) {
    const spec = specs[specIndex];

    for (let i = 0; i < CONFIG.samplesPerSpec; i++) {
      try {
        const result = await generator.generateAndSave(spec, batchId);
        results.push(result);
        successCount++;
      } catch (error) {
        console.error(`❌ 生成失败: ${JSON.stringify(spec)}`, error);
        failCount++;
      }
    }

    if ((specIndex + 1) % 10 === 0) {
      console.log(`   进度: ${specIndex + 1}/${specs.length} 组完成`);
    }
  }

  console.log(`\n✅ 生成完成!`);
  console.log(`   成功: ${successCount}`);
  console.log(`   失败: ${failCount}`);
  console.log(`   批次 ID: ${batchId}`);

  // 输出到数据库的统计
  const { prisma } = await import('@/lib/prisma');
  const total = await prisma.generatedQuestion.count({
    where: { batchId },
  });
  console.log(`   数据库记录: ${total}`);
}

main().catch(console.error);
