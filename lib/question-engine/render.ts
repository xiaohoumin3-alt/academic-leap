/**
 * 渲染层（Render Layer）
 * AI只负责表达层，不参与正确性判断
 */

import { QuestionProtocol } from './protocol';

/**
 * 渲染风格
 */
export type RenderStyle = 'standard' | 'guided' | 'gamified' | 'story';

/**
 * AI改写选项
 */
interface AIRewriteOptions {
  style: RenderStyle;
  maxLength?: number;
}

/**
 * 基础渲染（本地，不依赖AI）
 */
export function renderBaseTitle(question: QuestionProtocol): string {
  return question.content.title;
}

/**
 * AI增强渲染（可选）
 * 只改写表达方式，不影响题目结构
 */
export async function renderWithAI(
  question: QuestionProtocol,
  options: AIRewriteOptions = { style: 'standard' }
): Promise<string> {
  // 如果没有配置 GEMINI_API_KEY，直接返回基础渲染
  if (!process.env.GEMINI_API_KEY) {
    return renderBaseTitle(question);
  }

  // 如果是标准风格，不需要AI改写
  if (options.style === 'standard') {
    return renderBaseTitle(question);
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'models/gemma-4-31b-it' });

    const prompt = buildRenderPrompt(question.content.title, options.style);
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // 提取AI生成的标题
    const cleaned = cleanAIResponse(text);
    return cleaned || question.content.title;
  } catch (error) {
    console.error('AI渲染失败，使用基础渲染:', error);
    return renderBaseTitle(question);
  }
}

/**
 * 构建AI渲染prompt
 */
function buildRenderPrompt(originalTitle: string, style: RenderStyle): string {
  const styleInstructions: Record<RenderStyle, string> = {
    standard: '',
    guided: '请添加引导性的提示，让学生更容易理解题意。',
    gamified: '请用更有趣、更游戏化的语言重新表述，增加趣味性。',
    story: '请把题目融入一个生活场景或小故事中。',
  };

  const instruction = styleInstructions[style];

  return `请改写以下数学题目，${instruction}

要求：
1. 保持数学含义完全不变
2. 不要改数字和参数
3. 只改表达方式
4. 直接输出改写后的题目，不要有其他文字

原题目：${originalTitle}

改写后的题目：`;
}

/**
 * 清理AI响应
 */
function cleanAIResponse(text: string): string | null {
  // 移除可能的引号
  let cleaned = text.trim().replace(/^["']|["']$/g, '');

  // 移除可能的"题目："等前缀
  cleaned = cleaned.replace(/^(题目[:：]?\s*)/i, '');

  // 如果太短或太长，可能有问题
  if (cleaned.length < 5 || cleaned.length > 200) {
    return null;
  }

  return cleaned;
}

/**
 * 完整渲染流程
 */
export async function renderQuestion(
  question: QuestionProtocol,
  style: RenderStyle = 'standard'
): Promise<QuestionProtocol> {
  const title = style === 'standard'
    ? renderBaseTitle(question)
    : await renderWithAI(question, { style });

  return {
    ...question,
    content: {
      ...question.content,
      title,
    },
  };
}

/**
 * 批量渲染
 */
export async function renderQuestions(
  questions: QuestionProtocol[],
  style: RenderStyle = 'standard'
): Promise<QuestionProtocol[]> {
  if (style === 'standard') {
    return questions; // 标准风格不需要AI
  }

  return Promise.all(
    questions.map(q => renderQuestion(q, style))
  );
}
