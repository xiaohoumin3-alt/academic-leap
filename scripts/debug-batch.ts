#!/usr/bin/env tsx

/**
 * Debug batch response parsing
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.MINIMAX_API_KEY,
  baseURL: process.env.MINIMAX_BASE_URL,
});

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
[
  {"id":"q1","title":"化简","description":"化简 √50"},
  {"id":"q2","title":"计算","description":"计算 √25"}
]

严格按JSON数组输出：
[
  {"id":"...","reasoning":"...","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}
]`;

async function debug() {
  console.log('Sending request to MiniMax...\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: batchPrompt }],
  });

  console.log('=== Response Structure ===');
  console.log('Content blocks:', response.content.length);

  for (let i = 0; i < response.content.length; i++) {
    const block = response.content[i] as any;
    console.log(`Block ${i}: type=${block.type}`);
    if (block.type === 'text' && block.text) {
      console.log('Text length:', block.text.length);
      console.log('Text preview:', block.text.substring(0, 500));
    } else if (block.type === 'thinking' && block.thinking) {
      console.log('Thinking length:', block.thinking.length);
    }
  }

  // Extract text block
  const textBlock = response.content.find((b: any) => b.type === 'text');
  if (!textBlock || !('text' in textBlock)) {
    console.log('ERROR: No text block found!');
    return;
  }

  const text = textBlock.text as string;
  console.log('\n=== Extracted Text ===');
  console.log(text);

  // Try to parse
  console.log('\n=== Parsing ===');
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    console.log('ERROR: No JSON array found!');
    console.log('Cleaned text:', cleaned.substring(0, 500));
    return;
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    console.log('SUCCESS: Parsed', parsed.length, 'items');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (error: unknown) {
    console.log('ERROR: JSON parse failed');
    console.log('Matched array:', arrayMatch[0].substring(0, 500));
  }
}

debug().catch(console.error);
