#!/usr/bin/env tsx

/**
 * Test improved prompt for MiniMax LLM complexity extraction
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL,
});

const IMPROVED_FEW_SHOT = `
你是一个数学教育专家，分析数学题目的认知特征。

**特征评分标准（严格执行）：**

1. cognitiveLoad [0-1]：工作记忆占用程度
   - 0.0-0.2: 直接回忆/单步计算
   - 0.3-0.5: 需要2-3步操作，中等记忆负荷
   - 0.6-0.8: 多步骤规划，高记忆负荷
   - 0.9-1.0: 复杂构造/证明，极高负荷

2. reasoningDepth [0-1]：逻辑推理层次数
   - 0.0-0.2: 无推理或单层直接推理
   - 0.3-0.5: 单一公式应用，1-2层推理
   - 0.6-0.8: 多概念综合，2-3层推理链
   - 0.9-1.0: 构造性证明/抽象推理，3+层

3. complexity [0-1]：综合复杂度 = 0.5×cognitiveLoad + 0.5×reasoningDepth

**关键词权重（重要）：**
- "化简"、"分解" → cognitiveLoad ≥ 0.4（需要多步骤分解）
- "证明"、"求证" → reasoningDepth ≥ 0.8（高阶推理）
- "顶点"、"最值" → cognitiveLoad ≥ 0.5（公式变形+计算）
- "应用"、"建模" → complexity ≥ 0.7（实际问题抽象）

**示例（学习参考）：**

示例 1 - 简单计算:
题目: {"title":"计算二次根式","description":"计算 √16 的值"}
分析: 直接回忆特殊值，无需推理
特征: {"cognitiveLoad":0.1,"reasoningDepth":0.0,"complexity":0.05}

示例 2 - 公式应用:
题目: {"title":"二次根式乘法","description":"计算 √3 × √12"}
分析: 应用√a×√b=√ab公式，单层推理
特征: {"cognitiveLoad":0.2,"reasoningDepth":0.1,"complexity":0.15}

示例 3 - 化简操作:
题目: {"title":"二次根式化简","description":"化简 √50"}
分析: 需要分解质因数(50=25×2)、提取根号、合并系数，3步操作
特征: {"cognitiveLoad":0.45,"reasoningDepth":0.3,"complexity":0.375}

示例 4 - 顶点计算:
题目: {"title":"求二次函数顶点","description":"求抛物线 y=x²-4x+3 的顶点坐标"}
分析: 需要配方法或顶点公式，涉及系数识别、符号处理、两步计算
特征: {"cognitiveLoad":0.55,"reasoningDepth":0.5,"complexity":0.525}

示例 5 - 证明题:
题目: {"title":"二次函数性质证明","description":"证明：对于任意实数x，二次函数 y=(x-1)²+2 的最小值为2"}
分析: 需要理解完全平方式的非负性，进行逻辑推导，构造性证明
特征: {"cognitiveLoad":0.7,"reasoningDepth":0.85,"complexity":0.775}

示例 6 - 综合应用:
题目: {"title":"实际问题建模","description":"某商品利润满足函数 L=-10x²+200x-800，求最大利润及对应价格"}
分析: 实际问题抽象→数学模型→顶点公式应用→结果解释，4步推理链
特征: {"cognitiveLoad":0.8,"reasoningDepth":0.7,"complexity":0.75}

---

分析以下题目：
`;

interface TestCase {
  name: string;
  question: any;
  expected: { cognitiveLoad: number; reasoningDepth: number; complexity: number };
}

const testCases: TestCase[] = [
  {
    name: "化简二次根式",
    question: { title: "化简二次根式", description: "化简 √50" },
    expected: { cognitiveLoad: 0.4, reasoningDepth: 0.3, complexity: 0.35 },
  },
  {
    name: "证明题",
    question: { title: "二次函数证明", description: "证明：抛物线 y=ax²+bx+c 当a>0时有最小值" },
    expected: { cognitiveLoad: 0.7, reasoningDepth: 0.85, complexity: 0.775 },
  },
  {
    name: "顶点坐标",
    question: { title: "求顶点坐标", description: "求抛物线 y = x² - 4x + 3 的顶点坐标" },
    expected: { cognitiveLoad: 0.55, reasoningDepth: 0.5, complexity: 0.525 },
  },
  {
    name: "简单计算",
    question: { title: "计算", description: "计算 √25" },
    expected: { cognitiveLoad: 0.1, reasoningDepth: 0.0, complexity: 0.05 },
  },
];

function parseResponse(response: any): any {
  // MiniMax returns response.content with blocks
  let text = '';

  if (typeof response === 'string') {
    text = response;
  } else if (Array.isArray(response.content)) {
    // Find text block (skip thinking)
    const textBlock = response.content.find((b: any) => b.type === 'text');
    text = textBlock?.text || JSON.stringify(response);
  } else if (response.content) {
    text = String(response.content);
  } else {
    text = JSON.stringify(response);
  }

  // Extract JSON from text
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON found in: ' + text.substring(0, 200));
  }

  return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
}

function calculateError(actual: number, expected: number): number {
  return Math.abs(actual - expected);
}

function isWithinThreshold(actual: number, expected: number, threshold = 0.15): boolean {
  return calculateError(actual, expected) <= threshold;
}

async function testOneCase(testCase: TestCase): Promise<void> {
  const prompt = IMPROVED_FEW_SHOT + JSON.stringify(testCase.question) + `

严格按JSON格式输出，不要Markdown或解释：
{"reasoning":"分析","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}`;

  console.log(`\n📝 测试: ${testCase.name}`);
  console.log(`   题目: ${testCase.question.description}`);

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const result = parseResponse(response);
  const features = result.features || {};

  console.log(`   预期: cognitiveLoad=${testCase.expected.cognitiveLoad}, reasoningDepth=${testCase.expected.reasoningDepth}, complexity=${testCase.expected.complexity}`);
  console.log(`   实际: cognitiveLoad=${features.cognitiveLoad}, reasoningDepth=${features.reasoningDepth}, complexity=${features.complexity}`);

  const errors = {
    cognitiveLoad: calculateError(features.cognitiveLoad, testCase.expected.cognitiveLoad),
    reasoningDepth: calculateError(features.reasoningDepth, testCase.expected.reasoningDepth),
    complexity: calculateError(features.complexity, testCase.expected.complexity),
  };

  const passed = {
    cognitiveLoad: isWithinThreshold(features.cognitiveLoad, testCase.expected.cognitiveLoad),
    reasoningDepth: isWithinThreshold(features.reasoningDepth, testCase.expected.reasoningDepth),
    complexity: isWithinThreshold(features.complexity, testCase.expected.complexity),
  };

  console.log(`   误差: cognitiveLoad=${errors.cognitiveLoad.toFixed(2)}, reasoningDepth=${errors.reasoningDepth.toFixed(2)}, complexity=${errors.complexity.toFixed(2)}`);

  const status = passed.cognitiveLoad && passed.reasoningDepth && passed.complexity ? '✅ PASS' : '❌ FAIL';
  console.log(`   ${status}`);

  return { passed, errors };
}

async function main() {
  console.log('=== 改进 Prompt 测试 ===\n');

  const results = [];
  for (const testCase of testCases) {
    const result = await testOneCase(testCase);
    results.push({ ...testCase, result });
  }

  console.log('\n=== 汇总 ===');
  const passCount = results.filter(r => r.result.passed.cognitiveLoad && r.result.passed.reasoningDepth && r.result.passed.complexity).length;
  console.log(`通过: ${passCount}/${results.length}`);

  const avgErrors = {
    cognitiveLoad: results.reduce((sum, r) => sum + r.result.errors.cognitiveLoad, 0) / results.length,
    reasoningDepth: results.reduce((sum, r) => sum + r.result.errors.reasoningDepth, 0) / results.length,
    complexity: results.reduce((sum, r) => sum + r.result.errors.complexity, 0) / results.length,
  };

  console.log(`平均误差: cognitiveLoad=${avgErrors.cognitiveLoad.toFixed(3)}, reasoningDepth=${avgErrors.reasoningDepth.toFixed(3)}, complexity=${avgErrors.complexity.toFixed(3)}`);

  if (avgErrors.complexity < 0.15) {
    console.log('\n✅ 准确率达标 (>80%)，可以继续实现');
  } else {
    console.log('\n⚠️ 准确率未达标，需要进一步调整 prompt');
  }
}

main().catch(console.error);
