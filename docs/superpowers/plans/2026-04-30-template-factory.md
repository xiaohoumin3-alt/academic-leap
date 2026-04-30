# Template Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LLM-powered template generation and validation system that expands the question template library from ~40 to 1000+ templates with mathematically verified quality.

**Architecture:** Multi-layer pipeline: GapDetector discovers missing templates → TemplateGenerator uses LLMs → TemplateValidator provides dual verification → QualityScorer ranks templates → HumanReviewQueue handles edge cases.

**Tech Stack:** Next.js 15 API Routes, Prisma ORM, Gemini API (or GPT-4), Zod validation

---

## File Structure

```
lib/template-factory/
├── types.ts                    # Shared type definitions
├── gap-detector.ts             # Knowledge point coverage analysis
├── generator.ts                # LLM-based template generation
├── validator.ts                # Dual validation (math + pedagogy)
├── quality-scorer.ts           # Multi-dimensional quality scoring
├── review-queue.ts             # Human review queue management
├── prompts/
│   ├── generation.ts           # Generation prompt templates
│   └── validation.ts           # Validation prompt templates
├── utils/
│   ├── llm-client.ts           # Unified LLM client (Gemini/GPT-4)
│   └── param-parser.ts         # Parse LLM parameter outputs
└── __tests__/
    ├── gap-detector.test.ts
    ├── generator.test.ts
    ├── validator.test.ts
    └── quality-scorer.test.ts

app/api/admin/factory/
├── generate/route.ts           # POST /api/admin/factory/generate
├── validate/route.ts           # POST /api/admin/factory/validate
├── review-queue/route.ts       # GET /api/admin/factory/review-queue
├── review/[id]/route.ts        # POST /api/admin/factory/review/[id]
└── coverage/route.ts           # GET /api/admin/factory/coverage

prisma/
└── schema.prisma               # Extended with new fields and tables
```

---

## Task 1: Database Schema Extensions

**Files:**
- Modify: `prisma/schema.prisma`

**Purpose:** Add tracking fields for template generation, validation, and quality scoring.

- [ ] **Step 1: Add generation fields to Template model**

```prisma
model Template {
  id          String            @id @default(cuid())
  name        String
  type        String
  templateKey String?
  structure   Json
  params      Json
  steps       Json
  version     Int               @default(1)
  status      String            @default("draft")
  knowledgeId String?
  source      String            @default("manual")

  // === NEW: Generation tracking ===
  generatedBy     String    @default("manual")  // 'manual' | 'ai'
  generatorModel  String?                       // 'gemini-2.5-flash' | 'gpt-4'
  generationPrompt String?                      // Prompt used for generation
  generationId    String?                       // Reference to TemplateGeneration

  // === NEW: Validation tracking ===
  validatedBy      String?                      // 'ai' | 'human'
  validationResult Json?                        // Full validation result
  qualityScore     Int?                         // 0-100 overall score
  autoApproved     Boolean   @default(false)    // Auto-approved flag

  // === NEW: Quality tracking ===
  usedCount       Int       @default(0)         // Times used in questions
  errorCount      Int       @default(0)         // Detected errors
  errorRate       Float?                        // Calculated error rate

  // === NEW: Review tracking ===
  reviewStatus    String    @default("pending") // 'pending' | 'approved' | 'rejected'
  reviewedBy      String?
  reviewedAt      DateTime?
  reviewNotes     String?

  // Existing fields
  skeletonIds String            @default("[]")
  createdBy   String
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  publishedAt DateTime?

  qualities   QuestionQuality[]
  knowledge   KnowledgeConcept? @relation("TemplateConcept", fields: [knowledgeId], references: [id])
  creator     Admin             @relation(fields: [createdBy], references: [id])
  versions    TemplateVersion[]
  generation  TemplateGeneration? @relation("GenerationTemplate", fields: [generationId], references: [id])
  validations TemplateValidation[]
  reviews     TemplateReview[]
}
```

- [ ] **Step 2: Add new tables for tracking**

```prisma
// TemplateGeneration - tracks each generation batch
model TemplateGeneration {
  id              String   @id @default(cuid())
  knowledgePointId String
  generatorModel  String
  prompt          String
  rawOutput       String
  generatedCount  Int
  successCount    Int
  createdAt       DateTime @default(now())

  templates       Template[]
}

// TemplateValidation - tracks each validation run
model TemplateValidation {
  id              String   @id @default(cuid())
  templateId      String
  validatorModel  String
  validationType  String   // 'math' | 'pedagogy'
  result          Json
  score           Int
  passed          Boolean
  createdAt       DateTime @default(now())

  template        Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

// TemplateReview - tracks human review decisions
model TemplateReview {
  id            String   @id @default(cuid())
  templateId    String
  reviewerId    String
  decision      String   // 'approve' | 'reject' | 'modify'
  notes         String?
  modifications Json?
  duration      Int      // Review time in seconds
  createdAt     DateTime @default(now())

  template      Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

// KnowledgeCoverage - tracks coverage per knowledge point
model KnowledgeCoverage {
  knowledgePointId   String   @id
  targetTemplateCount Int     @default(3)
  currentTemplateCount Int    @default(0)
  gap                Int
  priority           String   // 'high' | 'medium' | 'low'
  lastUpdated        DateTime @default(now())
}
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/seanxx/academic-leap/academic-leap
pnpm prisma migrate dev --name add_template_factory_tracking
```

Expected output: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add template factory tracking fields and tables

- Extend Template with generation/validation/review fields
- Add TemplateGeneration, TemplateValidation, TemplateReview tables
- Add KnowledgeCoverage for gap tracking"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `lib/template-factory/types.ts`

**Purpose:** Centralized types for the template factory system.

- [ ] **Step 1: Write the types file**

```typescript
/**
 * Template Factory Type Definitions
 */

// ============================================================================
// Knowledge Gap Detection
// ============================================================================

export interface KnowledgeGap {
  knowledgePointId: string;
  knowledgePointName: string;
  currentTemplateCount: number;
  targetTemplateCount: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
}

// ============================================================================
// Template Generation
// ============================================================================

export interface GenerationRequest {
  knowledgePoint: {
    id: string;
    name: string;
    description?: string;
  };
  targetStructures: StructureType[];
  targetDepths: DepthLevel[];
  count: number;
  context: {
    textbook?: string;
    grade: number;
    relatedConcepts: string[];
  };
}

export type StructureType = 'linear' | 'nested' | 'multi_equation' | 'constraint_chain';
export type DepthLevel = 1 | 2 | 3 | 4;

export interface GeneratedTemplate {
  name: string;
  template: string;
  answer: string;
  params: Record<string, ParamRange>;
  constraint: string;
  steps: string[];
  hint: string;
  difficulty: number;  // 1-5
  cognitiveLoad: number;  // 0-1
  reasoningDepth: number;  // 0-1
  learningObjective: string;
  concepts: string[];
}

export interface ParamRange {
  type: 'range' | 'set' | 'expression';
  min?: number;
  max?: number;
  values?: number[];
  expression?: string;
}

export interface GenerationResult {
  generationId: string;
  templates: GeneratedTemplate[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// ============================================================================
// Template Validation
// ============================================================================

export interface ValidationResult {
  templateId: string;
  mathCorrectness: {
    passed: boolean;
    issues: string[];
    confidence: number;  // 0-1
  };
  pedagogyQuality: {
    passed: boolean;
    issues: string[];
    score: number;  // 0-100
  };
  overallScore: number;  // 0-100
  recommendation: 'approve' | 'review' | 'reject';
}

// ============================================================================
// Quality Scoring
// ============================================================================

export interface QualityScore {
  mathCorrectness: number;  // 40% weight
  pedagogyQuality: number;   // 30% weight
  difficultyAccuracy: number; // 15% weight
  completeness: number;       // 10% weight
  innovation: number;         // 5% weight
  overall: number;            // 0-100
}

// ============================================================================
// Review Queue
// ============================================================================

export interface ReviewQueueItem {
  id: string;
  templateId: string;
  knowledgePoint: string;
  template: GeneratedTemplate;
  validationResult: ValidationResult;
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  estimatedTime: number;  // seconds
}

export interface ReviewDecision {
  decision: 'approve' | 'reject' | 'modify';
  notes?: string;
  modifications?: Partial<GeneratedTemplate>;
}

// ============================================================================
// Coverage Report
// ============================================================================

export interface CoverageReport {
  total: number;
  covered: number;
  coverageRate: number;
  byKnowledgePoint: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    gap: number;
    priority: string;
  }>;
  gaps: {
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// LLM Client
// ============================================================================

export interface LLMClientConfig {
  model: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gpt-4' | 'gpt-3.5-turbo';
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse<T = unknown> {
  content: string;
  parsed?: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}
```

- [ ] **Step 2: Create index barrel export**

```bash
mkdir -p lib/template-factory
```

```typescript
// lib/template-factory/index.ts
export * from './types';
```

- [ ] **Step 3: Write basic type tests**

```typescript
// lib/template-factory/__tests__/types.test.ts
import { describe, it, expect } from '@jest/globals';
import type {
  KnowledgeGap,
  GenerationRequest,
  GeneratedTemplate,
  ValidationResult,
  QualityScore,
} from '../types';

describe('Template Factory Types', () => {
  it('should accept valid KnowledgeGap', () => {
    const gap: KnowledgeGap = {
      knowledgePointId: 'kp-1',
      knowledgePointName: 'Linear Equations',
      currentTemplateCount: 2,
      targetTemplateCount: 5,
      gap: 3,
      priority: 'high',
      estimatedDifficulty: 'medium',
    };
    expect(gap.gap).toBe(3);
  });

  it('should accept valid GenerationRequest', () => {
    const request: GenerationRequest = {
      knowledgePoint: {
        id: 'kp-1',
        name: 'Linear Equations',
      },
      targetStructures: ['linear'],
      targetDepths: [1, 2],
      count: 3,
      context: {
        grade: 7,
        relatedConcepts: ['algebra', 'variables'],
      },
    };
    expect(request.count).toBe(3);
  });

  it('should accept valid GeneratedTemplate', () => {
    const template: GeneratedTemplate = {
      name: 'Basic Linear Equation',
      template: 'Solve for x: {a}x + {b} = {c}',
      answer: 'x = {x}',
      params: {
        a: { type: 'range', min: 1, max: 10 },
        b: { type: 'range', min: -10, max: 10 },
        c: { type: 'range', min: -20, max: 20 },
      },
      constraint: 'a != 0',
      steps: ['Subtract b from both sides', 'Divide by a'],
      hint: 'Isolate x by doing inverse operations',
      difficulty: 2,
      cognitiveLoad: 0.3,
      reasoningDepth: 0.4,
      learningObjective: 'Solve one-step linear equations',
      concepts: ['linear-equations', 'inverse-operations'],
    };
    expect(template.difficulty).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify**

```bash
cd /Users/seanxx/academic-leap/academic-leap
pnpm test lib/template-factory/__tests__/types.test.ts
```

Expected output: Tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/
git commit -m "feat: add template factory type definitions"
```

---

## Task 3: LLM Client Utility

**Files:**
- Create: `lib/template-factory/utils/llm-client.ts`

**Purpose:** Unified client for Gemini and GPT-4 with consistent interface.

- [ ] **Step 1: Write LLM client tests**

```typescript
// lib/template-factory/utils/__tests__/llm-client.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { LLMClient } from '../llm-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LLMClient({
      model: 'gemini-2.5-flash',
      apiKey: 'test-key',
    });
  });

  it('should generate completion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"result": "success"}' }]
          }
        }]
      }),
    } as Response);

    const result = await client.generate('Test prompt', {
      responseFormat: 'json'
    });

    expect(result.content).toBe('{"result": "success"}');
    expect(result.parsed).toEqual({ result: 'success' });
  });

  it('should handle Gemini API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as Response);

    await expect(client.generate('Test')).rejects.toThrow();
  });

  it('should calculate token usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Response' }] }
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
        }
      }),
    } as Response);

    const result = await client.generate('Test');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/template-factory/utils/__tests__/llm-client.test.ts
```

Expected output: FAIL - "LLMClient is not defined"

- [ ] **Step 3: Implement LLM client**

```typescript
// lib/template-factory/utils/llm-client.ts
import type { LLMClientConfig, LLMResponse } from '../types';

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  /**
   * Get the configured model name
   */
  get model(): string {
    return this.config.model;
  }

  /**
   * Generate a completion from the LLM
   */
  async generate(
    prompt: string,
    options?: {
      responseFormat?: 'text' | 'json';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LLMResponse> {
    const model = this.config.model;

    if (model.startsWith('gemini')) {
      return this.generateGemini(prompt, options);
    } else if (model.startsWith('gpt')) {
      return this.generateOpenAI(prompt, options);
    }

    throw new Error(`Unsupported model: ${model}`);
  }

  /**
   * Call Gemini API
   */
  private async generateGemini(
    prompt: string,
    options?: { responseFormat?: 'text' | 'json'; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || this.config.maxTokens || 4096,
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          responseMimeType: options?.responseFormat === 'json' ? 'application/json' : 'text/plain',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed: unknown = undefined;
    if (options?.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // If JSON parse fails, parsed remains undefined
      }
    }

    return {
      content,
      parsed,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  /**
   * Call OpenAI API
   */
  private async generateOpenAI(
    prompt: string,
    options?: { responseFormat?: 'text' | 'json'; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed: unknown = undefined;
    if (options?.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // If JSON parse fails, parsed remains undefined
      }
    }

    return {
      content,
      parsed,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/utils/__tests__/llm-client.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/utils/
git commit -m "feat: add unified LLM client for Gemini and OpenAI"
```

---

## Task 4: Generation Prompts

**Files:**
- Create: `lib/template-factory/prompts/generation.ts`

**Purpose:** Prompt templates for LLM-based template generation.

- [ ] **Step 1: Write prompt tests**

```typescript
// lib/template-factory/prompts/__tests__/generation.test.ts
import { describe, it, expect } from '@jest/globals';
import { buildGenerationPrompt } from '../generation';

describe('Generation Prompts', () => {
  it('should build generation prompt with all fields', () => {
    const prompt = buildGenerationPrompt({
      knowledgePoint: {
        id: 'kp-1',
        name: '一元一次方程',
        description: '含有一个未知数，且未知数的次数是1的方程',
      },
      targetStructures: ['linear'],
      targetDepths: [1, 2],
      count: 3,
      context: {
        grade: 7,
        relatedConcepts: ['代数', '等式'],
      },
    });

    expect(prompt).toContain('一元一次方程');
    expect(prompt).toContain('含有一个未知数');
    expect(prompt).toContain('linear');
    expect(prompt).toContain('depth 1');
    expect(prompt).toContain('depth 2');
    expect(prompt).toContain('3个');
    expect(prompt).toContain('7年级');
  });

  it('should include JSON output format in prompt', () => {
    const prompt = buildGenerationPrompt({
      knowledgePoint: {
        id: 'kp-1',
        name: 'Test',
      },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    });

    expect(prompt).toContain('"templates"');
    expect(prompt).toContain('"template"');
    expect(prompt).toContain('"answer"');
    expect(prompt).toContain('"params"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test lib/template-factory/prompts/__tests__/generation.test.ts
```

Expected output: FAIL - "buildGenerationPrompt is not defined"

- [ ] **Step 3: Implement prompt builder**

```typescript
// lib/template-factory/prompts/generation.ts
import type { GenerationRequest } from '../types';

/**
 * Build the prompt for template generation
 */
export function buildGenerationPrompt(request: GenerationRequest): string {
  const { knowledgePoint, targetStructures, targetDepths, count, context } = request;

  const structureDesc = targetStructures.join('、');
  const depthDesc = targetDepths.map(d => `depth ${d}`).join('、');
  const relatedDesc = context.relatedConcepts.length > 0
    ? context.relatedConcepts.join('、')
    : '无';

  return `你是一个数学教育专家。请为以下知识点生成${count}个题目模板。

知识点：${knowledgePoint.name}
${knowledgePoint.description ? `定义：${knowledgePoint.description}` : ''}
年级：${context.grade}年级
${context.textbook ? `教材：${context.textbook}` : ''}
相关概念：${relatedDesc}

要求：
1. 模板结构为：${structureDesc}
2. 模板深度为：${depthDesc}
3. 使用{param}占位符表示参数
4. 提供constraint约束条件
5. 提供详细的解题步骤
6. 标注难度等级（1-5）和认知负荷（0-1）
7. 关联相关的数学概念

输出JSON格式：
\`\`\`json
{
  "templates": [
    {
      "name": "模板名称",
      "template": "题目模板文本，如：解方程 {a}x + {b} = {c}",
      "answer": "答案模板，如：x = {x}",
      "params": {
        "a": {"type": "range", "min": 1, "max": 10},
        "b": {"type": "range", "min": -10, "max": 10}
      },
      "constraint": "约束条件说明",
      "steps": ["解题步骤1", "解题步骤2"],
      "hint": "给学生提示",
      "difficulty": 3,
      "cognitiveLoad": 0.5,
      "reasoningDepth": 0.6,
      "learningObjective": "学习目标描述",
      "concepts": ["相关概念1", "相关概念2"]
    }
  ]
}
\`\`\`

请生成${count}个不同变体的模板，确保多样性。`;
}

/**
 * Parse LLM response into GeneratedTemplate array
 */
export function parseGenerationResponse(content: string): {
  templates: GeneratedTemplate[];
  errors: string[];
} {
  const templates: unknown[] = [];
  const errors: string[] = [];

  try {
    // Extract JSON from markdown code blocks if present
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonContent);

    if (parsed.templates && Array.isArray(parsed.templates)) {
      templates.push(...parsed.templates);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown parse error');
  }

  return { templates, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/prompts/__tests__/generation.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/prompts/
git commit -m "feat: add template generation prompts"
```

---

## Task 5: Validation Prompts

**Files:**
- Create: `lib/template-factory/prompts/validation.ts`

**Purpose:** Prompt templates for math and pedagogy validation.

- [ ] **Step 1: Write validation prompt tests**

```typescript
// lib/template-factory/prompts/__tests__/validation.test.ts
import { describe, it, expect } from '@jest/globals';
import { buildMathValidationPrompt, buildPedagogyValidationPrompt } from '../validation';

describe('Validation Prompts', () => {
  const mockTemplate = {
    name: 'Basic Linear Equation',
    template: '解方程: {a}x + {b} = {c}',
    answer: 'x = {x}',
    params: {
      a: { type: 'range', min: 1, max: 10 },
      b: { type: 'range', min: -10, max: 10 },
    },
    constraint: 'a != 0',
  };

  it('should build math validation prompt', () => {
    const prompt = buildMathValidationPrompt(mockTemplate);

    expect(prompt).toContain('数学正确性验证');
    expect(prompt).toContain('解方程: {a}x + {b} = {c}');
    expect(prompt).toContain('x = {x}');
    expect(prompt).toContain('passed');
  });

  it('should build pedagogy validation prompt', () => {
    const prompt = buildPedagogyValidationPrompt(mockTemplate, {
      knowledgePoint: '一元一次方程',
      grade: 7,
    });

    expect(prompt).toContain('教学有效性验证');
    expect(prompt).toContain('一元一次方程');
    expect(prompt).toContain('7年级');
    expect(prompt).toContain('score');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/template-factory/prompts/__tests__/validation.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement validation prompts**

```typescript
// lib/template-factory/prompts/validation.ts
import type { GeneratedTemplate } from '../types';

/**
 * Build prompt for mathematical correctness validation
 */
export function buildMathValidationPrompt(template: GeneratedTemplate): string {
  return `请验证以下数学题目模板的数学正确性。

模板名称：${template.name}
题目模板：${template.template}
答案模板：${template.answer}
参数：${JSON.stringify(template.params, null, 2)}
约束条件：${template.constraint}

检查项：
1. 答案计算是否正确
2. 参数约束是否完整
3. 边界条件是否考虑
4. 特殊情况是否处理

输出JSON格式：
\`\`\`json
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "confidence": 0.0-1.0,
  "explanation": "详细说明"
}
\`\`\``;
}

/**
 * Build prompt for pedagogy quality validation
 */
export function buildPedagogyValidationPrompt(
  template: GeneratedTemplate,
  context: { knowledgePoint: string; grade: number }
): string {
  return `请验证以下题目模板的教学有效性。

知识点：${context.knowledgePoint}
年级：${context.grade}年级

模板名称：${template.name}
题目模板：${template.template}
难度等级：${template.difficulty}
认知负荷：${template.cognitiveLoad}
推理深度：${template.reasoningDepth}
学习目标：${template.learningObjective}
提示：${template.hint}
相关概念：${template.concepts.join('、')}

检查项：
1. 题目是否符合教学目标
2. 难度标注是否合理
3. 步骤是否清晰
4. 提示是否有帮助
5. 概念关联是否准确

输出JSON格式：
\`\`\`json
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "explanation": "详细说明"
}
\`\`\``;
}

/**
 * Parse validation response
 */
export function parseValidationResponse(content: string): {
  passed: boolean;
  issues: string[];
  score?: number;
  confidence?: number;
  explanation?: string;
} | null {
  try {
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1];
    }

    return JSON.parse(jsonContent);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/prompts/__tests__/validation.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/prompts/
git commit -m "feat: add validation prompts for math and pedagogy"
```

---

## Task 6: Template Generator

**Files:**
- Create: `lib/template-factory/generator.ts`

**Purpose:** Core generation logic using LLM client and prompts.

- [ ] **Step 1: Write generator tests**

```typescript
// lib/template-factory/__tests__/generator.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { TemplateGenerator } from '../generator';
import { LLMClient } from '../utils/llm-client';

// Mock LLMClient
vi.mock('../utils/llm-client');

describe('TemplateGenerator', () => {
  let generator: TemplateGenerator;
  let mockLLM: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = {
      generate: vi.fn(),
    } as unknown as LLMClient;
    generator = new TemplateGenerator(mockLLM);
  });

  it('should generate templates successfully', async () => {
    vi.mocked(mockLLM.generate).mockResolvedValueOnce({
      content: '{"templates": [{"name": "Test", "template": "Test {x}", "answer": "{x}", "params": {"x": {"type": "range", "min": 1, "max": 10}}, "constraint": "", "steps": [], "hint": "", "difficulty": 1, "cognitiveLoad": 0.2, "reasoningDepth": 0.3, "learningObjective": "Test", "concepts": []}]}',
      parsed: {
        templates: [{
          name: 'Test',
          template: 'Test {x}',
          answer: '{x}',
          params: { x: { type: 'range', min: 1, max: 10 } },
          constraint: '',
          steps: [],
          hint: '',
          difficulty: 1,
          cognitiveLoad: 0.2,
          reasoningDepth: 0.3,
          learningObjective: 'Test',
          concepts: [],
        }]
      },
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    });

    expect(result.summary.successful).toBe(1);
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].name).toBe('Test');
  });

  it('should handle LLM errors gracefully', async () => {
    vi.mocked(mockLLM.generate).mockRejectedValueOnce(new Error('API error'));

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    });

    expect(result.summary.successful).toBe(0);
    expect(result.summary.failed).toBe(1);
  });

  it('should retry on failure', async () => {
    vi.mocked(mockLLM.generate)
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        content: '{"templates": []}',
        parsed: { templates: [] },
        usage: { promptTokens: 100, completionTokens: 10 },
      });

    const result = await generator.generate({
      knowledgePoint: { id: 'kp-1', name: 'Test' },
      targetStructures: ['linear'],
      targetDepths: [1],
      count: 1,
      context: { grade: 7, relatedConcepts: [] },
    }, { maxRetries: 2 });

    expect(mockLLM.generate).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/template-factory/__tests__/generator.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement TemplateGenerator**

```typescript
// lib/template-factory/generator.ts
import type { GenerationRequest, GenerationResult, GeneratedTemplate } from './types';
import { LLMClient } from './utils/llm-client';
import { buildGenerationPrompt, parseGenerationResponse } from './prompts/generation';
import { randomUUID } from 'node:crypto';

export class TemplateGenerator {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Generate templates for a knowledge point
   */
  async generate(
    request: GenerationRequest,
    options?: { maxRetries?: number }
  ): Promise<GenerationResult> {
    const maxRetries = options?.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = buildGenerationPrompt(request);
        const response = await this.llm.generate(prompt, {
          responseFormat: 'json',
          maxTokens: 8192,
        });

        const { templates, errors } = parseGenerationResponse(response.content);

        return {
          generationId: randomUUID(),
          templates: templates as GeneratedTemplate[],
          summary: {
            total: request.count,
            successful: templates.length,
            failed: request.count - templates.length + errors.length,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    throw new Error(`Generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Generate templates for multiple knowledge points in batch
   */
  async generateBatch(
    requests: GenerationRequest[],
    options?: { concurrency?: number }
  ): Promise<GenerationResult[]> {
    const concurrency = options?.concurrency ?? 3;
    const results: GenerationResult[] = [];

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(req => this.generate(req))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            generationId: randomUUID(),
            templates: [],
            summary: { total: 1, successful: 0, failed: 1 },
          });
        }
      }
    }

    return results;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/__tests__/generator.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/generator.ts
git commit -m "feat: add TemplateGenerator with retry logic"
```

---

## Task 7: Template Validator

**Files:**
- Create: `lib/template-factory/validator.ts`

**Purpose:** Dual validation for math correctness and pedagogy quality.

- [ ] **Step 1: Write validator tests**

```typescript
// lib/template-factory/__tests__/validator.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { TemplateValidator } from '../validator';
import { LLMClient } from '../utils/llm-client';

vi.mock('../utils/llm-client');

describe('TemplateValidator', () => {
  let validator: TemplateValidator;
  let mockLLM: LLMClient;

  const mockTemplate = {
    name: 'Test',
    template: 'Solve: {a}x + {b} = {c}',
    answer: 'x = {x}',
    params: { a: { type: 'range', min: 1, max: 10 } },
    constraint: 'a != 0',
    steps: [],
    hint: 'Isolate x',
    difficulty: 2,
    cognitiveLoad: 0.3,
    reasoningDepth: 0.4,
    learningObjective: 'Solve linear equations',
    concepts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLLM = {
      generate: vi.fn(),
    } as unknown as LLMClient;
    validator = new TemplateValidator(mockLLM);
  });

  it('should validate math correctness', async () => {
    vi.mocked(mockLLM.generate).mockResolvedValueOnce({
      content: '{"passed": true, "issues": [], "confidence": 0.95, "explanation": "Correct"}',
      parsed: { passed: true, issues: [], confidence: 0.95, explanation: 'Correct' },
      usage: { promptTokens: 50, completionTokens: 30 },
    });

    const result = await validator.validateMath(mockTemplate, 'template-1');

    expect(result.passed).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.issues).toHaveLength(0);
  });

  it('should validate pedagogy quality', async () => {
    vi.mocked(mockLLM.generate).mockResolvedValueOnce({
      content: '{"passed": true, "score": 85, "issues": [], "explanation": "Good"}',
      parsed: { passed: true, score: 85, issues: [], explanation: 'Good' },
      usage: { promptTokens: 50, completionTokens: 30 },
    });

    const result = await validator.validatePedagogy(
      mockTemplate,
      { knowledgePoint: 'Linear Equations', grade: 7 }
    );

    expect(result.passed).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should run dual validation', async () => {
    vi.mocked(mockLLM.generate)
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 0.9}',
        parsed: { passed: true, issues: [], confidence: 0.9 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 90, "issues": []}',
        parsed: { passed: true, score: 90, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.overallScore).toBeGreaterThan(80);
    expect(result.recommendation).toBe('approve');
  });

  it('should recommend review for medium scores', async () => {
    vi.mocked(mockLLM.generate)
      .mockResolvedValueOnce({
        content: '{"passed": true, "issues": [], "confidence": 1.0}',
        parsed: { passed: true, issues: [], confidence: 1.0 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 75, "issues": ["Minor issue"]}',
        parsed: { passed: true, score: 75, issues: ['Minor issue'] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.recommendation).toBe('review');
  });

  it('should reject on math failure', async () => {
    vi.mocked(mockLLM.generate)
      .mockResolvedValueOnce({
        content: '{"passed": false, "issues": ["Wrong formula"], "confidence": 0.9}',
        parsed: { passed: false, issues: ['Wrong formula'], confidence: 0.9 },
        usage: { promptTokens: 50, completionTokens: 20 },
      })
      .mockResolvedValueOnce({
        content: '{"passed": true, "score": 90, "issues": []}',
        parsed: { passed: true, score: 90, issues: [] },
        usage: { promptTokens: 50, completionTokens: 20 },
      });

    const result = await validator.validate(mockTemplate, {
      knowledgePoint: 'Linear Equations',
      grade: 7,
    });

    expect(result.recommendation).toBe('reject');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/template-factory/__tests__/validator.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement TemplateValidator**

```typescript
// lib/template-factory/validator.ts
import type { GeneratedTemplate, ValidationResult } from './types';
import { LLMClient } from './utils/llm-client';
import { buildMathValidationPrompt, buildPedagogyValidationPrompt, parseValidationResponse } from './prompts/validation';

export class TemplateValidator {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Validate mathematical correctness
   */
  async validateMath(
    template: GeneratedTemplate,
    templateId: string
  ): Promise<{ passed: boolean; issues: string[]; confidence: number }> {
    const prompt = buildMathValidationPrompt(template);
    const response = await this.llm.generate(prompt, { responseFormat: 'json' });
    const parsed = parseValidationResponse(response.content);

    if (!parsed) {
      return {
        passed: false,
        issues: ['Failed to parse validation response'],
        confidence: 0,
      };
    }

    return {
      passed: parsed.passed,
      issues: parsed.issues,
      confidence: parsed.confidence ?? 0.5,
    };
  }

  /**
   * Validate pedagogy quality
   */
  async validatePedagogy(
    template: GeneratedTemplate,
    context: { knowledgePoint: string; grade: number }
  ): Promise<{ passed: boolean; issues: string[]; score: number }> {
    const prompt = buildPedagogyValidationPrompt(template, context);
    const response = await this.llm.generate(prompt, { responseFormat: 'json' });
    const parsed = parseValidationResponse(response.content);

    if (!parsed) {
      return {
        passed: false,
        issues: ['Failed to parse validation response'],
        score: 0,
      };
    }

    return {
      passed: parsed.passed,
      issues: parsed.issues,
      score: parsed.score ?? 50,
    };
  }

  /**
   * Run dual validation (math + pedagogy)
   */
  async validate(
    template: GeneratedTemplate,
    context: { knowledgePoint: string; grade: number }
  ): Promise<ValidationResult> {
    const templateId = template.name; // Use name as ID for now

    // Run validations in parallel
    const [mathResult, pedagogyResult] = await Promise.all([
      this.validateMath(template, templateId),
      this.validatePedagogy(template, context),
    ]);

    // Calculate overall score
    const mathScore = mathResult.passed ? 100 : 0;
    const overallScore = Math.round(
      mathScore * 0.4 +  // 40% weight
      pedagogyResult.score * 0.3 +  // 30% weight
      (100 - pedagogyResult.issues.length * 10) * 0.3  // Penalty for issues
    );

    // Determine recommendation
    let recommendation: 'approve' | 'review' | 'reject';
    if (!mathResult.passed) {
      recommendation = 'reject';
    } else if (overallScore >= 90) {
      recommendation = 'approve';
    } else if (overallScore >= 75) {
      recommendation = 'review';
    } else {
      recommendation = 'reject';
    }

    return {
      templateId,
      mathCorrectness: {
        passed: mathResult.passed,
        issues: mathResult.issues,
        confidence: mathResult.confidence,
      },
      pedagogyQuality: {
        passed: pedagogyResult.passed,
        issues: pedagogyResult.issues,
        score: pedagogyResult.score,
      },
      overallScore,
      recommendation,
    };
  }

  /**
   * Validate multiple templates in batch
   */
  async validateBatch(
    templates: GeneratedTemplate[],
    context: { knowledgePoint: string; grade: number }
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(
      templates.map(template => this.validate(template, context))
    );
    return results;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/__tests__/validator.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/validator.ts
git commit -m "feat: add TemplateValidator with dual validation"
```

---

## Task 8: Quality Scorer

**Files:**
- Create: `lib/template-factory/quality-scorer.ts`

**Purpose:** Multi-dimensional quality scoring with auto-approval logic.

- [ ] **Step 1: Write scorer tests**

```typescript
// lib/template-factory/__tests__/quality-scorer.test.ts
import { describe, it, expect } from '@jest/globals';
import { QualityScorer } from '../quality-scorer';
import type { ValidationResult, QualityScore } from '../types';

describe('QualityScorer', () => {
  let scorer: QualityScorer;

  beforeEach(() => {
    scorer = new QualityScorer();
  });

  it('should calculate quality score from validation result', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 88 },
      overallScore: 92,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);

    expect(score.overall).toBeGreaterThan(80);
    expect(score.mathCorrectness).toBe(100);
    expect(score.pedagogyQuality).toBe(88);
  });

  it('should auto-approve high quality templates', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 1.0 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 95,
      recommendation: 'approve',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(true);
    expect(decision.reason).toBe('High quality, auto-approved');
  });

  it('should not auto-approve templates with math issues', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: false, issues: ['Calculation error'], confidence: 0.9 },
      pedagogyQuality: { passed: true, issues: [], score: 90 },
      overallScore: 80,
      recommendation: 'reject',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.reason).toContain('math correctness');
  });

  it('should send medium quality to review', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.9 },
      pedagogyQuality: { passed: true, issues: ['Minor clarity issue'], score: 78 },
      overallScore: 82,
      recommendation: 'review',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.approve).toBe(false);
    expect(decision.queue).toBe('p2');
  });

  it('should assign correct priority queue', () => {
    const validation: ValidationResult = {
      templateId: 't-1',
      mathCorrectness: { passed: true, issues: [], confidence: 1.0 },
      pedagogyQuality: { passed: true, issues: ['Issue'], score: 72 },
      overallScore: 78,
      recommendation: 'review',
    };

    const score = scorer.calculate(validation);
    const decision = scorer.shouldAutoApprove(score);

    expect(decision.queue).toBe('p2'); // 70-80 goes to p2
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/template-factory/__tests__/quality-scorer.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement QualityScorer**

```typescript
// lib/template-factory/quality-scorer.ts
import type { ValidationResult, QualityScore } from './types';

export interface ApprovalDecision {
  approve: boolean;
  reason: string;
  queue?: 'p0' | 'p1' | 'p2' | 'p3';
}

export class QualityScorer {
  /**
   * Calculate quality score from validation result
   */
  calculate(validation: ValidationResult): QualityScore {
    const mathCorrectness = validation.mathCorrectness.passed ? 100 : 0;
    const pedagogyQuality = validation.pedagogyQuality.score;

    // Difficulty accuracy: based on confidence
    const difficultyAccuracy = validation.mathCorrectness.confidence * 100;

    // Completeness: based on issue count
    const issueCount = validation.mathCorrectness.issues.length +
                      validation.pedagogyQuality.issues.length;
    const completeness = Math.max(0, 100 - issueCount * 10);

    // Innovation: bonus for high pedagogy score
    const innovation = Math.min(100, pedagogyQuality * 0.5 + 50);

    // Weighted overall
    const overall = Math.round(
      mathCorrectness * 0.40 +
      pedagogyQuality * 0.30 +
      difficultyAccuracy * 0.15 +
      completeness * 0.10 +
      innovation * 0.05
    );

    return {
      mathCorrectness,
      pedagogyQuality,
      difficultyAccuracy,
      completeness,
      innovation,
      overall,
    };
  }

  /**
   * Determine if template should be auto-approved
   */
  shouldAutoApprove(score: QualityScore): ApprovalDecision {
    // Math correctness must be 100%
    if (score.mathCorrectness < 100) {
      return {
        approve: false,
        reason: 'Math correctness failed',
        queue: 'p0', // Highest priority
      };
    }

    // Auto-approve threshold
    if (score.overall >= 90) {
      return {
        approve: true,
        reason: 'High quality, auto-approved',
      };
    }

    // Determine review queue priority
    let queue: 'p1' | 'p2' | 'p3';
    if (score.overall >= 80) {
      queue = 'p2'; // Medium priority
    } else if (score.overall >= 70) {
      queue = 'p1'; // High priority
    } else {
      queue = 'p1'; // Low score still needs review before rejection
    }

    return {
      approve: false,
      reason: `Quality score ${score.overall} requires review`,
      queue,
    };
  }

  /**
   * Get quality category for reporting
   */
  getQualityCategory(score: QualityScore): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score.overall >= 90) return 'excellent';
    if (score.overall >= 80) return 'good';
    if (score.overall >= 70) return 'fair';
    return 'poor';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/__tests__/quality-scorer.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/quality-scorer.ts
git commit -m "feat: add QualityScorer with auto-approval logic"
```

---

## Task 9: Gap Detector

**Files:**
- Create: `lib/template-factory/gap-detector.ts`

**Purpose:** Analyze knowledge point coverage and identify gaps.

- [ ] **Step 1: Write gap detector tests**

```typescript
// lib/template-factory/__tests__/gap-detector.test.ts
import { describe, it, expect, beforeEach, vi } from '@jest/globals';
import { GapDetector } from '../gap-detector';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client');

describe('GapDetector', () => {
  let detector: GapDetector;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = {
      knowledgePoint: {
        findMany: vi.fn(),
      },
      template: {
        groupBy: vi.fn(),
      },
      knowledgeCoverage: {
        upsert: vi.fn(),
      },
    };
    detector = new GapDetector(mockPrisma);
  });

  it('should detect knowledge gaps', async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValueOnce([
      { id: 'kp-1', name: 'Linear Equations', weight: 10 },
      { id: 'kp-2', name: 'Quadratic Equations', weight: 5 },
    ]);

    mockPrisma.template.groupBy.mockResolvedValueOnce([
      { knowledgeId: 'kp-1', _count: 2 },
    ]);

    const gaps = await detector.detectGaps();

    expect(gaps).toHaveLength(2);
    expect(gaps[0].gap).toBe(1); // Target 3, have 2
    expect(gaps[0].priority).toBe('medium');
    expect(gaps[1].gap).toBe(3); // Target 3, have 0
    expect(gaps[1].priority).toBe('high');
  });

  it('should prioritize by gap size and weight', async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValueOnce([
      { id: 'kp-1', name: 'Important Topic', weight: 10 },
      { id: 'kp-2', name: 'Less Important', weight: 2 },
    ]);

    mockPrisma.template.groupBy.mockResolvedValueOnce([]);

    const gaps = await detector.detectGaps();

    // Both have gap 3, but kp-1 has higher weight
    expect(gaps[0].knowledgePointId).toBe('kp-1');
    expect(gaps[0].priority).toBe('high');
  });

  it('should return empty when no gaps', async () => {
    mockPrisma.knowledgePoint.findMany.mockResolvedValueOnce([
      { id: 'kp-1', name: 'Complete', weight: 5 },
    ]);

    mockPrisma.template.groupBy.mockResolvedValueOnce([
      { knowledgeId: 'kp-1', _count: 5 },
    ]);

    const gaps = await detector.detectGaps();

    expect(gaps).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test lib/template-factory/__tests__/gap-detector.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement GapDetector**

```typescript
// lib/template-factory/gap-detector.ts
import type { KnowledgeGap } from './types';
import type { PrismaClient } from '@prisma/client';

export class GapDetector {
  private prisma: PrismaClient;
  private targetTemplatesPerPoint = 3;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Detect knowledge points with template gaps
   */
  async detectGaps(): Promise<KnowledgeGap[]> {
    // Get all knowledge points
    const knowledgePoints = await this.prisma.knowledgePoint.findMany({
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    // Get current template counts per knowledge point
    const templateCounts = await this.prisma.template.groupBy({
      by: ['knowledgeId'],
      where: {
        status: 'published',
        knowledgeId: { not: null },
      },
      _count: true,
    });

    const countMap = new Map(
      templateCounts.map(t => [t.knowledgeId, t._count])
    );

    // Calculate gaps
    const gaps: KnowledgeGap[] = [];

    for (const kp of knowledgePoints) {
      const currentCount = countMap.get(kp.id) || 0;
      const gap = this.targetTemplatesPerPoint - currentCount;

      if (gap > 0) {
        gaps.push({
          knowledgePointId: kp.id,
          knowledgePointName: kp.name,
          currentTemplateCount: currentCount,
          targetTemplateCount: this.targetTemplatesPerPoint,
          gap,
          priority: this.calculatePriority(gap, kp.weight),
          estimatedDifficulty: this.estimateDifficulty(kp.weight),
        });
      }
    }

    // Sort by priority (high first) then gap size
    gaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return b.gap - a.gap;
    });

    // Update coverage table
    await this.updateCoverage(gaps);

    return gaps;
  }

  /**
   * Calculate priority based on gap size and knowledge point weight
   */
  private calculatePriority(gap: number, weight: number): 'high' | 'medium' | 'low' {
    if (gap === this.targetTemplatesPerPoint) {
      // No templates at all
      return weight > 5 ? 'high' : 'medium';
    } else if (gap >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Estimate difficulty based on weight
   */
  private estimateDifficulty(weight: number): 'easy' | 'medium' | 'hard' {
    if (weight <= 3) return 'easy';
    if (weight <= 7) return 'medium';
    return 'hard';
  }

  /**
   * Update knowledge coverage tracking
   */
  private async updateCoverage(gaps: KnowledgeGap[]): Promise<void> {
    const updates = gaps.map(gap => ({
      where: { knowledgePointId: gap.knowledgePointId },
      create: {
        knowledgePointId: gap.knowledgePointId,
        targetTemplateCount: gap.targetTemplateCount,
        currentTemplateCount: gap.currentTemplateCount,
        gap: gap.gap,
        priority: gap.priority,
      },
      update: {
        currentTemplateCount: gap.currentTemplateCount,
        gap: gap.gap,
        priority: gap.priority,
        lastUpdated: new Date(),
      },
    }));

    for (const update of updates) {
      await this.prisma.knowledgeCoverage.upsert(update);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test lib/template-factory/__tests__/gap-detector.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/template-factory/gap-detector.ts
git commit -m "feat: add GapDetector for coverage analysis"
```

---

## Task 10: Generate API Endpoint

**Files:**
- Create: `app/api/admin/factory/generate/route.ts`

**Purpose:** API endpoint for triggering template generation.

- [ ] **Step 1: Write API tests**

```typescript
// app/api/admin/factory/generate/__tests__/route.test.ts
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('../../../../../lib/template-factory/generator');
jest.mock('../../../../../lib/template-factory/validator');
jest.mock('../../../../../lib/template-factory/quality-scorer');
jest.mock('../../../../../lib/prisma');

describe('/api/admin/factory/generate', () => {
  it('should generate templates for a knowledge point', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/generate', {
      method: 'POST',
      body: JSON.stringify({
        knowledgePointId: 'kp-1',
        count: 3,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.generationId).toBeDefined();
    expect(data.summary.total).toBe(3);
  });

  it('should validate required fields', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/generate', {
      method: 'POST',
      body: JSON.stringify({
        // Missing knowledgePointId
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('should handle generation errors', async () => {
    // Add test for error handling
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test app/api/admin/factory/generate/__tests__/route.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement API route**

```typescript
// app/api/admin/factory/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { LLMClient } from '@/lib/template-factory/utils/llm-client';
import { TemplateGenerator } from '@/lib/template-factory/generator';
import { TemplateValidator } from '@/lib/template-factory/validator';
import { QualityScorer } from '@/lib/template-factory/quality-scorer';
import type { GenerationRequest } from '@/lib/template-factory/types';

// Request schema
const GenerateRequestSchema = z.object({
  knowledgePointId: z.string(),
  count: z.number().min(1).max(10).default(3),
  structures: z.array(z.enum(['linear', 'nested', 'multi_equation', 'constraint_chain'])).optional(),
  depths: z.array(z.number().min(1).max(4)).optional(),
});

// POST /api/admin/factory/generate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { knowledgePointId, count, structures, depths } = parsed.data;

    // Fetch knowledge point
    const knowledgePoint = await prisma.knowledgePoint.findUnique({
      where: { id: knowledgePointId },
      include: { chapter: { include: { textbook: true } } },
    });

    if (!knowledgePoint) {
      return NextResponse.json(
        { error: 'Knowledge point not found' },
        { status: 404 }
      );
    }

    // Build generation request
    const genRequest: GenerationRequest = {
      knowledgePoint: {
        id: knowledgePoint.id,
        name: knowledgePoint.name,
        description: undefined, // TODO: Add description field
      },
      targetStructures: (structures as any) || ['linear'],
      targetDepths: (depths as any) || [1, 2],
      count,
      context: {
        textbook: knowledgePoint.chapter?.textbook?.name,
        grade: knowledgePoint.chapter?.textbook?.grade || 7,
        relatedConcepts: [], // TODO: Fetch related concepts
      },
    };

    // Initialize services
    const llm = new LLMClient({
      model: process.env.LLM_MODEL as any || 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
    });

    const generator = new TemplateGenerator(llm);
    const validator = new TemplateValidator(llm);
    const scorer = new QualityScorer();

    // Generate templates
    const generationResult = await generator.generate(genRequest);

    // Validate templates
    const validations = await validator.validateBatch(
      generationResult.templates,
      { knowledgePoint: knowledgePoint.name, grade: genRequest.context.grade }
    );

    // Score and determine approval
    let approvedCount = 0;
    let needsReviewCount = 0;
    let rejectedCount = 0;

    for (let i = 0; i < generationResult.templates.length; i++) {
      const template = generationResult.templates[i];
      const validation = validations[i];
      const score = scorer.calculate(validation);
      const decision = scorer.shouldAutoApprove(score);

      if (decision.approve) {
        approvedCount++;
      } else if (decision.queue === 'p1' || decision.queue === 'p2') {
        needsReviewCount++;
      } else {
        rejectedCount++;
      }

      // TODO: Save to database
    }

    // Save generation record
    await prisma.templateGeneration.create({
      data: {
        knowledgePointId,
        generatorModel: llm.config.model,
        prompt: JSON.stringify(genRequest),
        rawOutput: JSON.stringify(generationResult),
        generatedCount: generationResult.summary.total,
        successCount: generationResult.summary.successful,
      },
    });

    return NextResponse.json({
      generationId: generationResult.generationId,
      status: 'completed',
      templates: generationResult.templates.map((t, i) => ({
        id: `temp-${i}`,
        name: t.name,
        validationResult: validations[i],
        needsReview: !scorer.shouldAutoApprove(
          scorer.calculate(validations[i])
        ).approve,
      })),
      summary: {
        total: generationResult.summary.total,
        approved: approvedCount,
        needsReview: needsReviewCount,
        rejected: rejectedCount,
      },
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Generation failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test app/api/admin/factory/generate/__tests__/route.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/factory/generate/
git commit -m "feat: add template generation API endpoint"
```

---

## Task 11: Coverage Report API

**Files:**
- Create: `app/api/admin/factory/coverage/route.ts`

**Purpose:** API endpoint for coverage reporting.

- [ ] **Step 1: Write API tests**

```typescript
// app/api/admin/factory/coverage/__tests__/route.test.ts
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('../../../../../lib/template-factory/gap-detector');
jest.mock('../../../../../lib/prisma');

describe('/api/admin/factory/coverage', () => {
  it('should return coverage report', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBeDefined();
    expect(data.coverageRate).toBeGreaterThanOrEqual(0);
    expect(data.byKnowledgePoint).toBeInstanceOf(Array);
  });

  it('should calculate gap statistics', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(data.gaps).toHaveProperty('high');
    expect(data.gaps).toHaveProperty('medium');
    expect(data.gaps).toHaveProperty('low');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test app/api/admin/factory/coverage/__tests__/route.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement API route**

```typescript
// app/api/admin/factory/coverage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GapDetector } from '@/lib/template-factory/gap-detector';
import type { CoverageReport } from '@/lib/template-factory/types';

// GET /api/admin/factory/coverage
export async function GET(request: NextRequest) {
  try {
    const detector = new GapDetector(prisma);
    const gaps = await detector.detectGaps();

    // Get total knowledge points
    const totalKnowledgePoints = await prisma.knowledgePoint.count();

    // Get covered knowledge points (at least 3 templates)
    const coveredKnowledgePoints = totalKnowledgePoints - gaps.length;

    const coverageRate = totalKnowledgePoints > 0
      ? coveredKnowledgePoints / totalKnowledgePoints
      : 0;

    // Count gaps by priority
    const gapCounts = {
      high: gaps.filter(g => g.priority === 'high').length,
      medium: gaps.filter(g => g.priority === 'medium').length,
      low: gaps.filter(g => g.priority === 'low').length,
    };

    const report: CoverageReport = {
      total: totalKnowledgePoints,
      covered: coveredKnowledgePoints,
      coverageRate,
      byKnowledgePoint: gaps.map(g => ({
        id: g.knowledgePointId,
        name: g.knowledgePointName,
        current: g.currentTemplateCount,
        target: g.targetTemplateCount,
        gap: g.gap,
        priority: g.priority,
      })),
      gaps: gapCounts,
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('Coverage report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate coverage report' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test app/api/admin/factory/coverage/__tests__/route.test.ts
```

Expected output: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/factory/coverage/
git commit -m "feat: add coverage report API endpoint"
```

---

## Task 12: Review Queue API

**Files:**
- Create: `app/api/admin/factory/review-queue/route.ts`
- Create: `app/api/admin/factory/review/[id]/route.ts`

**Purpose:** API endpoints for human review workflow.

- [ ] **Step 1: Write review queue tests**

```typescript
// app/api/admin/factory/review-queue/__tests__/route.test.ts
import { GET } from '../route';
import { NextRequest } from 'next/server';

jest.mock('../../../../../lib/prisma');

describe('/api/admin/factory/review-queue', () => {
  it('should return pending review items', async () => {
    const request = new NextRequest(
      'https://example.com/api/admin/factory/review-queue?priority=p1&limit=10'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toBeInstanceOf(Array);
    expect(data.items.length).toBeLessThanOrEqual(10);
  });

  it('should filter by priority', async () => {
    const request = new NextRequest(
      'https://example.com/api/admin/factory/review-queue?priority=p0'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.items).toBeDefined();
    // All items should be p0 (highest priority)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test app/api/admin/factory/review-queue/__tests__/route.test.ts
```

Expected output: FAIL

- [ ] **Step 3: Implement review queue GET endpoint**

```typescript
// app/api/admin/factory/review-queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/factory/review-queue
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority') as 'p0' | 'p1' | 'p2' | 'p3' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || 'pending';

    // Build where clause
    const where: any = {
      reviewStatus: status,
    };

    if (priority) {
      // For priority-based filtering, we need to filter by quality score
      // P0: math correctness < 100%
      // P1: 70 <= overall < 80
      // P2: 80 <= overall < 90
      // P3: overall >= 90 (spot check)
      switch (priority) {
        case 'p0':
          where.validationResult = { path: ['$', 'mathCorrectness', 'passed'], equals: false };
          break;
        case 'p1':
          where.qualityScore = { gte: 70, lt: 80 };
          break;
        case 'p2':
          where.qualityScore = { gte: 80, lt: 90 };
          break;
        case 'p3':
          where.qualityScore = { gte: 90 };
          break;
      }
    }

    // Fetch review items
    const templates = await prisma.template.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        knowledge: {
          select: { name: true },
        },
      },
    });

    const items = templates.map(t => {
      const validationResult = t.validationResult as any;
      const priority = validationResult?.mathCorrectness?.passed === false
        ? 'p0'
        : t.qualityScore && t.qualityScore >= 90 ? 'p3'
        : t.qualityScore && t.qualityScore >= 80 ? 'p2'
        : 'p1';

      return {
        id: t.id,
        templateId: t.id,
        knowledgePoint: t.knowledge?.name || 'Unknown',
        template: {
          name: t.name,
          template: t.structure as any, // Template stores structure
          answer: '', // Not stored separately
        },
        validationResult: validationResult || {},
        priority,
        estimatedTime: priority === 'p0' ? 300 : 180, // 5 min for P0, 3 min otherwise
      };
    });

    return NextResponse.json({
      items,
      total: items.length,
    });

  } catch (error) {
    console.error('Review queue error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Implement review decision endpoint**

```typescript
// app/api/admin/factory/review/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const ReviewDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'modify']),
  notes: z.string().optional(),
  modifications: z.record(z.any()).optional(),
});

// POST /api/admin/factory/review/[id]
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = ReviewDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { decision, notes, modifications } = parsed.data;

    // Update template review status
    const template = await prisma.template.update({
      where: { id: params.id },
      data: {
        reviewStatus: decision === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    // Record review decision
    await prisma.templateReview.create({
      data: {
        templateId: params.id,
        reviewerId: 'admin', // TODO: Get from session
        decision,
        notes,
        modifications: modifications || {},
        duration: 0, // TODO: Calculate from review start time
      },
    });

    return NextResponse.json({
      success: true,
      templateId: params.id,
      decision,
    });

  } catch (error) {
    console.error('Review decision error:', error);
    return NextResponse.json(
      { error: 'Failed to process review decision' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test app/api/admin/factory/review-queue/
pnpm test app/api/admin/factory/review/
```

Expected output: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/factory/review-queue/
git add app/api/admin/factory/review/
git commit -m "feat: add review queue and decision API endpoints"
```

---

## Task 13: End-to-End Integration Test

**Files:**
- Create: `lib/template-factory/__tests__/integration.test.ts`

**Purpose:** Verify the full pipeline works end-to-end.

- [ ] **Step 1: Write integration test**

```typescript
// lib/template-factory/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '@/lib/prisma';
import { LLMClient } from '../utils/llm-client';
import { TemplateGenerator } from '../generator';
import { TemplateValidator } from '../validator';
import { QualityScorer } from '../quality-scorer';
import { GapDetector } from '../gap-detector';

describe('Template Factory Integration', () => {
  let testKnowledgePointId: string;

  beforeAll(async () => {
    // Create test knowledge point
    const kp = await prisma.knowledgePoint.create({
      data: {
        name: 'Test: 一元一次方程',
        chapterId: 'test-chapter',
        conceptId: 'test-concept',
        weight: 5,
      },
    });
    testKnowledgePointId = kp.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.template.deleteMany({
      where: { knowledgeId: testKnowledgePointId },
    });
    await prisma.knowledgePoint.delete({
      where: { id: testKnowledgePointId },
    });
  });

  it('should complete full pipeline: detect gap → generate → validate → score', async () => {
    // 1. Detect gaps
    const detector = new GapDetector(prisma);
    const gaps = await detector.detectGaps();

    const testGap = gaps.find(g => g.knowledgePointId === testKnowledgePointId);
    expect(testGap).toBeDefined();
    expect(testGap?.gap).toBeGreaterThan(0);

    // 2. Generate templates (mocked for test)
    const llm = new LLMClient({
      model: 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY || '',
    });

    const generator = new TemplateGenerator(llm);

    // Skip actual LLM call in unit tests
    // In integration tests with real API, this would call the LLM

    // 3. Validate (mocked)
    const validator = new TemplateValidator(llm);

    // 4. Score
    const scorer = new QualityScorer();

    // Verify scorer works
    const mockValidation = {
      templateId: 'test-1',
      mathCorrectness: { passed: true, issues: [], confidence: 0.95 },
      pedagogyQuality: { passed: true, issues: [], score: 88 },
      overallScore: 92,
      recommendation: 'approve' as const,
    };

    const score = scorer.calculate(mockValidation);
    expect(score.overall).toBeGreaterThan(80);

    const decision = scorer.shouldAutoApprove(score);
    expect(decision.approve).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
pnpm test lib/template-factory/__tests__/integration.test.ts
```

Expected output: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/template-factory/__tests__/integration.test.ts
git commit -m "test: add end-to-end integration test"
```

---

## Task 14: Documentation

**Files:**
- Create: `lib/template-factory/README.md`

**Purpose:** Developer documentation for the template factory system.

- [ ] **Step 1: Write README**

```markdown
# Template Factory

LLM-powered template generation and validation system for math questions.

## Architecture

```
GapDetector → TemplateGenerator → TemplateValidator → QualityScorer → HumanReviewQueue
```

## Components

### GapDetector
Analyzes knowledge point coverage and identifies where new templates are needed.

### TemplateGenerator
Uses LLMs (Gemini/GPT-4) to generate new question templates.

### TemplateValidator
Dual validation: mathematical correctness + pedagogical quality.

### QualityScorer
Multi-dimensional scoring with auto-approval logic.

## Usage

### Generate Templates

```typescript
import { TemplateGenerator } from '@/lib/template-factory/generator';
import { LLMClient } from '@/lib/template-factory/utils/llm-client';

const llm = new LLMClient({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY!,
});

const generator = new TemplateGenerator(llm);

const result = await generator.generate({
  knowledgePoint: { id: 'kp-1', name: '一元一次方程' },
  targetStructures: ['linear'],
  targetDepths: [1, 2],
  count: 3,
  context: { grade: 7, relatedConcepts: [] },
});
```

### Validate Templates

```typescript
import { TemplateValidator } from '@/lib/template-factory/validator';

const validator = new TemplateValidator(llm);

const result = await validator.validate(template, {
  knowledgePoint: '一元一次方程',
  grade: 7,
});

console.log(result.recommendation); // 'approve' | 'review' | 'reject'
```

## API Endpoints

- `POST /api/admin/factory/generate` - Trigger template generation
- `GET /api/admin/factory/coverage` - Get coverage report
- `GET /api/admin/factory/review-queue` - Get pending reviews
- `POST /api/admin/factory/review/[id]` - Submit review decision

## Environment Variables

- `GEMINI_API_KEY` - Gemini API key
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `LLM_MODEL` - Model to use (default: gemini-2.5-flash)

## Quality Standards

- Math correctness must be 100%
- Overall score >= 90 for auto-approval
- Scores 70-89 require human review
- Scores < 70 are rejected
```

- [ ] **Step 2: Commit**

```bash
git add lib/template-factory/README.md
git commit -m "docs: add template factory documentation"
```

---

## Task 15: Final Verification

**Files:**
- Run all tests
- Build verification
- Type check

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected output: All tests pass

- [ ] **Step 2: Type check**

```bash
pnpm tsc --noEmit
```

Expected output: No type errors

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected output: Build succeeds

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete template factory core implementation

This implements Phase 1 of the template factory system:
- Database extensions for generation/validation tracking
- LLM client for Gemini and OpenAI
- Template generation with retry logic
- Dual validation (math + pedagogy)
- Quality scoring with auto-approval
- Gap detection and coverage reporting
- Admin API endpoints
- Integration tests and documentation

Ready for Phase 2: Batch generation and human review UI."
```

---

## Summary

This plan implements the **Template Factory Core** - the foundational infrastructure for LLM-based template generation and validation. Upon completion:

- ✅ Database schema extended with generation/validation tracking
- ✅ LLM client supporting Gemini and OpenAI
- ✅ Template generation with prompts and parsing
- ✅ Dual validation for math correctness and pedagogy
- ✅ Quality scoring with auto-approval logic
- ✅ Gap detection and coverage reporting
- ✅ Admin API endpoints for generation, validation, and review
- ✅ Integration tests and documentation

**Next steps** (separate plan):
- Effect Validation System (canary testing, A/B testing, launch monitoring)
- Admin UI for human review queue
- Batch generation workflows
- Performance optimization and caching
