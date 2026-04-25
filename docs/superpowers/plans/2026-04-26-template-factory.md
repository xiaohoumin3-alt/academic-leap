# 模板工厂系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的模板工厂系统，支持从教材/题库自动推导生成知识点、骨架和模板

**Architecture:** 三层架构（输入层→处理层→输出层），素材驱动，AI自动推导，用户审核确认

**Tech Stack:** Next.js, Prisma (SQLite), TypeScript, React

---

## Phase 1: 基础设施

### 文件结构

```
prisma/
├── schema.prisma              # 扩展：Skeleton模型

lib/
├── template-factory/
│   ├── parsers/
│   │   ├── textbook-parser.ts     # 教材解析器
│   │   └── question-bank-parser.ts # 题库解析器
│   ├── types.ts                   # 类型定义
│   └── index.ts                   # 导出

app/api/
├── admin/
│   ├── factory/
│   │   ├── preview/route.ts       # 预览API
│   │   ├── import/route.ts         # 批量导入API
│   │   └── skeletons/route.ts      # 骨架管理API
```

### Task 1: 扩展数据库 - Skeleton模型

**Files:**
- Modify: `prisma/schema.prisma:256-275`
- Create: `prisma/migrations/add_skeleton_model.sql`

```prisma
model Skeleton {
  id          String   @id  // 如 "compute_sqrt"
  stepType    String   // 如 "COMPUTE_SQRT"
  name        String   // 中文名，如 "计算二次根式"
  config      Json     // 输入类型、键盘类型、验证规则
  status      String   @default("pending")  // pending | approved | production
  source      String   // "ai_generated" | "manual"
  createdAt   DateTime @default(now())
  approvedBy  String?
}
```

- [ ] **Step 1: 创建迁移SQL**

```sql
-- 创建Skeleton模型
CREATE TABLE Skeleton (
  id TEXT PRIMARY KEY,
  stepType TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  source TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  approvedBy TEXT
);

-- 给Template添加source字段
ALTER TABLE Template ADD COLUMN source TEXT DEFAULT 'manual';

-- 给Template添加skeletonIds字段
ALTER TABLE Template ADD COLUMN skeletonIds TEXT DEFAULT '[]';
```

- [ ] **Step 2: 运行迁移**

```bash
cd /Users/seanxx/academic-leap/academic-leap
npx prisma db push
```

- [ ] **Step 3: 生成Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 4: 写测试验证模型**

```typescript
// lib/template-factory/__tests__/skeleton-model.test.ts
import { prisma } from '@/lib/prisma';

describe('Skeleton Model', () => {
  test('can create skeleton with default pending status', async () => {
    const skeleton = await prisma.skeleton.create({
      data: {
        id: 'test_compute_sqrt',
        stepType: 'COMPUTE_SQRT',
        name: '计算二次根式',
        config: {
          inputType: 'numeric',
          keyboard: 'numeric',
          validation: { radicand: { min: 0 } }
        },
        source: 'manual'
      }
    });

    expect(skeleton.status).toBe('pending');
    expect(skeleton.stepType).toBe('COMPUTE_SQRT');
  });
});
```

- [ ] **Step 5: 提交**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "feat: add Skeleton model for template factory"
```

---

### Task 2: 类型定义

**Files:**
- Create: `lib/template-factory/types.ts`

```typescript
// lib/template-factory/types.ts

/**
 * 素材类型
 */
export type MaterialType = 'textbook' | 'question_bank' | 'mixed';

/**
 * 步骤类型（对应StepType枚举）
 */
export type StepTypeKey =
  | 'COMPUTE_SQRT'
  | 'SIMPLIFY_SQRT'
  | 'SQRT_MIXED'
  | 'VERIFY_RIGHT_ANGLE'
  | 'VERIFY_PARALLELOGRAM'
  | 'VERIFY_RECTANGLE'
  | 'VERIFY_RHOMBUS'
  | 'VERIFY_SQUARE'
  | 'COMPUTE_RECT_PROPERTY'
  | 'COMPUTE_RHOMBUS_PROPERTY'
  | 'COMPUTE_SQUARE_PROPERTY'
  | 'IDENTIFY_QUADRATIC'
  | 'SOLVE_DIRECT_ROOT'
  | 'SOLVE_COMPLETE_SQUARE'
  | 'SOLVE_QUADRATIC_FORMULA'
  | 'SOLVE_FACTORIZE'
  | 'QUADRATIC_APPLICATION'
  | 'COMPUTE_MEAN'
  | 'COMPUTE_MEDIAN'
  | 'COMPUTE_MODE'
  | 'COMPUTE_VARIANCE'
  | 'COMPUTE_STDDEV';

/**
 * 骨架配置
 */
export interface SkeletonConfig {
  inputType: 'numeric' | 'coordinate' | 'fraction' | 'expression';
  keyboard: 'numeric' | 'coordinate' | 'fraction' | 'full';
  validation?: Record<string, unknown>;
}

/**
 * 难度参数约束
 */
export interface ParamConstraint {
  param: string;
  type: 'int' | 'perfect_square' | 'range' | 'special';
  min?: number;
  max?: number;
  values?: number[];
}

/**
 * 难度配置
 */
export interface DifficultyConfig {
  level: number;
  constraints: ParamConstraint[];
}

/**
 * 教材章节
 */
export interface TextbookChapter {
  number: number;
  name: string;
  knowledgePoints: Array<{
    name: string;
    weight: number;
  }>;
}

/**
 * 题库题目
 */
export interface QuestionSample {
  content: string;
  difficulty: number;
  answer: string;
  stepType: StepTypeKey;
  knowledgePoint: string;
}

/**
 * 解析结果
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}
```

- [ ] **Step 1: 写测试**

```typescript
// lib/template-factory/__tests__/types.test.ts
import { describe, test, expect } from '@jest/globals';
import type { SkeletonConfig, DifficultyConfig, ParseResult } from '../types';

describe('Template Factory Types', () => {
  test('SkeletonConfig has correct structure', () => {
    const config: SkeletonConfig = {
      inputType: 'numeric',
      keyboard: 'numeric',
      validation: { radicand: { min: 0 } }
    };

    expect(config.inputType).toBe('numeric');
    expect(config.keyboard).toBe('numeric');
    expect(config.validation).toBeDefined();
  });

  test('DifficultyConfig supports different constraint types', () => {
    const config: DifficultyConfig = {
      level: 2,
      constraints: [
        { param: 'radicand', type: 'int', min: 1, max: 144 },
        { param: 'radicand', type: 'special', values: [2, 3, 5] }
      ]
    };

    expect(config.level).toBe(2);
    expect(config.constraints).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 验证测试通过**

```bash
pnpm test lib/template-factory/__tests__/types.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add lib/template-factory/types.ts
git commit -m "feat: add template factory type definitions"
```

---

### Task 3: 教材解析器

**Files:**
- Create: `lib/template-factory/parsers/textbook-parser.ts`
- Create: `lib/template-factory/__tests__/textbook-parser.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// lib/template-factory/__tests__/textbook-parser.test.ts
import { describe, test, expect } from '@jest/globals';
import { parseTextbook } from '../parsers/textbook-parser';
import type { ParseResult, TextbookChapter } from '../types';

describe('TextbookParser', () => {
  test('parses valid textbook yaml', () => {
    const yaml = `
textbook:
  grade: 8
  subject: 数学
  name: 人教版八年级下册

chapters:
  - number: 16
    name: 二次根式
    knowledgePoints:
      - name: 二次根式的定义
        weight: 3
      - name: 二次根式的乘法法则
        weight: 5
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.chapters).toHaveLength(1);
    expect(result.data?.chapters[0].knowledgePoints).toHaveLength(2);
  });

  test('returns errors for invalid yaml', () => {
    const yaml = `
textbook:
  grade: invalid
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test('validates required fields', () => {
    const yaml = `
chapters:
  - number: 16
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'textbook.name')).toBe(true);
  });
});
```

- [ ] **Step 2: 实现解析器**

```typescript
// lib/template-factory/parsers/textbook-parser.ts

import yaml from 'yaml';
import type { ParseResult, TextbookChapter } from '../types';

interface TextbookYaml {
  textbook?: {
    grade?: number;
    subject?: string;
    name?: string;
    year?: string;
  };
  chapters?: Array<{
    number?: number;
    name?: string;
    knowledgePoints?: Array<{ name?: string; weight?: number }>;
  }>;
}

export function parseTextbook(yamlContent: string): ParseResult<{
  textbook: {
    grade: number;
    subject: string;
    name: string;
    year?: string;
  };
  chapters: TextbookChapter[];
}> {
  const errors: Array<{ field: string; message: string }> = [];

  let parsed: TextbookYaml;
  try {
    parsed = yaml.parse(yamlContent);
  } catch (e) {
    return {
      success: false,
      errors: [{ field: 'content', message: 'YAML解析失败' }]
    };
  }

  // 验证必填字段
  if (!parsed.textbook?.name) {
    errors.push({ field: 'textbook.name', message: '教材名称必填' });
  }
  if (!parsed.textbook?.grade) {
    errors.push({ field: 'textbook.grade', message: '年级必填' });
  }
  if (!parsed.textbook?.subject) {
    errors.push({ field: 'textbook.subject', message: '学科必填' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const chapters: TextbookChapter[] = (parsed.chapters || []).map((ch, idx) => ({
    number: ch.number ?? idx + 1,
    name: ch.name ?? `章节${idx + 1}`,
    knowledgePoints: (ch.knowledgePoints || []).map(kp => ({
      name: kp.name ?? '未命名知识点',
      weight: kp.weight ?? 3
    }))
  }));

  return {
    success: true,
    data: {
      textbook: {
        grade: parsed.textbook!.grade!,
        subject: parsed.textbook!.subject!,
        name: parsed.textbook!.name!,
        year: parsed.textbook?.year
      },
      chapters
    }
  };
}
```

- [ ] **Step 3: 验证测试通过**

```bash
pnpm test lib/template-factory/__tests__/textbook-parser.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add lib/template-factory/parsers/textbook-parser.ts
git commit -m "feat: add textbook parser for template factory"
```

---

### Task 4: 题库解析器

**Files:**
- Create: `lib/template-factory/parsers/question-bank-parser.ts`
- Create: `lib/template-factory/__tests__/question-bank-parser.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// lib/template-factory/__tests__/question-bank-parser.test.ts
import { describe, test, expect } from '@jest/globals';
import { parseQuestionBank } from '../parsers/question-bank-parser';
import type { ParseResult } from '../types';

describe('QuestionBankParser', () => {
  test('parses valid question bank yaml', () => {
    const yaml = `
questions:
  - content: "求√144的值"
    difficulty: 1
    answer: 12
    stepType: COMPUTE_SQRT
    knowledgePoint: "二次根式的定义"
  - content: "化简√50"
    difficulty: 3
    answer: "5√2"
    stepType: SIMPLIFY_SQRT
    knowledgePoint: "最简二次根式"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.questions).toHaveLength(2);
    expect(result.data?.questions[0].stepType).toBe('COMPUTE_SQRT');
  });

  test('validates stepType is valid enum', () => {
    const yaml = `
questions:
  - content: "测试"
    difficulty: 1
    answer: "1"
    stepType: INVALID_TYPE
    knowledgePoint: "测试"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'stepType')).toBe(true);
  });
});
```

- [ ] **Step 2: 实现解析器**

```typescript
// lib/template-factory/parsers/question-bank-parser.ts

import yaml from 'yaml';
import type { ParseResult, QuestionSample, StepTypeKey } from '../types';

// 有效的StepType列表
const VALID_STEP_TYPES: StepTypeKey[] = [
  'COMPUTE_SQRT', 'SIMPLIFY_SQRT', 'SQRT_MIXED',
  'VERIFY_RIGHT_ANGLE', 'VERIFY_PARALLELOGRAM', 'VERIFY_RECTANGLE',
  'VERIFY_RHOMBUS', 'VERIFY_SQUARE', 'COMPUTE_RECT_PROPERTY',
  'COMPUTE_RHOMBUS_PROPERTY', 'COMPUTE_SQUARE_PROPERTY',
  'IDENTIFY_QUADRATIC', 'SOLVE_DIRECT_ROOT', 'SOLVE_COMPLETE_SQUARE',
  'SOLVE_QUADRATIC_FORMULA', 'SOLVE_FACTORIZE', 'QUADRATIC_APPLICATION',
  'COMPUTE_MEAN', 'COMPUTE_MEDIAN', 'COMPUTE_MODE',
  'COMPUTE_VARIANCE', 'COMPUTE_STDDEV'
];

interface QuestionBankYaml {
  questions?: Array<{
    content?: string;
    difficulty?: number;
    answer?: string;
    stepType?: string;
    knowledgePoint?: string;
  }>;
}

export function parseQuestionBank(yamlContent: string): ParseResult<{
  questions: QuestionSample[];
}> {
  const errors: Array<{ field: string; message: string }> = [];

  let parsed: QuestionBankYaml;
  try {
    parsed = yaml.parse(yamlContent);
  } catch (e) {
    return {
      success: false,
      errors: [{ field: 'content', message: 'YAML解析失败' }]
    };
  }

  if (!parsed.questions || parsed.questions.length === 0) {
    return {
      success: false,
      errors: [{ field: 'questions', message: '题目列表不能为空' }]
    };
  }

  const questions: QuestionSample[] = [];
  
  parsed.questions.forEach((q, idx) => {
    // 验证stepType
    if (!q.stepType) {
      errors.push({ field: `questions[${idx}].stepType`, message: 'stepType必填' });
    } else if (!VALID_STEP_TYPES.includes(q.stepType as StepTypeKey)) {
      errors.push({ 
        field: `questions[${idx}].stepType`, 
        message: `无效的stepType: ${q.stepType}` 
      });
    }

    // 验证difficulty
    if (q.difficulty !== undefined && (q.difficulty < 1 || q.difficulty > 5)) {
      errors.push({ 
        field: `questions[${idx}].difficulty`, 
        message: 'difficulty必须在1-5之间' 
      });
    }

    if (q.content && q.answer && q.stepType && q.knowledgePoint) {
      questions.push({
        content: q.content,
        difficulty: q.difficulty ?? 1,
        answer: q.answer,
        stepType: q.stepType as StepTypeKey,
        knowledgePoint: q.knowledgePoint
      });
    }
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { questions } };
}
```

- [ ] **Step 3: 验证测试通过**

```bash
pnpm test lib/template-factory/__tests__/question-bank-parser.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add lib/template-factory/parsers/question-bank-parser.ts
git commit -m "feat: add question bank parser for template factory"
```

---

### Task 5: 解析器导出

**Files:**
- Create: `lib/template-factory/parsers/index.ts`

- [ ] **Step 1: 创建导出文件**

```typescript
// lib/template-factory/parsers/index.ts
export { parseTextbook } from './textbook-parser';
export { parseQuestionBank } from './question-bank-parser';
```

- [ ] **Step 2: 创建主导出**

```typescript
// lib/template-factory/index.ts
export * from './types';
export * from './parsers';
```

- [ ] **Step 3: 提交**

```bash
git add lib/template-factory/
git commit -m "feat: add template factory parser exports"
```

---

## Phase 2: 骨架管理API

### Task 6: 骨架列表API

**Files:**
- Create: `app/api/admin/factory/skeletons/route.ts`
- Create: `app/api/admin/factory/skeletons/__tests__/route.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// app/api/admin/factory/skeletons/__tests__/route.test.ts
import { describe, test, expect } from '@jest/globals';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    skeleton: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'test_skeleton', stepType: 'COMPUTE_SQRT', name: '测试', status: 'pending' }
      ]),
      create: jest.fn(),
    }
  }
}));

describe('GET /api/admin/factory/skeletons', () => {
  test('returns skeleton list', async () => {
    // Test implementation
  });
});
```

- [ ] **Step 2: 实现API**

```typescript
// app/api/admin/factory/skeletons/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending | approved | production | all

    const where = status && status !== 'all' 
      ? { status } 
      : {};

    const skeletons = await prisma.skeleton.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: skeletons
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '获取骨架列表失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证测试通过**

```bash
pnpm test app/api/admin/factory/skeletons/__tests__/route.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add app/api/admin/factory/skeletons/route.ts
git commit -m "feat: add skeleton list API"
```

---

### Task 7: 骨架审核API

**Files:**
- Create: `app/api/admin/factory/skeletons/[id]/approve/route.ts`

- [ ] **Step 1: 写测试**

```typescript
// 测试骨架审核API
describe('POST /api/admin/factory/skeletons/:id/approve', () => {
  test('approves skeleton and changes status to production', async () => {
    // Test implementation
  });
});
```

- [ ] **Step 2: 实现API**

```typescript
// app/api/admin/factory/skeletons/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { approvedBy } = body;

    const skeleton = await prisma.skeleton.update({
      where: { id },
      data: {
        status: 'production',
        approvedBy
      }
    });

    return NextResponse.json({
      success: true,
      data: skeleton
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '审核骨架失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/factory/skeletons/[id]/approve/route.ts
git commit -m "feat: add skeleton approve API"
```

---

## Phase 3: 预览与导入API

### Task 8: 预览API

**Files:**
- Create: `app/api/admin/factory/preview/route.ts`
- Create: `lib/template-factory/preview-engine.ts`

- [ ] **Step 1: 写测试**

```typescript
// lib/template-factory/__tests__/preview-engine.test.ts
describe('PreviewEngine', () => {
  test('generates knowledge point preview from textbook', () => {
    // Test implementation
  });

  test('generates skeleton preview from question bank', () => {
    // Test implementation
  });
});
```

- [ ] **Step 2: 实现预览引擎**

```typescript
// lib/template-factory/preview-engine.ts

import type { TextbookChapter, QuestionSample } from './types';

interface KnowledgePointPreview {
  id: string;
  name: string;
  weight: number;
  parentChapter: string;
}

interface SkeletonPreview {
  id: string;
  stepType: string;
  name: string;
  usageCount: number;
  status: 'new' | 'existing' | 'conflict';
}

interface TemplatePreview {
  id: string;
  name: string;
  knowledgePoint: string;
  skeletonIds: string[];
  difficultyConfig: unknown;
}

export interface PreviewResult {
  knowledgePoints: KnowledgePointPreview[];
  skeletons: SkeletonPreview[];
  templates: TemplatePreview[];
  conflicts: Array<{ type: string; message: string }>;
}

export function generatePreview(
  textbook: { chapters: TextbookChapter[] } | null,
  questions: QuestionSample[] | null
): PreviewResult {
  const knowledgePoints: KnowledgePointPreview[] = [];
  const skeletons: SkeletonPreview[] = [];
  const templates: TemplatePreview[] = [];
  const conflicts: Array<{ type: string; message: string }> = [];

  // 从教材生成知识点预览
  if (textbook) {
    textbook.chapters.forEach(chapter => {
      chapter.knowledgePoints.forEach((kp, idx) => {
        knowledgePoints.push({
          id: `kp-${chapter.number}-${idx + 1}`,
          name: kp.name,
          weight: kp.weight,
          parentChapter: chapter.name
        });
      });
    });
  }

  // 从题库生成骨架和模板预览
  if (questions) {
    const stepTypeCount: Record<string, number> = {};

    questions.forEach((q, idx) => {
      stepTypeCount[q.stepType] = (stepTypeCount[q.stepType] || 0) + 1;

      templates.push({
        id: `template-${idx + 1}`,
        name: q.knowledgePoint,
        knowledgePoint: q.knowledgePoint,
        skeletonIds: [q.stepType.toLowerCase()],
        difficultyConfig: { level: q.difficulty }
      });
    });

    // 汇总骨架
    Object.entries(stepTypeCount).forEach(([stepType, count]) => {
      skeletons.push({
        id: stepType.toLowerCase(),
        stepType,
        name: stepType.replace(/_/g, ' '),
        usageCount: count,
        status: 'new'
      });
    });
  }

  return { knowledgePoints, skeletons, templates, conflicts };
}
```

- [ ] **Step 3: 实现预览API**

```typescript
// app/api/admin/factory/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseTextbook, parseQuestionBank } from '@/lib/template-factory/parsers';
import { generatePreview } from '@/lib/template-factory/preview-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { textbookYaml, questionBankYaml } = body;

    const textbookResult = textbookYaml 
      ? parseTextbook(textbookYaml) 
      : null;
    
    const questionResult = questionBankYaml 
      ? parseQuestionBank(questionBankYaml) 
      : null;

    const preview = generatePreview(
      textbookResult?.data ?? null,
      questionResult?.data?.questions ?? null
    );

    return NextResponse.json({
      success: true,
      data: {
        preview,
        textbookErrors: textbookResult?.errors,
        questionErrors: questionResult?.errors
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '预览生成失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add lib/template-factory/preview-engine.ts app/api/admin/factory/preview/route.ts
git commit -m "feat: add preview API for template factory"
```

---

### Task 9: 导入API

**Files:**
- Create: `app/api/admin/factory/import/route.ts`
- Create: `lib/template-factory/importer.ts`

- [ ] **Step 1: 写测试**

```typescript
// lib/template-factory/__tests__/importer.test.ts
describe('Importer', () => {
  test('creates knowledge points from preview', () => {
    // Test implementation
  });

  test('creates skeletons with pending status', () => {
    // Test implementation
  });
});
```

- [ ] **Step 2: 实现导入器**

```typescript
// lib/template-factory/importer.ts
import { prisma } from '@/lib/prisma';
import type { PreviewResult } from './preview-engine';

export interface ImportOptions {
  createKnowledgePoints: boolean;
  createSkeletons: boolean;
  createTemplates: boolean;
  approvedBy: string;
}

export async function importFromPreview(
  preview: PreviewResult,
  options: ImportOptions
) {
  const results = {
    knowledgePoints: 0,
    skeletons: 0,
    templates: 0
  };

  // 导入知识点
  if (options.createKnowledgePoints) {
    // 实现知识点导入逻辑
    results.knowledgePoints = preview.knowledgePoints.length;
  }

  // 导入骨架（pending状态）
  if (options.createSkeletons) {
    for (const skeleton of preview.skeletons) {
      await prisma.skeleton.upsert({
        where: { id: skeleton.id },
        update: {},
        create: {
          id: skeleton.id,
          stepType: skeleton.stepType,
          name: skeleton.name,
          config: {},
          status: 'pending',
          source: 'ai_generated'
        }
      });
      results.skeletons++;
    }
  }

  // 导入模板
  if (options.createTemplates) {
    // 实现模板导入逻辑
    results.templates = preview.templates.length;
  }

  return results;
}
```

- [ ] **Step 3: 实现导入API**

```typescript
// app/api/admin/factory/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { importFromPreview } from '@/lib/template-factory/importer';
import type { PreviewResult } from '@/lib/template-factory/preview-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { preview, options } = body as {
      preview: PreviewResult;
      options: {
        createKnowledgePoints: boolean;
        createSkeletons: boolean;
        createTemplates: boolean;
        approvedBy: string;
      };
    };

    const results = await importFromPreview(preview, options);

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '导入失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add lib/template-factory/importer.ts app/api/admin/factory/import/route.ts
git commit -m "feat: add import API for template factory"
```

---

## 实施检查清单

### Phase 1 完成标准
- [ ] Skeleton模型已创建并迁移
- [ ] 类型定义完整并测试通过
- [ ] 教材解析器支持YAML格式
- [ ] 题库解析器支持YAML格式
- [ ] 解析器测试覆盖率 >80%

### Phase 2 完成标准
- [ ] 骨架列表API可用
- [ ] 骨架审核API可用
- [ ] 骨架与Template关联正确

### Phase 3 完成标准
- [ ] 预览API返回多层级数据
- [ ] 导入API正确写入数据库
- [ ] 冲突检测工作正常

---

## 实施顺序

| 批次 | 任务 | 优先级 |
|------|------|--------|
| 1 | Task 1-2: 数据库模型 + 类型定义 | 高 |
| 2 | Task 3-4: 解析器实现 | 高 |
| 3 | Task 5: 导出整理 | 中 |
| 4 | Task 6-7: 骨架管理API | 中 |
| 5 | Task 8: 预览API | 高 |
| 6 | Task 9: 导入API | 高 |

---

## 后续扩展（Phase 4-5）

Phase 4（批量导入）和 Phase 5（优化）将在Phase 1-3完成后继续：
- 批量章节选择界面
- 回滚机制实现
- 历史版本管理
- AI引导式编辑器UI