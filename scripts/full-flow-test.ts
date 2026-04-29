#!/usr/bin/env tsx
/**
 * 完整流程测试: 生成 → 验证 → 晋升
 * 测试完整的 pipeline: QuestionGenerator → GeneratedQuestion → Question
 */

import { QuestionGenerator } from '../lib/qie/generator';
import { PromotionPipeline } from '../lib/qie/promotion';
import { ComplexitySpec } from '../lib/qie/generator/types';

async function main() {
  console.log('=== 完整流程测试: 生成 → 验证 → 晋升 ===\n');

  const generator = new QuestionGenerator();
  const pipeline = new PromotionPipeline();

  // 测试用例: 基础 linear 题目
  const spec: ComplexitySpec = {
    structure: 'linear',
    depth: 1,
    distraction: 0,
  };

  // 1. 生成题目
  console.log('1️⃣  生成题目...');
  try {
    const result = await generator.generateAndSave(spec, 'test_full_flow');

    if (!result.id) {
      console.error('   ❌ 生成失败: 没有返回 ID');
      process.exit(1);
    }

    console.log(`   ✅ 生成成功: GeneratedQuestion ID = ${result.id}`);
    console.log(`   - 类型: ${result.type}`);
    console.log(`   - 内容: ${result.content.substring(0, 80)}...`);
    console.log(`   - 答案: ${result.answer}`);
    console.log(`   - 复杂度: ${result.complexitySpec}`);
    console.log(`   - 引擎: ${result.engine}`);
    console.log(`   - 状态: ${result.promotionStatus}`);

    // 2. 晋升到 Question 表
    console.log('\n2️⃣  晋升到 Question 表...');
    const promotionResult = await pipeline.promoteToQuestion(result.id);

    if (!promotionResult.success) {
      console.error(`   ❌ 晋升失败: ${promotionResult.error}`);
      process.exit(1);
    }

    console.log(`   ✅ 晋升成功: Question ID = ${promotionResult.questionId}`);

    // 3. 验证结果
    console.log('\n3️⃣  验证结果...');

    // 动态导入 prisma 以验证数据
    const { prisma } = await import('@/lib/prisma');

    const generated = await prisma.generatedQuestion.findUnique({
      where: { id: result.id },
    });

    if (!generated) {
      console.error('   ❌ 验证失败: GeneratedQuestion 不存在');
      process.exit(1);
    }

    if (generated.promotionStatus !== 'PASSED') {
      console.error(`   ❌ 验证失败: 状态不是 PASSED，而是 ${generated.promotionStatus}`);
      process.exit(1);
    }

    const question = await prisma.question.findUnique({
      where: { id: promotionResult.questionId! },
    });

    if (!question) {
      console.error('   ❌ 验证失败: Question 不存在');
      process.exit(1);
    }

    if (question.generatedFrom !== result.id) {
      console.error('   ❌ 验证失败: Question.generatedFrom 不匹配');
      process.exit(1);
    }

    console.log('   ✅ GeneratedQuestion 状态正确: PASSED');
    console.log('   ✅ Question 记录创建成功');
    console.log('   ✅ generatedFrom 关联正确');

    // 清理测试数据
    console.log('\n4️⃣  清理测试数据...');
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.generatedQuestion.delete({ where: { id: result.id } });
    console.log('   ✅ 清理完成');

    console.log('\n========================================');
    console.log('✅ 完整流程测试通过!');
    console.log('========================================');
    console.log('\n总结:');
    console.log(`  - GeneratedQuestion ID: ${result.id}`);
    console.log(`  - Question ID: ${promotionResult.questionId}`);
    console.log(`  - 流程: generateAndSave → promoteToQuestion`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main();