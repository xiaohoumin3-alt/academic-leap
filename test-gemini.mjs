import { completion } from 'litellm';

const API_KEY = process.env.GEMINI_API_KEY;
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

const models = [
  'openai/gemma-4-31b-it',
  'gemini/gemini-pro',
  'gemini/gemini-1.5-flash',
  'gemini/gemini-2.0-flash-exp',
  'google/gemini-pro',
];

const testPrompt = [
  { role: 'system', content: '你是数学助手' },
  { role: 'user', content: '生成一道二次函数的简单题目，JSON格式返回' }
];

for (const model of models) {
  console.log(`\n=== 测试模型: ${model} ===`);
  try {
    const response = await completion({
      model,
      messages: testPrompt,
      apiKey: API_KEY,
      baseUrl: API_BASE,
      max_tokens: 100,
    });
    console.log('✓ 成功:', response.choices[0]?.message?.content?.substring(0, 100));
  } catch (e) {
    console.log('✗ 失败:', e.message);
  }
}
