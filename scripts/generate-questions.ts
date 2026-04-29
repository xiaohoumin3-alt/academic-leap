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
  samplesPerSpec: 12, // 48 specs × 12 = 576, 调整以匹配目标数量
  targetTotal: 192, // 目标生成题目数量
};

/**
 * DISTRACTION 分布概率 (对齐 real_exam 真实分布)
 * - 0: 77% (无干扰)
 * - 1: 13% (轻微冗余信息)
 * - 2: 8% (误导性提示)
 * - 3: 2% (计算陷阱)
 */
function sampleDistraction(): 0 | 1 | 2 | 3 {
  const rand = Math.random();
  if (rand < 0.77) return 0;
  if (rand < 0.90) return 1; // 0.77 + 0.13 = 0.90
  if (rand < 0.98) return 2; // 0.90 + 0.08 = 0.98
  return 3;
}

/**
 * 生成所有 (structure, depth) 组合，distraction 使用加权随机
 */
function generateAllSpecs(count: number): ComplexitySpec[] {
  const specs: ComplexitySpec[] = [];

  // 首先生成所有 (structure, depth) 基础组合
  const baseCombinations: Array<{ structure: typeof CONFIG.structures[number]; depth: typeof CONFIG.depths[number] }> = [];
  for (const structure of CONFIG.structures) {
    for (const depth of CONFIG.depths) {
      baseCombinations.push({ structure, depth });
    }
  }

  // 为每个基础组合分配 spec，使用加权随机 distraction
  const specsPerBase = Math.ceil(count / baseCombinations.length);

  for (const { structure, depth } of baseCombinations) {
    for (let i = 0; i < specsPerBase && specs.length < count; i++) {
      specs.push({ structure, depth, distraction: sampleDistraction() });
    }
  }

  return specs;
}

async function main() {
  console.log('🔧 Question Generator - 批量生成 (DISTRACTION 对齐真实分布)\n');

  const generator = new QuestionGenerator();
  const specs = generateAllSpecs(CONFIG.targetTotal);

  // 统计 DISTRACTION 分布
  const distractionCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const spec of specs) {
    distractionCounts[spec.distraction]++;
  }

  console.log(`📋 生成 ${specs.length} 个复杂度规格`);
  console.log(`📊 DISTRACTION 分布:`);
  console.log(`   0 (无干扰): ${distractionCounts[0]} (${(distractionCounts[0] / specs.length * 100).toFixed(1)}%)`);
  console.log(`   1 (冗余信息): ${distractionCounts[1]} (${(distractionCounts[1] / specs.length * 100).toFixed(1)}%)`);
  console.log(`   2 (误导提示): ${distractionCounts[2]} (${(distractionCounts[2] / specs.length * 100).toFixed(1)}%)`);
  console.log(`   3 (计算陷阱): ${distractionCounts[3]} (${(distractionCounts[3] / specs.length * 100).toFixed(1)}%)`);
  console.log();

  const batchId = `batch_${Date.now()}`;

  let successCount = 0;
  let failCount = 0;
  const results: GeneratedQuestionResult[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];

    try {
      const result = await generator.generateAndSave(spec, batchId);
      results.push(result);
      successCount++;
    } catch (error) {
      console.error(`❌ 生成失败: ${JSON.stringify(spec)}`, error);
      failCount++;
    }

    if ((i + 1) % 20 === 0) {
      console.log(`   进度: ${i + 1}/${specs.length} 题完成`);
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
