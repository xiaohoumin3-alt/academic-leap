import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY not configured');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = 'models/gemma-4-31b-it';

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
    features: { cognitiveLoad: 0.1, reasoningDepth: 0.0, complexity: 0.1 },
  },
  {
    question: { title: "二次根式乘法", description: "计算 √3 × √12" },
    reasoning: "需要公式应用，单层推理",
    features: { cognitiveLoad: 0.2, reasoningDepth: 0.1, complexity: 0.2 },
  },
  {
    question: { title: "二次根式化简", description: "化简 √50" },
    reasoning: "多步骤操作，中等认知负荷",
    features: { cognitiveLoad: 0.4, reasoningDepth: 0.3, complexity: 0.4 },
  },
  {
    question: { title: "混合运算", description: "计算 (√8 + √18) / √2" },
    reasoning: "需要规划路径，多概念综合",
    features: { cognitiveLoad: 0.7, reasoningDepth: 0.6, complexity: 0.7 },
  },
  {
    question: { title: "建模应用", description: "正方形面积20cm²，求对角线" },
    reasoning: "实际问题抽象，高认知负荷",
    features: { cognitiveLoad: 0.8, reasoningDepth: 0.7, complexity: 0.8 },
  },
  {
    question: { title: "构造性证明", description: "证明：若a>b>0，则√a-√b<√(a-b)" },
    reasoning: "高阶数学思维，构造性证明",
    features: { cognitiveLoad: 0.9, reasoningDepth: 0.9, complexity: 0.9 },
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

**特征定义：**
1. cognitiveLoad [0-1]：工作记忆占用程度
2. reasoningDepth [0-1]：逻辑推理层次数
3. complexity [0-1]：综合复杂度

${examples}

分析以下题目：
${JSON.stringify(content)}

严格按JSON格式输出，不要Markdown或解释：
{"reasoning":"分析","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}`;
}

function buildBatchPrompt(items: Array<{ id: string; content: QuestionContent }>): string {
  const questionsJson = JSON.stringify(items.map(item => ({
    id: item.id,
    ...item.content,
  })));

  return `你是一个数学教育专家。一次性评估以下${items.length}道题目的复杂度。

**特征定义：**
1. cognitiveLoad [0-1]：工作记忆占用
2. reasoningDepth [0-1]：推理层次
3. complexity [0-1]：综合复杂度

题目列表：
${questionsJson}

严格按JSON数组输出：
[
  {"id":"...","reasoning":"...","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}
]`;
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
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: MODEL_NAME });
  }

  async extract(questionId: string, content: QuestionContent): Promise<ExtractionResult> {
    const prompt = buildSinglePrompt(content);

    return retryWithBackoff(async () => {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return parseSingleResponse(text, questionId);
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

      const batchResults = await retryWithBackoff(async () => {
        const result = await this.model.generateContent(prompt);
        const text = result.response.text();
        return parseBatchResponse(text);
      });

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
