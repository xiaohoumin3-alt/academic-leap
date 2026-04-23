import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('GEMINI_API_KEY not set');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const models = [
  'gemini-pro',
  'gemini-1.5-flash',
  'gemini-2.0-flash-exp',
];

for (const modelName of models) {
  console.log(`\n=== 测试模型: ${modelName} ===`);
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('生成一道二次函数的简单题目');
    console.log('✓ 成功:', result.response.text().substring(0, 100));
  } catch (e) {
    console.log('✗ 失败:', e.message);
  }
}
