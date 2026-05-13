/**
 * DeepTutor Prompts 验证脚本
 *
 * 使用原生 fetch 调用 MiniMax API
 */

import dotenv from 'dotenv';
import path from 'path';

// 加载 .env 文件
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ==================== PROMPTS ====================

const IDEA_AGENT_SYSTEM = `你是考试题目设计流程中的 Idea Agent。
你的职责是基于知识内容提出多样、有效、可执行的出题方向。`;

const IDEA_AGENT_PROMPT = `主题：
{topic}

用户偏好：
{preference}

知识依据：
{knowledge_context}

前几批已经使用过的考察点：
{existing_concentrations}

请生成恰好 {num_ideas} 个候选出题创意。
重点关注：多样性、相关性、与用户偏好的一致性，并尽量避免与已有考察点重复。

重要 — question_type 只允许以下三个值之一：
  - "choice"  （选择题，4 选 1）
  - "written" （简答 / 论述题，不带选项）
  - "calculation" （计算题，不带选项）

不要使用其他类型（如 visual、diagram、matching 等）。

仅返回 JSON，格式如下：
{
  "ideas": [
    {
      "idea_id": "idea_1",
      "concentration": "该题主要考察点",
      "question_type": "choice | written | calculation",
      "difficulty": "easy 或 medium 或 hard",
      "rationale": "该创意的价值"
    }
  ]
}`;

const GENERATOR_SYSTEM = `你是题目生成流程中的 Generator。
从结构化的 QuestionTemplate 生成高质量的问答对。`;

const GENERATOR_PROMPT = `QuestionTemplate:
{template}

用户主题：
{topic}

知识依据：
{knowledge_context}

已生成的题目（你的新题目必须与所有这些题目不同）：
{previous_questions}

要求：
- 严格保持与 template.concentration 和 template.difficulty 一致
- 严格遵守 template.question_type，不要私自更改
- 如果是 choice 类型，提供 4 个选项和一个正确答案
- 选项长度要均衡，正确答案不能明显比其他选项长
- 如果是 written 或 calculation 类型，不要提供选项
- 提供清晰的解释

仅返回 JSON：
{
  "question_type": "choice 或 written 或 calculation",
  "question": "题目内容",
  "options": {"A":"...","B":"...","C":"...","D":"..."} 或 null,
  "correct_answer": "选择题用选项键；简答/计算题用参考答案本身",
  "explanation": "详细解释"
}`;

// ==================== TEST CASES ====================

const TEST_CASES = {
  topic: '一元二次方程的求解',
  preference: '高中数学，侧重基础概念和实际应用',
  knowledgeContext: `一元二次方程是形如 ax² + bx + c = 0 (a ≠ 0) 的方程。
主要解法：
1. 配方法：将方程化为 (x + p)² = q 的形式
2. 公式法：使用求根公式 x = (-b ± √(b²-4ac)) / 2a
3. 因式分解法：将方程化为 (x - x₁)(x - x₂) = 0 的形式

判别式 Δ = b² - 4ac：
- Δ > 0：两个不相等的实数根
- Δ = 0：两个相等的实数根
- Δ < 0：无实数根

韦达定理：x₁ + x₂ = -b/a, x₁x₂ = c/a`,
  existingConcentrations: [],
};

// ==================== MINIMAX API ====================

// 直接使用用户提供的值（绕过环境变量加载问题）
const MINIMAX_API_KEY = "tp-czc2pp7a9em0xqiyawd0ki2gio5p9d072v7gzduv7zg2a5w2";
const MINIMAX_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const MINIMAX_MODEL = "mimo-v2.5-pro";

async function callMiniMax(userPrompt: string, systemPrompt: string = ''): Promise<string> {
  const messages: any[] = [];

  if (systemPrompt) {
    messages.push({ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  // MiniMax 使用 /chat/completions 端点
  const response = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      max_tokens: 4096,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // MiniMax 返回格式: choices[0].message.content
  let content = '';
  if (data.choices && data.choices[0]?.message?.content) {
    content = data.choices[0].message.content;
  }

  // 清理 markdown 代码块
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  return content;

  // 备用: Anthropic 格式 content
  if (Array.isArray(data.content)) {
    const textBlock = data.content.find((b: any) => b.type === 'text');
    return textBlock?.text || '';
  }

  return '';
}

// ==================== FUNCTIONS ====================

async function testIdeaAgent() {
  console.log('\n========================================');
  console.log('测试 1: IdeaAgent - 生成题目模板');
  console.log('========================================\n');

  const userPrompt = IDEA_AGENT_PROMPT
    .replace('{topic}', TEST_CASES.topic)
    .replace('{preference}', TEST_CASES.preference)
    .replace('{knowledge_context}', TEST_CASES.knowledgeContext)
    .replace('{existing_concentrations}', JSON.stringify(TEST_CASES.existingConcentrations))
    .replace('{num_ideas}', '5');

  console.log('使用模型:', MINIMAX_MODEL);
  console.log('请求...');

  const content = await callMiniMax(userPrompt, IDEA_AGENT_SYSTEM);

  console.log('\n生成的模板:');
  console.log(content);

  try {
    const result = JSON.parse(content);
    console.log('\n解析后的 JSON:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (e: any) {
    console.error('\nJSON 解析失败:', e.message);
    return { ideas: [] };
  }
}

async function testGenerator(template: any) {
  console.log('\n========================================');
  console.log('测试 2: Generator - 生成完整题目');
  console.log('========================================\n');

  const userPrompt = GENERATOR_PROMPT
    .replace('{template}', JSON.stringify(template, null, 2))
    .replace('{topic}', TEST_CASES.topic)
    .replace('{knowledge_context}', TEST_CASES.knowledgeContext)
    .replace('{previous_questions}', '');

  console.log('请求...');

  const content = await callMiniMax(userPrompt, GENERATOR_SYSTEM);

  console.log('\n生成的题目:');
  console.log(content);

  try {
    const result = JSON.parse(content);
    console.log('\n解析后的 JSON:');
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (e: any) {
    console.error('\nJSON 解析失败:', e.message);
    return null;
  }
}

async function testFullPipeline() {
  console.log('\n========================================');
  console.log('测试 3: 完整流程 - 生成 3 道题');
  console.log('========================================\n');

  // 步骤 1: 生成模板
  console.log('步骤 1: 生成题目模板...');
  const ideaPrompt = IDEA_AGENT_PROMPT
    .replace('{topic}', TEST_CASES.topic)
    .replace('{preference}', TEST_CASES.preference)
    .replace('{knowledge_context}', TEST_CASES.knowledgeContext)
    .replace('{existing_concentrations}', '[]')
    .replace('{num_ideas}', '3');

  const ideaContent = await callMiniMax(ideaPrompt, IDEA_AGENT_SYSTEM);
  const ideas = JSON.parse(ideaContent);
  const templates = ideas.ideas || [];

  console.log(`✓ 生成了 ${templates.length} 个模板`);

  // 步骤 2: 为每个模板生成完整题目
  const questions = [];
  const previousQuestions: string[] = [];

  for (let i = 0; i < templates.length; i++) {
    console.log(`\n生成第 ${i + 1} 道题...`);

    const generatorPrompt = GENERATOR_PROMPT
      .replace('{template}', JSON.stringify(templates[i], null, 2))
      .replace('{topic}', TEST_CASES.topic)
      .replace('{knowledge_context}', TEST_CASES.knowledgeContext)
      .replace('{previous_questions}', previousQuestions.map(q => `${q}`).join('\n'));

    const genContent = await callMiniMax(generatorPrompt, GENERATOR_SYSTEM);
    const question = JSON.parse(genContent);
    questions.push(question);
    previousQuestions.push(question.question);
    console.log(`✓ 第 ${i + 1} 道题生成完成`);
  }

  console.log('\n========================================');
  console.log('最终结果');
  console.log('========================================\n');
  console.log(JSON.stringify(questions, null, 2));

  return questions;
}

// ==================== MAIN ====================

async function main() {
  console.log('========================================');
  console.log('DeepTutor Prompts 验证脚本');
  console.log('========================================');
  console.log(`API: ${MINIMAX_BASE_URL}`);
  console.log(`Model: ${MINIMAX_MODEL}`);
  console.log(`Topic: ${TEST_CASES.topic}`);

  try {
    // 测试 1: IdeaAgent
    const ideas = await testIdeaAgent();
    const firstIdea = ideas.ideas?.[0];

    if (firstIdea) {
      // 测试 2: Generator
      await testGenerator(firstIdea);
    }

    // 测试 3: 完整流程
    await testFullPipeline();

    console.log('\n✅ 所有测试完成');
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

main();
