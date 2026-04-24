# 知识点-模板关联系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 建立知识点与模板的动态关联机制，移除硬编码，支持管理员配置和 CSV 导入导出

**架构:** 数据库驱动 - 查询 `Template.knowledgeId` 关联，支持直接匹配和概念匹配，返回明确错误而非 fallback

**技术栈:** Next.js API Routes, Prisma, CSV 解析

---

## 文件结构

```
lib/question-engine/templates/index.ts    # 核心：模板查询逻辑重构
app/api/questions/generate/route.ts      # 修改：错误处理
app/api/admin/templates/
├── export/route.ts                     # 新增：CSV 导出
└── import/route.ts                     # 新增：CSV 导入
components/admin/
└── TemplateEditor.tsx                   # 修改：关联配置
```

---

## Task 1: 重构模板查询函数

**文件:**
- Modify: `lib/question-engine/templates/index.ts`

- [ ] **Step 1: 添加 Prisma 导入**

在 `lib/question-engine/templates/index.ts` 顶部添加：

```typescript
import { prisma } from '@/lib/prisma';
```

- [ ] **Step 2: 替换硬编码映射函数**

将 `getTemplateIdByKnowledge` 替换为异步函数 `getTemplateIdsByKnowledgePointId`：

```typescript
/**
 * 根据知识点ID获取可用的模板ID列表
 * 查询优先级：直接匹配 > 概念匹配
 */
export async function getTemplateIdsByKnowledgePointId(
  knowledgePointId: string
): Promise<string[]> {
  // 1. 直接匹配：Template.knowledgeId == knowledgePointId
  const directTemplates = await prisma.template.findMany({
    where: {
      knowledgeId: knowledgePointId,
      status: 'production'
    },
    select: { id: true }
  });

  if (directTemplates.length > 0) {
    return directTemplates.map(t => t.id);
  }

  // 2. 概念匹配：获取该知识点的 conceptId，查找同学期的模板
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { conceptId: true }
  });

  if (kp) {
    const conceptTemplates = await prisma.template.findMany({
      where: {
        status: 'production',
        knowledge: {
          conceptId: kp.conceptId
        }
      },
      select: { id: true }
    });
    return conceptTemplates.map(t => t.id);
  }

  // 3. 无匹配
  return [];
}

/**
 * 根据知识点ID随机获取一个模板
 */
export async function getTemplateIdByKnowledgePointId(
  knowledgePointId: string
): Promise<string | null> {
  const templateIds = await getTemplateIdsByKnowledgePointId(knowledgePointId);
  if (templateIds.length === 0) {
    return null;
  }
  return templateIds[Math.floor(Math.random() * templateIds.length)];
}
```

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
npx tsc --noEmit lib/question-engine/templates/index.ts
```

预期：无错误

- [ ] **Step 4: 提交**

```bash
git add lib/question-engine/templates/index.ts
git commit -m "refactor: replace hardcoded mapping with database-driven template lookup"
```

---

## Task 2: 修改题目生成 API

**文件:**
- Modify: `app/api/questions/generate/route.ts`

- [ ] **Step 1: 导入新函数**

将第 25 行附近的导入改为：

```typescript
import {
  generateQuestions as engineGenerateQuestions,
  QuestionProtocol,
  getTemplateIdByKnowledgePointId,
  getTemplate
} from '@/lib/question-engine';
```

- [ ] **Step 2: 替换生成逻辑**

将第 48-62 行的硬编码映射逻辑替换为：

```typescript
try {
  // 使用数据库关联查询模板
  const templateId = await getTemplateIdByKnowledgePointId(knowledgePoint);

  if (!templateId) {
    return NextResponse.json({
      success: false,
      error: '该知识点暂未配置题目模板，请联系管理员'
    }, { status: 400 });
  }

  // 使用模板引擎生成题目（单模板）
  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json({
      success: false,
      error: '题目模板配置错误'
    }, { status: 500 });
  }

  // 生成题目
  const params = template.generateParams(difficulty);
  const content = template.render(params);
  const steps = template.buildSteps(params);

  const question: QuestionProtocol = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    knowledgePoint,
    templateId,
    difficultyLevel: difficulty,
    params,
    steps,
    content,
    meta: { version: '1.0', source: 'template_engine' },
  };

  // 保存到数据库（保留原有保存逻辑，简化生成部分）
  // ... 保留 save 逻辑 ...
```

- [ ] **Step 3: 简化保存逻辑**

修改 `app/api/questions/generate/route.ts` 第 64-124 行，保留数据库保存逻辑，但移除硬编码的知识映射：

```typescript
// 直接使用传入的 knowledgePoint（已是中文）
const savedQuestion = await prisma.question.create({
  data: {
    type: 'calculation',
    difficulty,
    content: JSON.stringify(question.content),
    answer: '',
    hint: question.content.context || '',
    knowledgePoints: JSON.stringify([knowledgePoint]), // 直接使用
    isAI: renderStyle !== 'standard',
    templateId: question.templateId,
    params: JSON.stringify(question.params),
    stepTypes: JSON.stringify(question.steps.map(s => s.type)),
  },
});
```

- [ ] **Step 4: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 5: 提交**

```bash
git add app/api/questions/generate/route.ts
git commit -m "fix: use database-driven template lookup with clear error message"
```

---

## Task 3: CSV 导出 API

**文件:**
- Create: `app/api/admin/templates/export/route.ts`

- [ ] **Step 1: 创建导出 API**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/templates/export
 *
 * 导出模板与知识点的关联关系为 CSV
 */
export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      where: {
        status: { not: 'draft' }
      },
      include: {
        knowledge: {
          include: {
            concept: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // CSV 表头
    const headers = [
      'template_id',
      'template_name',
      'template_type',
      'knowledge_point_id',
      'knowledge_point_name',
      'concept_name'
    ];

    // CSV 行数据
    const rows = templates.map(t => [
      t.id,
      t.name || '',
      t.type,
      t.knowledgeId || '',
      t.knowledge?.name || '',
      t.knowledge?.concept?.name || ''
    ]);

    // 构建 CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="template-knowledge-mapping-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('导出失败:', error);
    return NextResponse.json({
      success: false,
      error: '导出失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add app/api/admin/templates/export/route.ts
git commit -m "feat: add CSV export API for template-knowledge mapping"
```

---

## Task 4: CSV 导入 API

**文件:**
- Create: `app/api/admin/templates/import/route.ts`

- [ ] **Step 1: 创建导入 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface CSVRow {
  template_id: string;
  knowledge_point_id: string;
}

/**
 * 解析 CSV 为数组
 */
function parseCSV(csv: string): CSVRow[] {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const templateIdIdx = headers.indexOf('template_id');
  const knowledgePointIdIdx = headers.indexOf('knowledge_point_id');

  if (templateIdIdx === -1 || knowledgePointIdIdx === -1) {
    throw new Error('CSV 格式错误：缺少 template_id 或 knowledge_point_id 列');
  }

  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
    const row = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

    if (row[templateIdIdx]) {
      rows.push({
        template_id: row[templateIdIdx],
        knowledge_point_id: row[knowledgePointIdIdx] || ''
      });
    }
  }

  return rows;
}

/**
 * POST /api/admin/templates/import
 *
 * 从 CSV 导入模板与知识点的关联关系
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: '请上传文件'
      }, { status: 400 });
    }

    const csv = await file.text();
    const rows = parseCSV(csv);

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.template_id) {
        skipped++;
        continue;
      }

      // 验证模板存在
      const template = await prisma.template.findUnique({
        where: { id: row.template_id }
      });

      if (!template) {
        skipped++;
        continue;
      }

      // 验证知识点存在（如果提供了）
      if (row.knowledge_point_id) {
        const kp = await prisma.knowledgePoint.findUnique({
          where: { id: row.knowledge_point_id }
        });

        if (!kp) {
          skipped++;
          continue;
        }
      }

      // 更新关联
      await prisma.template.update({
        where: { id: row.template_id },
        data: {
          knowledgeId: row.knowledge_point_id || null
        }
      });

      updated++;
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        updated,
        skipped
      }
    });

  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '导入失败'
    }, { status: 500 });
  }
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/templates/import/route.ts
git commit -m "feat: add CSV import API for template-knowledge mapping"
```

---

## Task 5: 模板编辑器添加关联配置

**文件:**
- Modify: `components/admin/TemplateEditor.tsx`

- [ ] **Step 1: 添加关联配置区块**

在模板编辑器中添加"关联知识点"区块，包含：
- 当前关联的知识点名称
- 导出按钮（下载 CSV）
- 导入按钮（上传 CSV）
- 手动选择知识点（可选）

```typescript
// 添加到 TemplateEditor.tsx 的适当位置

const TemplateKnowledgeMapping: React.FC<{ template: Template }> = ({ template }) => {
  const handleExport = async () => {
    const res = await fetch('/api/admin/templates/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-knowledge-mapping.csv';
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/admin/templates/import', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      alert(`导入成功：更新 ${data.data.updated} 条`);
    } else {
      alert(`导入失败：${data.error}`);
    }
  };

  return (
    <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
      <h3 className="font-bold text-on-surface mb-3">关联配置</h3>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-on-surface-variant">关联知识点:</span>
        <span className="text-sm text-on-surface font-medium">
          {template.knowledge?.name || '未关联'}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-sm bg-surface rounded-lg hover:bg-surface-container-high transition-colors"
        >
          导出映射
        </button>

        <label className="px-3 py-1.5 text-sm bg-surface rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer">
          导入映射
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 在模板详情中渲染**

在 `TemplateEditor` 组件中适当位置添加：

```typescript
{selectedTemplate && (
  <TemplateKnowledgeMapping template={selectedTemplate} />
)}
```

- [ ] **Step 3: 提交**

```bash
git add components/admin/TemplateEditor.tsx
git commit -m "feat: add import/export controls to template editor"
```

---

## 验收检查

- [ ] Task 1: `getTemplateIdsByKnowledgePointId` 函数正确查询数据库
- [ ] Task 2: 未配置模板时返回明确错误，不是 fallback
- [ ] Task 3: 导出 CSV 包含正确列
- [ ] Task 4: 导入 CSV 更新模板关联
- [ ] Task 5: 前端可导出/导入 CSV
