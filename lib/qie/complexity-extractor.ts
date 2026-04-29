import Anthropic from '@anthropic-ai/sdk';

const MODEL_NAME = 'claude-haiku-4-20250514';  // MiniMax routes to internal model

function getAnthropicClient() {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseURL = process.env.MINIMAX_BASE_URL;

  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not configured');
  }
  if (!baseURL) {
    throw new Error('MINIMAX_BASE_URL not configured');
  }

  return new Anthropic({ apiKey, baseURL });
}

const DEFAULT_BATCH_SIZE = 8;

export interface QuestionContent {
  title?: string;
  description?: string;
  context?: string;
  expression?: string;
}

export interface ComplexityFeatures {
  cognitiveLoad: number;  // [0, 1]
  reasoningDepth: number; // [0, 1]
  complexity: number;     // [0, 1]
}

export interface ExtractionResult {
  questionId: string;
  features: ComplexityFeatures;
  confidence: number;
  reasoning: string;
}

export interface BatchExtractionOptions {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (current: number, total: number) => void;
}

export class ExtractionFailedError extends Error {
  constructor(
    public questionId: string,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'ExtractionFailedError';
  }
}

const FEW_SHOT_EXAMPLES = [
  {
    question: { title: "计算二次根式", description: "计算 √16 的值" },
    reasoning: "直接回忆特殊值，无需推理",
    features: { cognitiveLoad: 0.1, reasoningDepth: 0.0, complexity: 0.05 },
  },
  {
    question: { title: "二次根式乘法", description: "计算 √3 × √12" },
    reasoning: "应用√a×√b=√ab公式，单层推理",
    features: { cognitiveLoad: 0.2, reasoningDepth: 0.1, complexity: 0.15 },
  },
  {
    question: { title: "二次根式化简", description: "化简 √50" },
    reasoning: "需要分解质因数(50=25×2)、提取根号、合并系数，3步操作",
    features: { cognitiveLoad: 0.45, reasoningDepth: 0.3, complexity: 0.375 },
  },
  {
    question: { title: "求二次函数顶点", description: "求抛物线 y=x²-4x+3 的顶点坐标" },
    reasoning: "需要配方法或顶点公式，涉及系数识别、符号处理、两步计算",
    features: { cognitiveLoad: 0.55, reasoningDepth: 0.5, complexity: 0.525 },
  },
  {
    question: { title: "二次函数性质证明", description: "证明：对于任意实数x，二次函数 y=(x-1)²+2 的最小值为2" },
    reasoning: "需要理解完全平方式的非负性，进行逻辑推导，构造性证明",
    features: { cognitiveLoad: 0.7, reasoningDepth: 0.85, complexity: 0.775 },
  },
  {
    question: { title: "实际问题建模", description: "某商品利润满足函数 L=-10x²+200x-800，求最大利润及对应价格" },
    reasoning: "实际问题抽象→数学模型→顶点公式应用→结果解释，4步推理链",
    features: { cognitiveLoad: 0.8, reasoningDepth: 0.7, complexity: 0.75 },
  },
] as const;

function buildSinglePrompt(content: QuestionContent): string {
  const examples = FEW_SHOT_EXAMPLES.map((ex, i) => `
示例 ${i + 1}:
题目：${JSON.stringify(ex.question)}
分析：${ex.reasoning}
特征：cognitiveLoad=${ex.features.cognitiveLoad}, reasoningDepth=${ex.features.reasoningDepth}, complexity=${ex.features.complexity}
`).join('\n');

  return `你是一个数学教育专家，分析数学题目的认知特征。

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

${examples}

---

分析以下题目：
${JSON.stringify(content)}

严格按JSON格式输出，不要Markdown或解释：
{"reasoning":"分析","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}`;
}

function buildBatchPrompt(items: Array<{ id: string; content: QuestionContent }>): string {
  // Build item descriptions separately to avoid JSON nesting issues
  const itemDescriptions = items.map((item, idx) => {
    const content = item.content;
    const parts = [];
    if (content.title) parts.push(`标题:${content.title}`);
    if (content.description) parts.push(`描述:${content.description}`);
    if (content.context) parts.push(`上下文:${content.context}`);
    if (content.expression) parts.push(`表达式:${content.expression}`);
    return `题目${idx + 1} [ID:${item.id}]: ${parts.join(' | ')}`;
  }).join('\n');

  return `你是一个数学教育专家。一次性评估以下${items.length}道题目的复杂度。

**特征评分标准：**
1. cognitiveLoad [0-1]：工作记忆占用
2. reasoningDepth [0-1]：推理层次
3. complexity [0-1]：综合复杂度

**关键词提示：**
- "化简" → cognitiveLoad ≥ 0.4
- "证明" → reasoningDepth ≥ 0.8
- "顶点" → cognitiveLoad ≥ 0.5
- "应用" → complexity ≥ 0.7

${itemDescriptions}

严格按JSON数组输出（不要使用代码块标记）：
[{"id":"题目ID","reasoning":"分析","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}]`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface ParsedSingleResponse {
  reasoning?: string;
  features?: {
    cognitiveLoad?: number;
    reasoningDepth?: number;
    complexity?: number;
  };
  confidence?: number;
}

export function parseSingleResponse(text: string, questionId: string): ExtractionResult {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find JSON object - handle nested objects by matching from first { to last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('无法找到有效的JSON响应');
  }

  const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonStr) as ParsedSingleResponse;

  const features = {
    cognitiveLoad: clamp(parsed.features?.cognitiveLoad ?? 0.5, 0, 1),
    reasoningDepth: clamp(parsed.features?.reasoningDepth ?? 0.5, 0, 1),
    complexity: clamp(parsed.features?.complexity ?? 0.5, 0, 1),
  };

  return {
    questionId,
    features,
    confidence: clamp(parsed.confidence ?? 0.8, 0, 1),
    reasoning: parsed.reasoning ?? '',
  };
}

/**
 * Parse Anthropic-style response with thinking + text blocks
 */
export function parseAnthropicResponse(response: any, questionId: string): ExtractionResult {
  let text = '';

  // Extract text block (skip thinking blocks)
  if (Array.isArray(response.content)) {
    const textBlock = response.content.find((b: any) => b.type === 'text');
    text = textBlock?.text || '';
  } else if (typeof response === 'string') {
    text = response;
  } else {
    text = JSON.stringify(response);
  }

  return parseSingleResponse(text, questionId);
}

interface ParsedBatchItem {
  id: string;
  reasoning?: string;
  features?: {
    cognitiveLoad?: number;
    reasoningDepth?: number;
    complexity?: number;
  };
  confidence?: number;
}

export function parseBatchResponse(text: string): Map<string, ExtractionResult> {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('无法找到有效的JSON数组');
  }

  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('响应不是有效的数组');
  }

  const results = new Map<string, ExtractionResult>();

  for (const item of parsed as ParsedBatchItem[]) {
    if (!item.id) continue;
    results.set(item.id, {
      questionId: item.id,
      features: {
        cognitiveLoad: clamp(item.features?.cognitiveLoad ?? 0.5, 0, 1),
        reasoningDepth: clamp(item.features?.reasoningDepth ?? 0.5, 0, 1),
        complexity: clamp(item.features?.complexity ?? 0.5, 0, 1),
      },
      confidence: clamp(item.confidence ?? 0.8, 0, 1),
      reasoning: item.reasoning ?? '',
    });
  }

  return results;
}

/**
 * Parse Anthropic-style batch response with thinking + text blocks
 */
export function parseAnthropicBatchResponse(response: any): Map<string, ExtractionResult> {
  let text = '';

  // Extract text block (skip thinking blocks)
  if (Array.isArray(response.content)) {
    const textBlock = response.content.find((b: any) => b.type === 'text');
    text = textBlock?.text || '';
  } else if (typeof response === 'string') {
    text = response;
  } else {
    text = JSON.stringify(response);
  }

  try {
    return parseBatchResponse(text);
  } catch (error) {
    // Enhanced error handling: try to recover partial results
    console.warn('Batch parsing failed, attempting recovery...');

    // Try to find individual JSON objects
    const objectMatches = text.match(/\{[^{}]*"id"[^{}]*\}/g);
    if (objectMatches) {
      console.log(`Found ${objectMatches.length} individual objects, attempting to parse...`);
      const results = new Map<string, ExtractionResult>();

      for (const match of objectMatches) {
        try {
          const parsed = JSON.parse(match) as ParsedBatchItem;
          if (parsed.id) {
            results.set(parsed.id, {
              questionId: parsed.id,
              features: {
                cognitiveLoad: clamp(parsed.features?.cognitiveLoad ?? 0.5, 0, 1),
                reasoningDepth: clamp(parsed.features?.reasoningDepth ?? 0.5, 0, 1),
                complexity: clamp(parsed.features?.complexity ?? 0.5, 0, 1),
              },
              confidence: clamp(parsed.confidence ?? 0.8, 0, 1),
              reasoning: parsed.reasoning ?? '',
            });
          }
        } catch {
          // Skip invalid objects
        }
      }

      if (results.size > 0) {
        console.log(`Recovered ${results.size} results from failed batch`);
        return results;
      }
    }

    throw error;
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  // Unreachable - the loop either returns or throws on the last iteration
  throw new Error('Unreachable');
}

export class ComplexityExtractor {
  private client: Anthropic;

  constructor() {
    this.client = getAnthropicClient();
  }

  async extract(questionId: string, content: QuestionContent): Promise<ExtractionResult> {
    const prompt = buildSinglePrompt(content);

    return retryWithBackoff(async () => {
      const response = await this.client.messages.create({
        model: MODEL_NAME,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      return parseAnthropicResponse(response, questionId);
    });
  }

  async extractBatch(
    items: Array<{ id: string; content: QuestionContent }>,
    options: BatchExtractionOptions = {}
  ): Promise<Map<string, ExtractionResult>> {
    const { batchSize = DEFAULT_BATCH_SIZE, delayMs = 1000, onProgress } = options;
    const allResults = new Map<string, ExtractionResult>();

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const prompt = buildBatchPrompt(batch);

      let batchResults: Map<string, ExtractionResult>;
      try {
        batchResults = await retryWithBackoff(async () => {
          const response = await this.client.messages.create({
            model: MODEL_NAME,
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
          });
          return parseAnthropicBatchResponse(response);
        });
      } catch (error) {
        console.warn(`Batch ${i}-${i + batchSize} failed, falling back to individual extraction...`);
        // Fallback: extract each item individually
        batchResults = new Map();
        for (const item of batch) {
          try {
            const result = await this.extract(item.id, item.content);
            batchResults.set(item.id, result);
          } catch (singleError) {
            console.warn(`Individual extraction failed for ${item.id}:`, singleError);
          }
        }
      }

      batchResults.forEach((value, key) => allResults.set(key, value));

      if (onProgress) {
        onProgress(Math.min(i + batchSize, items.length), items.length);
      }

      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return allResults;
  }
}
