#!/usr/bin/env tsx

import { ComplexityExtractor } from '../lib/qie/complexity-extractor';

const testQuestions = [
  {
    id: 'test-simple',
    content: { title: '简单计算', description: '计算 √16' },
    expectedRange: { cognitiveLoad: [0, 0.3], reasoningDepth: [0, 0.2], complexity: [0, 0.3] },
  },
  {
    id: 'test-medium',
    content: { title: '化简', description: '化简 √50' },
    expectedRange: { cognitiveLoad: [0.3, 0.5], reasoningDepth: [0.2, 0.4], complexity: [0.3, 0.5] },
  },
  {
    id: 'test-complex',
    content: { title: '混合运算', description: '计算 (√8 + √18) / √2' },
    expectedRange: { cognitiveLoad: [0.6, 0.9], reasoningDepth: [0.5, 0.9], complexity: [0.6, 0.9] },
  },
];

async function main() {
  console.log('=== ComplexityExtractor 集成测试 ===\n');

  const extractor = new ComplexityExtractor();

  for (const test of testQuestions) {
    console.log(`测试: ${test.id}`);
    console.log(`  题目: ${test.content.title}`);

    try {
      const result = await extractor.extract(test.id, test.content);

      console.log(`  结果:`);
      console.log(`    cognitiveLoad: ${result.features.cognitiveLoad}`);
      console.log(`    reasoningDepth: ${result.features.reasoningDepth}`);
      console.log(`    complexity: ${result.features.complexity}`);
      console.log(`    confidence: ${result.confidence}`);

      // Check ranges
      const clInRange = result.features.cognitiveLoad >= test.expectedRange.cognitiveLoad[0] &&
                       result.features.cognitiveLoad <= test.expectedRange.cognitiveLoad[1];
      const rdInRange = result.features.reasoningDepth >= test.expectedRange.reasoningDepth[0] &&
                       result.features.reasoningDepth <= test.expectedRange.reasoningDepth[1];
      const cxInRange = result.features.complexity >= test.expectedRange.complexity[0] &&
                       result.features.complexity <= test.expectedRange.complexity[1];

      if (clInRange && rdInRange && cxInRange) {
        console.log(`  ✅ 通过`);
      } else {
        console.log(`  ⚠️  超出预期范围`);
      }
    } catch (error) {
      console.log(`  ❌ 失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();
  }

  // Test batch
  console.log('=== 批量提取测试 ===');
  // Transform to match expected shape
  const items = testQuestions.map(({ id, content }) => ({ id, content }));
  const batchResults = await extractor.extractBatch(items);

  console.log(`批量处理: ${batchResults.size} 道题`);
  batchResults.forEach((result, id) => {
    console.log(`  ${id}: cognitiveLoad=${result.features.cognitiveLoad.toFixed(2)}`);
  });

  console.log('\n测试完成!');
}

main().catch(console.error);
