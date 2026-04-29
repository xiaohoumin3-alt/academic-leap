#!/usr/bin/env tsx

/**
 * Debug the batch that fails to parse
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL,
});

// Simulate a batch with the problematic question
const batch = [
  { id: 'q1', title: '求二次函数顶点坐标', description: '求抛物线的顶点坐标', context: 'y = x² - 4x + 3' },
  { id: 'q2', title: '化简二次根式', description: '化简 √50' },
];

const batchPrompt = `你是一个数学教育专家。一次性评估以下2道题目的复杂度。

**特征评分标准：**
1. cognitiveLoad [0-1]：工作记忆占用
2. reasoningDepth [0-1]：推理层次
3. complexity [0-1]：综合复杂度

**关键词提示：**
- "化简" → cognitiveLoad ≥ 0.4
- "证明" → reasoningDepth ≥ 0.8
- "顶点" → cognitiveLoad ≥ 0.5
- "应用" → complexity ≥ 0.7

题目列表：
${JSON.stringify(batch)}

严格按JSON数组输出：
[
  {"id":"...","reasoning":"...","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}
]`;

async function debug() {
  console.log('Sending batch request...\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: batchPrompt }],
  });

  console.log('=== Response ===');
  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock || !('text' in textBlock)) {
    console.log('ERROR: No text block');
    return;
  }

  const text = textBlock.text as string;
  console.log('Raw text:');
  console.log(text);
  console.log('\n=== Parsing ===');

  // Try to parse
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  console.log('Cleaned text length:', cleaned.length);

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    console.log('ERROR: No JSON array found!');
    console.log('First 500 chars:', cleaned.substring(0, 500));
    return;
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    console.log('SUCCESS: Parsed', parsed.length, 'items');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (error: unknown) {
    console.log('ERROR: JSON parse failed');
    console.log('Matched array (first 500 chars):', arrayMatch[0].substring(0, 500));
  }
}

debug().catch(console.error);
