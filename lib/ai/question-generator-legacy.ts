/**
 * Question Generator - AI-powered question generation with complexity extraction
 *
 * Core features:
 * 1. JSON parsing utilities (fixLaTeXEscapes, stripMarkdownCodeBlock, parseCardsResponse)
 * 2. Content chunking algorithm (splitContentIntoChunks)
 * 3. Core generation functions (generateDirect, generateCards, generateCardsWithComplexity, generateAndSaveCards)
 * 4. API calls with retry mechanism
 */

import { prisma } from '@/lib/prisma';
import { getAIConfig } from './config';
import { ComplexityExtractor, ComplexityFeatures } from '@/lib/qie/complexity-extractor';

// ============================================================================
// Types
// ============================================================================

export type QuestionType = 'fill_blank' | 'multiple_choice' | 'short_answer';

export interface GeneratedCard {
  id: string;
  question_type: QuestionType;
  question: string;
  answer: string;
  options?: string[];
  explanation?: string;
}

export interface GenerateParams {
  knowledgePointId: string;
  content: string;
  types: QuestionType[];
  count?: number;
  difficulty?: number;
  onProgress?: (progress: { batch: number; total: number; cards: GeneratedCard[] }) => void;
}

export interface GenerateAndSaveParams {
  knowledgePointId: string;
  content: string;
  types: QuestionType[];
  count?: number;
  difficulty?: number;
  grade?: number;
  onProgress?: (batch: number, total: number, cards: GeneratedCard[]) => void;
}

// ============================================================================
// Prompt Templates
// ============================================================================

const PROMPTS: Record<QuestionType, string> = {
  fill_blank: `你是一个专业的数学教育内容生成助手。从以下内容中提取关键知识点，生成填空题。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式（如 $\\sqrt{a}$）
3. 每道题挖空 1-2 个关键词，用 "____" 或 "______" 表示
4. answer 是单个关键词或简短短语
5. explanation 简要说明为什么这个是正确答案

【示例格式】
{
  "cards": [
    {
      "question": "二次根式的概念是形如 $\\sqrt{a}$，其中 $a$ 必须满足______。",
      "answer": "$a \\ge 0$",
      "explanation": "二次根式的被开方数必须为非负数。"
    }
  ]
}

内容：
{content}

请生成覆盖内容中所有关键知识点的填空题（10-20道），输出纯 JSON：`,

  multiple_choice: `从以下内容中生成选择题，每个题目 4 个选项，只有 1 个正确答案。

要求：
1. 题目应该测试理解而非记忆
2. 干扰项应该看似合理但明显错误
3. 标注正确答案

内容：
{content}

返回格式：
{
  "cards": [
    {
      "question": "题目内容",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "B. 选项2",
      "explanation": "解释说明"
    }
  ]
}`,

  short_answer: `从以下内容中生成简答题，每个题目需要1-3句话回答。

要求：
1. 题目应该引发思考而非事实回忆
2. 鼓励学生解释原因、描述过程或阐述理解
3. 答案应该开放性强，允许多种合理表达

内容：
{content}

返回格式：
{
  "cards": [
    {
      "question": "题目内容",
      "answer": "参考答案要点",
      "explanation": "评分要点说明"
    }
  ]
}`
};

// ============================================================================
// JSON Parsing Utilities
// ============================================================================

/**
 * Fix LaTeX escape characters in JSON string
 * AI returns may contain improperly escaped backslashes (LaTeX formulas)
 */
export function fixLaTeXEscapes(jsonString: string): string {
  // Fix LaTeX dollar signs: $ followed by \ needs escaping
  // e.g., "$\sqrt{a}$" → "\\$\\sqrt{a}\\$" after JSON parsing issues
  let fixed = jsonString.replace(/\$\\/g, '\\$');

  // Fix unescaped backslashes - escape any backslash not followed by valid JSON escape sequences
  // Valid escape sequences: \" \\ \/ \b \f \n \r \t \uXXXX
  const result: string[] = [];
  let i = 0;
  while (i < fixed.length) {
    if (fixed[i] === '\\') {
      const nextChar = fixed[i + 1];
      // If followed by a valid JSON escape char, keep as-is
      if (['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'].includes(nextChar)) {
        result.push(fixed[i]);
        result.push(nextChar);
        i += 2;
      } else {
        // Escape the backslash
        result.push('\\\\');
        i += 1;
      }
    } else {
      result.push(fixed[i]);
      i += 1;
    }
  }
  return result.join('');
}

/**
 * Strip markdown code block markers from AI response
 */
export function stripMarkdownCodeBlock(text: string): string {
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n');
    if (lines[0].trim().startsWith('```')) lines.shift();
    if (lines[lines.length - 1].trim() === '```') lines.pop();
    jsonText = lines.join('\n').trim();
  }
  return jsonText;
}

/**
 * Parse AI card response with fault tolerance
 */
export function parseCardsResponse(
  responseText: string,
  type: QuestionType,
  maxCount: number
): GeneratedCard[] {
  let jsonText = stripMarkdownCodeBlock(responseText);
  jsonText = fixLaTeXEscapes(jsonText);

  let parsed: { cards: unknown[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const cardsMatch = jsonText.match(/"cards"\s*:\s*\[([\s\S]*)\]/);
    if (cardsMatch) {
      try {
        const cardsArray = JSON.parse(`[${cardsMatch[1]}]`);
        parsed = { cards: cardsArray };
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  return ((parsed.cards as Record<string, unknown>[]) || []).slice(0, maxCount).map(card => ({
    id: crypto.randomUUID(),
    question_type: type,
    question: String(card.question ?? ''),
    answer: String(card.answer ?? ''),
    options: Array.isArray(card.options) ? card.options.map(String) : undefined,
    explanation: card.explanation ? String(card.explanation) : undefined
  }));
}

// ============================================================================
// Content Chunking Algorithm
// ============================================================================

interface ChunkOptions {
  maxLength: number;
  preserveParagraphs: boolean;
  preserveSections: boolean;
}

/**
 * Split content into semantically intact chunks
 * Preserves chapter/paragraph integrity
 */
function splitContentIntoChunks(content: string, options: ChunkOptions): string[] {
  const { maxLength, preserveParagraphs, preserveSections } = options;

  if (content.length <= maxLength) {
    return [content];
  }

  if (preserveSections) {
    const sectionRegex = /(?:^|\n)\s*(第[一二三四五六七八九十\d]+[章节篇]|[1-9]\d*\.[1-9]\d*)\s*[^\n]*/g;
    const sections: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sectionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        sections.push(content.slice(lastIndex, match.index).trim());
      }
      lastIndex = match.index;
    }

    if (lastIndex < content.length) {
      sections.push(content.slice(lastIndex).trim());
    }

    if (sections.length > 1 && sections.every(s => s.length > 50)) {
      return mergeSectionsToChunks(sections, maxLength);
    }
  }

  if (preserveParagraphs) {
    const paragraphs = content.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if ((currentChunk + '\n\n' + trimmedPara).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = trimmedPara;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length >= 50);
  }

  const sentences = content.match(/[^。！？.!?]+[。！？.!?]*/g) || [content];
  return mergeSentencesToChunks(sentences, maxLength);
}

/**
 * Merge sections into chunks respecting maxLength
 */
function mergeSectionsToChunks(sections: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    if (section.length > maxLength) {
      // Section too large, split by paragraphs
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const subChunks = splitContentIntoChunks(section, {
        maxLength,
        preserveParagraphs: true,
        preserveSections: false
      });
      chunks.push(...subChunks);
    } else if ((currentChunk + '\n\n' + section).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Merge sentences into chunks respecting maxLength
 */
function mergeSentencesToChunks(sentences: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// ============================================================================
// API Calls with Retry
// ============================================================================

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff retry with total timeout
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; initialDelay: number; maxDelay: number; totalTimeout?: number }
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, totalTimeout } = config;
  let lastError: Error | undefined;
  const startTime = Date.now();

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (totalTimeout && (Date.now() - startTime) > totalTimeout) {
        throw new Error(`Retry timeout exceeded after ${Date.now() - startTime}ms`);
      }

      if (i < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay);
        await sleep(delay);
        console.warn(`[AI] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      }
    }
  }

  throw lastError ?? new Error('Unknown retry error');
}

/**
 * Call Mimo API with retry
 */
async function callMimoAPI(prompt: string): Promise<string> {
  const config = getAIConfig();

  return retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const response = await fetch(`${config.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: [{ role: 'user', content: prompt }]
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Mimo API ${response.status}: ${error}`);
        }

        const data = await response.json() as { error?: { message: string }; choices?: Array<{ message?: { content?: string } }> };

        if (data.error) {
          throw new Error(`Mimo API error: ${data.error.message}`);
        }

        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Mimo API: no content in response');
        }

        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    config.retryConfig
  );
}

// ============================================================================
// Core Generation Functions
// ============================================================================

/**
 * Generate cards directly from content (single chunk)
 */
async function generateDirect(params: {
  content: string;
  types: QuestionType[];
  count: number;
  difficulty?: number;
}): Promise<GeneratedCard[]> {
  const { content, types, count, difficulty } = params;

  const difficultyPrompt = difficulty
    ? `\n难度要求：${difficulty}/10，适合${difficulty}年级学生`
    : '';

  const results = await Promise.all(
    types.map(async (type) => {
      const prompt = PROMPTS[type]
        .replace('{content}', content.slice(0, 8000))
        + difficultyPrompt;

      const response = await callMimoAPI(prompt);
      return parseCardsResponse(response, type, count);
    })
  );

  return results.flat();
}

/**
 * Generate cards with automatic content chunking
 */
export async function generateCards(params: GenerateParams): Promise<GeneratedCard[]> {
  const { content, types, count = 10, difficulty, onProgress } = params;

  if (content.length <= 500) {
    const cards = await generateDirect({ content, types, count, difficulty });
    onProgress?.({ batch: 1, total: 1, cards });
    return cards;
  }

  const chunks = splitContentIntoChunks(content, {
    maxLength: 3000,
    preserveParagraphs: true,
    preserveSections: true
  });
  const allCards: GeneratedCard[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkCards = await generateDirect({
      content: chunks[i],
      types,
      count: Math.ceil(count / chunks.length),
      difficulty
    });
    allCards.push(...chunkCards);
    onProgress?.({ batch: i + 1, total: chunks.length, cards: chunkCards });
  }

  return allCards.slice(0, count);
}

/**
 * Calculate difficulty from complexity features
 */
function calculateDifficultyFromComplexity(features: ComplexityFeatures): number {
  // Use cognitiveLoad as the proxy for complexity since complexity field was removed
  const baseDifficulty = Math.round(features.cognitiveLoad * 11) + 1;
  return Math.max(1, Math.min(12, baseDifficulty));
}

/**
 * Generate cards with complexity extraction (two-step process)
 * Step 1: Generate cards via AI
 * Step 1.5: Insert into database with PENDING status
 * Step 2: Extract complexity features using ComplexityExtractor
 * Step 3: Update database with extracted features
 */
export async function generateCardsWithComplexity(params: GenerateParams): Promise<unknown[]> {
  const { knowledgePointId, difficulty } = params;

  // Step 1: AI generate questions (content only, no ID)
  const rawCards = await generateCards(params);

  // Step 1.5: Insert into database first to get real IDs
  const tempQuestions = await prisma.$transaction(async (tx) => {
    return Promise.all(
      rawCards.map(card =>
        tx.question.create({
          data: {
            id: crypto.randomUUID(),
            type: card.question_type,
            difficulty: difficulty || 5,
            answer: card.answer,
            cognitiveLoad: 0.5,
            reasoningDepth: 0.5,
            knowledgePoints: JSON.stringify([knowledgePointId]),
            content: JSON.stringify({
              question: card.question,
              options: card.options,
              explanation: card.explanation
            }),
            isAI: true,
            extractionStatus: 'PENDING'
          }
        })
      )
    );
  });

  // Step 2: Extract complexity features using real IDs
  const extractor = new ComplexityExtractor();
  const complexityResults = await extractor.extractBatch(
    tempQuestions.map(q => {
      let content: { question?: string };
      try {
        content = JSON.parse(q.content as string) as { question?: string };
      } catch {
        content = {};
      }
      return {
        id: q.id,
        content: {
          title: q.type,
          description: content.question || ''
        }
      };
    }),
    {
      batchSize: 8,
      onProgress: (current, total) => {
        console.log(`[Complexity] Extracting ${current}/${total}`);
      }
    }
  );

  // Step 3: Update database with extracted complexity features
  const finalQuestions = await prisma.$transaction(async (tx) => {
    return Promise.all(
      tempQuestions.map(async (q) => {
        const result = complexityResults.get(q.id);
        if (!result) {
          console.warn(`[Complexity] No result for ${q.id}, marking as FAILED`);
          return tx.question.update({
            where: { id: q.id },
            data: {
              extractionStatus: 'FAILED',
              extractionError: 'No result from batch extraction'
            }
          });
        }

        const calculatedDifficulty = calculateDifficultyFromComplexity(result.features);

        return tx.question.update({
          where: { id: q.id },
          data: {
            cognitiveLoad: result.features.cognitiveLoad,
            reasoningDepth: result.features.reasoningDepth,
            difficulty: difficulty || calculatedDifficulty,
            extractionStatus: 'SUCCESS',
            featuresExtractedAt: new Date()
          }
        });
      })
    );
  });

  return finalQuestions;
}

/**
 * Complete flow: AI generate -> complexity extraction -> save to database
 * Throws error on generation failure (no fallback)
 */
export async function generateAndSaveCards(
  params: GenerateAndSaveParams
): Promise<{ questions: unknown[]; totalCount: number }> {
  const { onProgress } = params;

  const adaptedProgress = (progress: { batch: number; total: number; cards: GeneratedCard[] }) => {
    onProgress?.(progress.batch, progress.total, progress.cards);
  };

  const questions = await generateCardsWithComplexity({ ...params, onProgress: adaptedProgress });

  return {
    questions,
    totalCount: questions.length
  };
}