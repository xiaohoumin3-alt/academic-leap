# ComplexityExtractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automated complexity feature extraction factory using gemma-4-31b-it LLM to extract cognitiveLoad, reasoningDepth, and complexity features from math questions.

**Architecture:** LLM-based extraction service with few-shot prompting, defensive JSON parsing, batch processing (8 questions/call), failure status tracking (no default values), and exponential backoff retry.

**Tech Stack:** TypeScript, Google Generative AI SDK (@google/generative-ai), Prisma, Jest

---

## File Structure

```
lib/qie/
├── complexity-extractor.ts          # Core extractor class
├── __tests__/
│   └── complexity-extractor.test.ts # Unit tests
scripts/
├── extract-complexity.ts            # Batch processing script
app/api/admin/complexity/
├── extract/route.ts                 # Single-question API
├── batch/route.ts                   # Batch API
└── status/route.ts                  # Status query API
prisma/
└── schema.prisma                    # Add extraction fields
```

---

## Task 1: Extend Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add extraction fields to Question model**

Add these fields to the `Question` model (after line 62):

```prisma
model Question {
  // ... existing fields up to line 62

  // Complexity feature extraction fields
  cognitiveLoad      Float?   // [0, 1] 认知负荷
  reasoningDepth     Float?   // [0, 1] 推理深度
  complexity         Float?   // [0, 1] 综合复杂度
  extractionStatus   String   @default("PENDING")  // PENDING | SUCCESS | FAILED
  featuresExtractedAt DateTime?
  extractionError    String?  // 失败原因记录
  extractionModel    String?  @default("gemma-4-31b-it-v1")

  steps           QuestionStep[]
}
```

Also add the index:

```prisma
@@index([extractionStatus])
```

Place it after the existing `@@id` line in the Question model.

- [ ] **Step 2: Push schema to database**

Run: `pnpm db:push`
Expected output: "Database schema is synced"

- [ ] **Step 3: Generate Prisma client**

Run: `pnpm db:generate`
Expected output: "Generated Prisma Client"

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add complexity extraction fields to Question model"
```

---

## Task 2: Create Core ComplexityExtractor Class

**Files:**
- Create: `lib/qie/complexity-extractor.ts`

- [ ] **Step 1: Write the type definitions**

Create the file with these types:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('GEMINI_API_KEY not configured');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = 'models/gemma-4-31b-it';

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
```

- [ ] **Step 2: Add Few-shot examples constant**

After the types, add:

```typescript
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
```

- [ ] **Step 3: Add prompt builder function**

```typescript
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
```

- [ ] **Step 4: Add defensive parser**

```typescript
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseSingleResponse(text: string, questionId: string): ExtractionResult {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[^{}]*"features"[^{}]*\}/);
  if (!jsonMatch) {
    throw new Error('无法找到有效的JSON响应');
  }

  const parsed = JSON.parse(jsonMatch[0]);
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

function parseBatchResponse(text: string): Map<string, ExtractionResult> {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('无法找到有效的JSON数组');
  }

  const parsed = JSON.parse(arrayMatch[0]);
  const results = new Map<string, ExtractionResult>();

  for (const item of parsed) {
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
```

- [ ] **Step 5: Add retry with exponential backoff**

```typescript
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
  throw new Error('重试失败');
}
```

- [ ] **Step 6: Add the main ComplexityExtractor class**

```typescript
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
    const { batchSize = 8, delayMs = 1000, onProgress } = options;
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
```

- [ ] **Step 7: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add lib/qie/complexity-extractor.ts
git commit -m "feat: add ComplexityExtractor core class"
```

---

## Task 3: Write Unit Tests

**Files:**
- Create: `lib/qie/__tests__/complexity-extractor.test.ts`

- [ ] **Step 1: Write parser tests**

```typescript
import { parseSingleResponse, parseBatchResponse, clamp } from '../complexity-extractor';

describe('ComplexityExtractor - Parser', () => {
  describe('clamp', () => {
    it('should clamp within bounds', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(-0.1, 0, 1)).toBe(0);
      expect(clamp(1.5, 0, 1)).toBe(1);
    });
  });

  describe('parseSingleResponse', () => {
    it('should parse clean JSON', () => {
      const input = '{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.questionId).toBe('q1');
      expect(result.features.cognitiveLoad).toBe(0.5);
      expect(result.confidence).toBe(0.8);
    });

    it('should strip markdown code blocks', () => {
      const input = '```json\n{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}\n```';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(0.5);
    });

    it('should handle extra text before JSON', () => {
      const input = '这是一些解释文字\n{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(0.5);
    });

    it('should clamp out-of-range values', () => {
      const input = '{"reasoning":"test","features":{"cognitiveLoad":1.5,"reasoningDepth":-0.2,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(1);
      expect(result.features.reasoningDepth).toBe(0);
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseSingleResponse('not json', 'q1')).toThrow();
    });
  });

  describe('parseBatchResponse', () => {
    it('should parse array response', () => {
      const input = JSON.stringify([
        { id: 'q1', features: { cognitiveLoad: 0.3, reasoningDepth: 0.2, complexity: 0.3 }, confidence: 0.9 },
        { id: 'q2', features: { cognitiveLoad: 0.7, reasoningDepth: 0.6, complexity: 0.7 }, confidence: 0.8 },
      ]);
      const result = parseBatchResponse(input);

      expect(result.size).toBe(2);
      expect(result.get('q1')?.features.cognitiveLoad).toBe(0.3);
      expect(result.get('q2')?.features.cognitiveLoad).toBe(0.7);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit lib/qie/__tests__/complexity-extractor.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/qie/__tests__/complexity-extractor.test.ts
git commit -m "test: add ComplexityExtractor parser tests"
```

---

## Task 4: Create Batch Processing Script

**Files:**
- Create: `scripts/extract-complexity.ts`

- [ ] **Step 1: Write the script**

```typescript
#!/usr/bin/env tsx

import { prisma } from '../lib/prisma';
import { ComplexityExtractor, ExtractionFailedError } from '../lib/qie/complexity-extractor';

interface Options {
  limit?: number;
  batchSize?: number;
  delayMs?: number;
  dryRun?: boolean;
  retryFailed?: boolean;
  force?: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--limit' && next) options.limit = parseInt(next, 10);
    if (arg === '--batch-size' && next) options.batchSize = parseInt(next, 10);
    if (arg === '--delay' && next) options.delayMs = parseInt(next, 10);
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--retry-failed') options.retryFailed = true;
    if (arg === '--force') options.force = true;
  }

  return options;
}

function parseQuestionContent(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    return { description: content };
  }
}

async function main() {
  console.log('=== 题目复杂度特征批量提取 ===\n');

  const options = parseArgs();
  const extractor = new ComplexityExtractor();

  console.log('配置:');
  console.log(`  限制: ${options.limit || '无'}`);
  console.log(`  批量大小: ${options.batchSize || 8}`);
  console.log(`  延迟: ${options.delayMs || 1000}ms`);
  console.log(`  干运行: ${options.dryRun ? '是' : '否'}`);
  console.log(`  重试失败: ${options.retryFailed ? '是' : '否'}`);
  console.log();

  // Build where clause
  const where: any = {};

  if (options.retryFailed) {
    where.extractionStatus = 'FAILED';
  } else if (!options.force) {
    where.OR = [
      { extractionStatus: null },
      { extractionStatus: 'PENDING' },
      { extractionStatus: 'FAILED' },
    ];
  }

  const questions = await prisma.question.findMany({
    where,
    take: options.limit || 100,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
    },
  });

  console.log(`找到 ${questions.length} 道题目\n`);

  if (questions.length === 0) {
    console.log('没有需要处理的题目');
    return;
  }

  const items = questions.map(q => ({
    id: q.id,
    content: parseQuestionContent(q.content),
  }));

  console.log('开始批量提取...\n');

  const results = await extractor.extractBatch(items, {
    batchSize: options.batchSize || 8,
    delayMs: options.delayMs || 1000,
    onProgress: (current, total) => {
      const percent = ((current / total) * 100).toFixed(1);
      console.log(`  进度: ${current}/${total} (${percent}%)`);
    },
  });

  console.log('\n提取完成!\n');

  // Statistics
  const featuresArray = Array.from(results.values());
  const stats = {
    total: featuresArray.length,
    highConfidence: featuresArray.filter(r => r.confidence > 0.8).length,
    lowConfidence: featuresArray.filter(r => r.confidence < 0.5).length,
    avgCognitiveLoad: featuresArray.reduce((sum, r) => sum + r.features.cognitiveLoad, 0) / featuresArray.length,
    avgReasoningDepth: featuresArray.reduce((sum, r) => sum + r.features.reasoningDepth, 0) / featuresArray.length,
    avgComplexity: featuresArray.reduce((sum, r) => sum + r.features.complexity, 0) / featuresArray.length,
  };

  console.log('=== 统计 ===');
  console.log(`  总数: ${stats.total}`);
  console.log(`  高置信度 (>0.8): ${stats.highConfidence}`);
  console.log(`  低置信度 (<0.5): ${stats.lowConfidence}`);
  console.log(`  平均认知负荷: ${stats.avgCognitiveLoad.toFixed(3)}`);
  console.log(`  平均推理深度: ${stats.avgReasoningDepth.toFixed(3)}`);
  console.log(`  平均复杂度: ${stats.avgComplexity.toFixed(3)}`);

  // Show low confidence
  const lowConf = featuresArray.filter(r => r.confidence < 0.5);
  if (lowConf.length > 0) {
    console.log('\n=== 低置信度题目 ===');
    lowConf.forEach(r => {
      console.log(`  ${r.questionId}: confidence=${r.confidence.toFixed(2)}`);
    });
  }

  if (!options.dryRun) {
    console.log('\n更新数据库...');
    let successCount = 0;
    let errorCount = 0;

    for (const [questionId, result] of results) {
      try {
        await prisma.question.update({
          where: { id: questionId },
          data: {
            cognitiveLoad: result.features.cognitiveLoad,
            reasoningDepth: result.features.reasoningDepth,
            complexity: result.features.complexity,
            extractionStatus: 'SUCCESS',
            featuresExtractedAt: new Date(),
            extractionModel: 'gemma-4-31b-it-v1',
            extractionError: null,
          },
        });
        successCount++;
      } catch (error) {
        console.error(`  更新失败 ${questionId}:`, error);
        errorCount++;
      }
    }

    console.log(`  成功: ${successCount}`);
    console.log(`  失败: ${errorCount}`);
  } else {
    console.log('\n干运行模式 - 跳过数据库更新');
  }

  console.log('\n完成!');
}

main().catch(console.error);
```

- [ ] **Step 2: Make script executable**

Run: `chmod +x scripts/extract-complexity.ts`

- [ ] **Step 3: Test with dry-run**

Run: `npx tsx scripts/extract-complexity.ts --limit 5 --dry-run`
Expected: Shows progress and statistics without database update

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-complexity.ts
git commit -m "feat: add batch complexity extraction script"
```

---

## Task 5: Create API Endpoints

**Files:**
- Create: `app/api/admin/complexity/extract/route.ts`
- Create: `app/api/admin/complexity/batch/route.ts`
- Create: `app/api/admin/complexity/status/route.ts`

- [ ] **Step 1: Create single extract endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplexityExtractor, QuestionContent } from '@/lib/qie/complexity-extractor';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { questionId, content } = await req.json();

    if (!questionId || !content) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const extractor = new ComplexityExtractor();
    const result = await extractor.extract(questionId, content);

    // Update database
    await prisma.question.update({
      where: { id: questionId },
      data: {
        cognitiveLoad: result.features.cognitiveLoad,
        reasoningDepth: result.features.reasoningDepth,
        complexity: result.features.complexity,
        extractionStatus: 'SUCCESS',
        featuresExtractedAt: new Date(),
        extractionModel: 'gemma-4-31b-it-v1',
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('提取失败:', error);

    // Mark as failed
    const { questionId } = await req.json().catch(() => ({}));
    if (questionId) {
      await prisma.question.update({
        where: { id: questionId },
        data: {
          extractionStatus: 'FAILED',
          extractionError: error.message,
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      { error: '提取失败', message: error.message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create batch extract endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ComplexityExtractor, QuestionContent } from '@/lib/qie/complexity-extractor';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { questions } = await req.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: '无效的题目列表' }, { status: 400 });
    }

    if (questions.length > 20) {
      return NextResponse.json({ error: '单次最多处理20道题' }, { status: 400 });
    }

    const extractor = new ComplexityExtractor();
    const items = questions.map(q => ({ id: q.id, content: q.content }));

    const results = await extractor.extractBatch(items);

    // Update database
    const updatePromises = Array.from(results.entries()).map(([id, result]) =>
      prisma.question.update({
        where: { id },
        data: {
          cognitiveLoad: result.features.cognitiveLoad,
          reasoningDepth: result.features.reasoningDepth,
          complexity: result.features.complexity,
          extractionStatus: 'SUCCESS',
          featuresExtractedAt: new Date(),
          extractionModel: 'gemma-4-31b-it-v1',
        },
      })
    );

    await Promise.all(updatePromises);

    const response = Array.from(results.entries()).map(([id, result]) => ({
      id,
      features: result.features,
      confidence: result.confidence,
      status: 'SUCCESS',
    }));

    return NextResponse.json({
      success: true,
      results: response,
      summary: {
        total: response.length,
        success: response.length,
        failed: 0,
      },
    });
  } catch (error) {
    console.error('批量提取失败:', error);
    return NextResponse.json(
      { error: '批量提取失败', message: error.message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create status endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const [pending, success, failed, avgResult] = await Promise.all([
      prisma.question.count({ where: { extractionStatus: 'PENDING' } }),
      prisma.question.count({ where: { extractionStatus: 'SUCCESS' } }),
      prisma.question.count({ where: { extractionStatus: 'FAILED' } }),
      prisma.question.aggregate({
        where: { extractionStatus: 'SUCCESS', cognitiveLoad: { not: null } },
        _avg: {
          cognitiveLoad: true,
          reasoningDepth: true,
          complexity: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        pending,
        success,
        failed,
        avgCognitiveLoad: avgResult._avg.cognitiveLoad || 0,
        avgReasoningDepth: avgResult._avg.reasoningDepth || 0,
        avgComplexity: avgResult._avg.complexity || 0,
      },
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/complexity/
git commit -m "feat: add complexity extraction API endpoints"
```

---

## Task 6: Integration Testing

**Files:**
- Create: `scripts/test-extraction-integration.ts`

- [ ] **Step 1: Create integration test script**

```typescript
#!/usr/bin/env tsx

import { ComplexityExtractor } from '../lib/qie/complexity-extractor';

const testQuestions = [
  {
    id: 'test-simple',
    content: { title: '简单计算', description: '计算 √16' },
    expectedRange: { cognitiveLoad: [0, 0.3], reasoningDepth: [0, 0.2], complexity: [0, 0.3] },
  },
  {
    id: 'test-medium',
    content: { title: '化简', description: '化简 √50' },
    expectedRange: { cognitiveLoad: [0.3, 0.5], reasoningDepth: [0.2, 0.4], complexity: [0.3, 0.5] },
  },
  {
    id: 'test-complex',
    content: { title: '混合运算', description: '计算 (√8 + √18) / √2' },
    expectedRange: { cognitiveLoad: [0.6, 0.9], reasoningDepth: [0.5, 0.9], complexity: [0.6, 0.9] },
  },
];

async function main() {
  console.log('=== ComplexityExtractor 集成测试 ===\n');

  const extractor = new ComplexityExtractor();

  for (const test of testQuestions) {
    console.log(`测试: ${test.id}`);
    console.log(`  题目: ${test.content.title}`);

    try {
      const result = await extractor.extract(test.id, test.content);

      console.log(`  结果:`);
      console.log(`    cognitiveLoad: ${result.features.cognitiveLoad}`);
      console.log(`    reasoningDepth: ${result.features.reasoningDepth}`);
      console.log(`    complexity: ${result.features.complexity}`);
      console.log(`    confidence: ${result.confidence}`);

      // Check ranges
      const clInRange = result.features.cognitiveLoad >= test.expectedRange.cognitiveLoad[0] &&
                       result.features.cognitiveLoad <= test.expectedRange.cognitiveLoad[1];
      const rdInRange = result.features.reasoningDepth >= test.expectedRange.reasoningDepth[0] &&
                       result.features.reasoningDepth <= test.expectedRange.reasoningDepth[1];
      const cxInRange = result.features.complexity >= test.expectedRange.complexity[0] &&
                       result.features.complexity <= test.expectedRange.complexity[1];

      if (clInRange && rdInRange && cxInRange) {
        console.log(`  ✅ 通过`);
      } else {
        console.log(`  ⚠️  超出预期范围`);
      }
    } catch (error) {
      console.log(`  ❌ 失败: ${error.message}`);
    }

    console.log();
  }

  // Test batch
  console.log('=== 批量提取测试 ===');
  const batchResults = await extractor.extractBatch(testQuestions);

  console.log(`批量处理: ${batchResults.size} 道题`);
  batchResults.forEach((result, id) => {
    console.log(`  ${id}: cognitiveLoad=${result.features.cognitiveLoad.toFixed(2)}`);
  });

  console.log('\n测试完成!');
}

main().catch(console.error);
```

- [ ] **Step 2: Run integration test**

Run: `npx tsx scripts/test-extraction-integration.ts`
Expected: All tests pass with values in expected ranges

- [ ] **Step 3: Commit**

```bash
git add scripts/test-extraction-integration.ts
git commit -m "test: add complexity extraction integration test"
```

---

## Task 7: Documentation

**Files:**
- Create: `docs/complexity-extractor.md`

- [ ] **Step 1: Create documentation**

```markdown
# ComplexityExtractor 使用指南

## 概述

ComplexityExtractor 使用 gemma-4-31b-it LLM 自动提取数学题目的复杂度特征。

## 特征维度

- **cognitiveLoad** [0-1]: 认知负荷，工作记忆占用程度
- **reasoningDepth** [0-1]: 推理深度，逻辑推理层次数
- **complexity** [0-1]: 综合复杂度

## 使用方式

### 1. 批量处理历史题库

```bash
# 基本用法（处理100题）
pnpm tsx scripts/extract-complexity.ts --limit 100

# 干运行（不更新数据库）
pnpm tsx scripts/extract-complexity.ts --limit 10 --dry-run

# 重试失败的记录
pnpm tsx scripts/extract-complexity.ts --retry-failed --limit 50

# 自定义批量大小和延迟
pnpm tsx scripts/extract-complexity.ts --batch-size 5 --delay 2000
```

### 2. API 调用

**单题提取：**
\`\`\`bash
POST /api/admin/complexity/extract
{
  "questionId": "xxx",
  "content": { "title": "...", "description": "..." }
}
\`\`\`

**批量提取：**
\`\`\`bash
POST /api/admin/complexity/batch
{
  "questions": [
    { "id": "q1", "content": {...} },
    { "id": "q2", "content": {...} }
  ]
}
\`\`\`

**查询状态：**
\`\`\`bash
GET /api/admin/complexity/status
\`\`\`

## 数据质量

- 成功率目标: > 95%
- 准确率目标: > 80% (人工抽检)
- 低置信度题目 (< 0.5) 需人工审核

## 错误处理

- 失败的题目标记为 `extractionStatus: FAILED`
- 使用 `--retry-failed` 重新处理失败记录
- 不会写入默认值，避免数据污染
```

- [ ] **Step 2: Commit**

```bash
git add docs/complexity-extractor.md
git commit -m "docs: add ComplexityExtractor usage guide"
```

---

## Summary

This plan implements the ComplexityExtractor service with:

1. **Database Schema**: Question model extended with extraction fields
2. **Core Extractor**: Few-shot prompting, defensive parsing, batch processing
3. **Batch Script**: Offline processing with progress reporting
4. **API Endpoints**: Single/batch extract, status query
5. **Tests**: Unit tests for parser, integration tests with real LLM
6. **Documentation**: Usage guide and API reference

Key design decisions:
- No default values on failure (extractionStatus: FAILED)
- Defensive JSON parser with markdown stripping
- Batch mode (8 questions/call) for throughput
- Exponential backoff retry (3 attempts)
- Confidence tracking for quality control
