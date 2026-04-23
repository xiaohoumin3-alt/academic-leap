# 知识点树形筛选系统实施计划 v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**目标:** 实现年级+科目+教材版本的知识点筛选系统，概念+实例双层架构

**架构:**
- 新增 TextbookVersion 和 Chapter 表存储教材章节结构
- 新增 KnowledgeConcept 表存储概念层（双层架构）
- 新增 UserEnabledKnowledge 表存储用户勾选状态
- User 表扩展添加年级/科目/教材/进度字段
- 混合权重：概念默认权重，实例可覆盖

**技术栈:** Prisma, Next.js 15 App Router, React, TypeScript, SQLite

---

## 阶段1: 数据层

### Task 1: 更新 Prisma Schema

**文件:** `prisma/schema.prisma`

- [ ] **Step 1: 添加 KnowledgeConcept 模型**

在 `model User {` 前添加：

```prisma
model KnowledgeConcept {
  id          String    @id @default(cuid())
  name        String    // "勾股定理"
  category    String?   // "几何"、"代数"
  weight      Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  instances   KnowledgePoint[]
}
```

- [ ] **Step 2: 添加 TextbookVersion 模型**

```prisma
model TextbookVersion {
  id          String   @id @default(cuid())
  name        String
  publisher   String?
  grade       Int
  subject     String
  year        String?
  status      String   @default("active")
  chapters    Chapter[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([grade, subject, name])
  @@index([grade, subject, status])
}
```

- [ ] **Step 3: 添加 Chapter 模型**

```prisma
model Chapter {
  id              String           @id @default(cuid())
  textbookId      String
  chapterNumber   Int
  chapterName     String
  sectionNumber   Int?
  sectionName     String?
  parentId        String?
  sort            Int              @default(0)

  textbook        TextbookVersion  @relation(fields: [textbookId], references: [id])
  parent          Chapter?         @relation("ChapterHierarchy", fields: [parentId], references: [id])
  children        Chapter[]        @relation("ChapterHierarchy")
  knowledgePoints KnowledgePoint[]

  @@index([textbookId, parentId])
}
```

- [ ] **Step 4: 添加 UserEnabledKnowledge 模型**

```prisma
model UserEnabledKnowledge {
  id        String   @id @default(cuid())
  userId    String
  nodeId    String
  nodeType  String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, nodeId])
  @@index([userId, nodeType])
}
```

- [ ] **Step 5: 在 User 模型中添加字段**

在 `assessments Assessment[]` 后添加：

```prisma
  // 年级科目教材设置
  selectedGrade      Int?
  selectedSubject    String?
  selectedTextbookId String?
  studyProgress      Int       @default(0)

  enabledKnowledge   UserEnabledKnowledge[]
```

- [ ] **Step 6: 修改 KnowledgePoint 模型**

替换现有 KnowledgePoint 模型：

```prisma
model KnowledgePoint {
  id          String    @id @default(cuid())
  chapterId   String
  conceptId   String
  name        String
  weight      Int       @default(0) // 0=使用概念权重，>0=覆盖
  inAssess    Boolean   @default(true)
  status      String    @default("active")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  chapter     Chapter           @relation(fields: [chapterId], references: [id])
  concept     KnowledgeConcept  @relation(fields: [conceptId], references: [id])
  histories   KnowledgePointHistory[]
  templates   Template[]
}
```

- [ ] **Step 7: 运行迁移**

```bash
npx prisma migrate dev --name add_knowledge_tree_v3
npx prisma generate
```

预期输出: 成功创建迁移文件

- [ ] **Step 8: 提交**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add knowledge concept and textbook models"
```

---

### Task 2: 创建种子数据和迁移脚本

**文件:** `prisma/seed-v3.ts` (新建)

- [ ] **Step 1: 创建种子脚本**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. 创建8年级数学教材
  const textbook = await prisma.textbookVersion.upsert({
    where: {
      grade_subject_name: {
        grade: 8,
        subject: '数学',
        name: '人教版',
      },
    },
    update: {},
    create: {
      grade: 8,
      subject: '数学',
      name: '人教版',
      year: '2024',
      status: 'active',
    },
  });
  console.log(`教材: ${textbook.name} ${textbook.grade}年级`);

  // 2. 创建默认章节
  const chapter = await prisma.chapter.create({
    data: {
      textbookId: textbook.id,
      chapterNumber: 0,
      chapterName: '未分类（迁移数据）',
      sort: 999,
    },
  });
  console.log(`章节: ${chapter.chapterName}`);

  // 3. 获取现有知识点并分组创建概念
  const existingPoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
  });

  const groupedByName = new Map<string, typeof existingPoints>();
  for (const point of existingPoints) {
    if (!groupedByName.has(point.name)) {
      groupedByName.set(point.name, []);
    }
    groupedByName.get(point.name)!.push(point);
  }

  console.log(`找到 ${existingPoints.length} 个知识点，${groupedByName.size} 个唯一概念`);

  // 4. 创建概念并更新知识点
  let conceptCount = 0;
  let pointCount = 0;

  for (const [name, points] of groupedByName) {
    const firstPoint = points[0];

    // 创建概念
    const concept = await prisma.knowledgeConcept.create({
      data: {
        name,
        category: firstPoint.category,
        weight: firstPoint.weight || 0,
      },
    });
    conceptCount++;

    // 更新知识点实例
    for (const point of points) {
      await prisma.knowledgePoint.update({
        where: { id: point.id },
        data: {
          chapterId: chapter.id,
          conceptId: concept.id,
          weight: 0, // 使用概念权重
        },
      });
      pointCount++;
    }
  }

  console.log(`迁移完成: ${conceptCount} 个概念，${pointCount} 个实例`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: 运行迁移脚本**

```bash
npx tsx prisma/seed-v3.ts
```

预期输出: `迁移完成: X 个概念，Y 个实例`

- [ ] **Step 3: 提交**

```bash
git add prisma/seed-v3.ts
git commit -m "feat: add v3 seed and migration script"
```

---

## 阶段2: API层

### Task 3: 教材管理 API

**文件:** `app/api/admin/textbooks/route.ts` (新建)

- [ ] **Step 1: 创建教材 CRUD API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    const textbooks = await prisma.textbookVersion.findMany({
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { chapters: true } }
      }
    });
    return NextResponse.json({ success: true, data: textbooks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { name, publisher, grade, subject, year } = body;

    if (!name || !grade || !subject) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const textbook = await prisma.textbookVersion.create({
      data: { name, publisher, grade, subject, year }
    });

    await prisma.auditLog.create({
      data: { userId: admin.userId, action: 'create', entity: 'textbook', entityId: textbook.id, changes: { before: null, after: textbook } }
    });

    return NextResponse.json({ success: true, data: textbook });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

**文件:** `app/api/admin/textbooks/[id]/route.ts` (新建)

- [ ] **Step 2: 创建教材更新/删除 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = await req.json();
    const textbook = await prisma.textbookVersion.update({
      where: { id },
      data: body
    });
    return NextResponse.json({ success: true, data: textbook });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    await prisma.textbookVersion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/textbooks/
git commit -m "feat: add textbook CRUD API"
```

---

### Task 4: 章节管理 API

**文件:** `app/api/admin/chapters/route.ts` (新建)

- [ ] **Step 1: 创建章节 CRUD API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const textbookId = new URL(req.url).searchParams.get('textbookId');

    if (!textbookId) {
      return NextResponse.json({ error: '缺少 textbookId' }, { status: 400 });
    }

    const chapters = await prisma.chapter.findMany({
      where: { textbookId },
      orderBy: [{ chapterNumber: 'asc' }, { sectionNumber: 'asc' }],
      include: {
        _count: { select: { knowledgePoints: true } }
      }
    });

    return NextResponse.json({ success: true, data: chapters });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { textbookId, chapterNumber, chapterName, sectionNumber, sectionName, parentId } = body;

    const chapter = await prisma.chapter.create({
      data: { textbookId, chapterNumber, chapterName, sectionNumber, sectionName, parentId }
    });

    await prisma.auditLog.create({
      data: { userId: admin.userId, action: 'create', entity: 'chapter', entityId: chapter.id, changes: { before: null, after: chapter } }
    });

    return NextResponse.json({ success: true, data: chapter });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

**文件:** `app/api/admin/chapters/[id]/route.ts` (新建)

- [ ] **Step 2: 创建章节更新/删除 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = await req.json();
    const chapter = await prisma.chapter.update({
      where: { id },
      data: body
    });
    return NextResponse.json({ success: true, data: chapter });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    await prisma.chapter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/chapters/
git commit -m "feat: add chapter CRUD API"
```

---

### Task 5: 概念管理 API

**文件:** `app/api/admin/concepts/route.ts` (新建)

- [ ] **Step 1: 创建概念 CRUD API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
    const concepts = await prisma.knowledgeConcept.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { instances: true } }
      }
    });
    return NextResponse.json({ success: true, data: concepts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { name, category, weight } = body;

    if (!name) {
      return NextResponse.json({ error: '缺少必填字段: name' }, { status: 400 });
    }

    const concept = await prisma.knowledgeConcept.create({
      data: { name, category, weight: weight || 0 }
    });

    await prisma.auditLog.create({
      data: { userId: admin.userId, action: 'create', entity: 'concept', entityId: concept.id, changes: { before: null, after: concept } }
    });

    return NextResponse.json({ success: true, data: concept });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

**文件:** `app/api/admin/concepts/[id]/route.ts` (新建)

- [ ] **Step 2: 创建概念更新/删除 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = await req.json();
    const concept = await prisma.knowledgeConcept.update({
      where: { id },
      data: body
    });
    return NextResponse.json({ success: true, data: concept });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    await prisma.knowledgeConcept.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/concepts/
git commit -m "feat: add concept CRUD API"
```

---

### Task 6: 知识点实例 API

**文件:** `app/api/admin/knowledge-points/route.ts` (新建)

- [ ] **Step 1: 创建知识点实例 CRUD API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const textbookId = new URL(req.url).searchParams.get('textbookId');
    const chapterId = new URL(req.url).searchParams.get('chapterId');

    const where: any = { deletedAt: null };
    if (chapterId) where.chapterId = chapterId;
    if (textbookId) {
      where.chapter = { textbookId };
    }

    const points = await prisma.knowledgePoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: { include: { textbook: true } },
        concept: true
      }
    });

    return NextResponse.json({ success: true, data: points });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { name, chapterId, conceptId, weight = 0, inAssess = true, status = 'active' } = body;

    if (!name || !chapterId || !conceptId) {
      return NextResponse.json({ error: '缺少必填字段: name, chapterId, conceptId' }, { status: 400 });
    }

    const point = await prisma.knowledgePoint.create({
      data: { name, chapterId, conceptId, weight, inAssess, status }
    });

    await prisma.auditLog.create({
      data: { userId: admin.userId, action: 'create', entity: 'knowledge', entityId: point.id, changes: { before: null, after: point } }
    });

    return NextResponse.json({ success: true, data: point });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

**文件:** `app/api/admin/knowledge-points/[id]/route.ts` (新建)

- [ ] **Step 2: 创建知识点实例更新/删除 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    const body = await req.json();
    const point = await prisma.knowledgePoint.update({
      where: { id },
      data: body
    });
    return NextResponse.json({ success: true, data: point });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireAdmin();
    // 软删除
    await prisma.knowledgePoint.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add app/api/admin/knowledge-points/
git commit -m "feat: add knowledge-point CRUD API"
```

---

### Task 7: 更新权重验证 API

**文件:** `app/api/admin/knowledge/weight-validate/route.ts`

- [ ] **Step 1: 更新权重验证逻辑**

替换现有 `POST` 函数：

```typescript
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const points = await prisma.knowledgePoint.findMany({
      where: { deletedAt: null, inAssess: true },
      select: {
        weight: true,
        concept: { select: { weight: true } }
      }
    });

    // 混合权重计算：实例权重 > 0 用实例，否则用概念
    const totalWeight = points.reduce((sum, p) => {
      return sum + (p.weight > 0 ? p.weight : p.concept.weight);
    }, 0);

    const conceptIds = [...new Set(points.map(p => p.conceptId))];

    return NextResponse.json({
      success: true,
      data: {
        isValid: totalWeight === 100,
        total: totalWeight,
        expected: 100,
        conceptCount: conceptIds.length,
        pointCount: points.length
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add app/api/admin/knowledge/weight-validate/route.ts
git commit -m "feat: update weight validation to use concept weights"
```

---

## 阶段3: 后台管理 UI

### Task 8: 创建 DataManagementTab 组件

**目录:** `components/admin/` (新建)

- [ ] **Step 1: 创建目录和主容器组件**

```bash
mkdir -p components/admin
```

**文件:** `components/admin/DataManagementTab.tsx`

```typescript
'use client';

import { useState } from 'react';
import TextbookList from './TextbookList';
import ChapterTreeEditor from './ChapterTreeEditor';
import KnowledgePointList from './KnowledgePointList';

type DataSubTab = 'textbooks' | 'chapters' | 'points';

interface DataManagementTabProps {
  canEdit: boolean;
  canDelete: boolean;
}

export default function DataManagementTab({ canEdit, canDelete }: DataManagementTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<DataSubTab>('textbooks');
  const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* 子标签导航 */}
      <div className="flex gap-2">
        <button
          onClick={() => { setActiveSubTab('textbooks'); setSelectedChapter(null); }}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeSubTab === 'textbooks'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          教材管理
        </button>
        <button
          onClick={() => setActiveSubTab('chapters')}
          disabled={!selectedTextbook}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeSubTab === 'chapters'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          } disabled:opacity-50`}
        >
          章节管理
        </button>
        <button
          onClick={() => setActiveSubTab('points')}
          disabled={!selectedChapter}
          className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
            activeSubTab === 'points'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant'
          } disabled:opacity-50`}
        >
          知识点管理
        </button>
      </div>

      {/* 子页面 */}
      {activeSubTab === 'textbooks' && (
        <TextbookList onSelect={setSelectedTextbook} canEdit={canEdit} />
      )}
      {activeSubTab === 'chapters' && selectedTextbook && (
        <ChapterTreeEditor
          textbookId={selectedTextbook}
          onSelect={setSelectedChapter}
          canEdit={canEdit}
        />
      )}
      {activeSubTab === 'points' && selectedChapter && (
        <KnowledgePointList chapterId={selectedChapter} canEdit={canEdit} canDelete={canDelete} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/admin/DataManagementTab.tsx
git commit -m "feat: add DataManagementTab container component"
```

---

### Task 9: 创建 TextbookList 组件

**文件:** `components/admin/TextbookList.tsx`

- [ ] **Step 1: 创建教材列表组件**

```typescript
'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from '../MaterialIcon';

interface Textbook {
  id: string;
  name: string;
  publisher: string;
  grade: number;
  subject: string;
  year: string;
  status: string;
  _count: { chapters: number };
}

interface TextbookListProps {
  onSelect: (id: string | null) => void;
  canEdit: boolean;
}

export default function TextbookList({ onSelect, canEdit }: TextbookListProps) {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', publisher: '', grade: 8, subject: '数学', year: '2024' });

  useEffect(() => {
    fetch('/api/admin/textbooks')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTextbooks(data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/textbooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const data = await res.json();
      setTextbooks([...textbooks, data.data]);
      setShowModal(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">教材库</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建教材
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {textbooks.map(t => (
          <div
            key={t.id}
            className="bg-surface-container rounded-2xl p-4 cursor-pointer hover:bg-surface-container-high"
            onClick={() => onSelect(t.id)}
          >
            <div className="flex justify-between">
              <div>
                <p className="font-bold">{t.name}</p>
                <p className="text-sm text-on-surface-variant">{t.grade}年级 · {t.subject}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-on-surface-variant">{t._count.chapters} 章节</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建教材</h4>
            <div className="space-y-3">
              <input
                placeholder="教材名称"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
              <input
                placeholder="出版社"
                value={form.publisher}
                onChange={e => setForm({ ...form, publisher: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
              <input
                type="number"
                placeholder="年级"
                value={form.grade}
                onChange={e => setForm({ ...form, grade: parseInt(e.target.value) })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
              <input
                placeholder="年份"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-full bg-surface-container">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-full bg-primary text-on-primary">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/admin/TextbookList.tsx
git commit -m "feat: add TextbookList component"
```

---

### Task 10: 创建 ChapterTreeEditor 组件

**文件:** `components/admin/ChapterTreeEditor.tsx`

- [ ] **Step 1: 创建章节树形编辑器组件**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Chapter {
  id: string;
  chapterNumber: number;
  chapterName: string;
  sectionNumber: number | null;
  sectionName: string | null;
  sort: number;
  _count: { knowledgePoints: number };
  children?: Chapter[];
}

interface ChapterTreeEditorProps {
  textbookId: string;
  onSelect: (id: string | null) => void;
  canEdit: boolean;
}

export default function ChapterTreeEditor({ textbookId, onSelect, canEdit }: ChapterTreeEditorProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ chapterNumber: 1, chapterName: '' });

  useEffect(() => {
    fetch(`/api/admin/chapters?textbookId=${textbookId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setChapters(data.data);
      })
      .finally(() => setLoading(false));
  }, [textbookId]);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, textbookId })
    });
    if (res.ok) {
      const data = await res.json();
      setChapters([...chapters, data.data]);
      setShowModal(false);
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">章节管理</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建章节
          </button>
        )}
      </div>

      <div className="space-y-2">
        {chapters.map(ch => (
          <div
            key={ch.id}
            className="bg-surface-container rounded-xl p-4 cursor-pointer hover:bg-surface-container-high"
            onClick={() => onSelect(ch.id)}
          >
            <div className="flex justify-between">
              <p className="font-bold">第{ch.chapterNumber}章 {ch.chapterName}</p>
              <span className="text-sm text-on-surface-variant">{ch._count.knowledgePoints} 知识点</span>
            </div>
          </div>
        ))}
      </div>

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建章节</h4>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="章节号"
                value={form.chapterNumber}
                onChange={e => setForm({ ...form, chapterNumber: parseInt(e.target.value) })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
              <input
                placeholder="章节名称"
                value={form.chapterName}
                onChange={e => setForm({ ...form, chapterName: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-full bg-surface-container">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-full bg-primary text-on-primary">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/admin/ChapterTreeEditor.tsx
git commit -m "feat: add ChapterTreeEditor component"
```

---

### Task 11: 创建 KnowledgePointList 组件

**文件:** `components/admin/KnowledgePointList.tsx`

- [ ] **Step 1: 创建知识点列表组件（包含概念选择器）**

```typescript
'use client';

import { useState, useEffect } from 'react';

interface KnowledgePoint {
  id: string;
  name: string;
  weight: number;
  inAssess: boolean;
  status: string;
  concept: { id: string; name: string; weight: number };
}

interface Concept {
  id: string;
  name: string;
  category: string | null;
  weight: number;
}

interface KnowledgePointListProps {
  chapterId: string;
  canEdit: boolean;
  canDelete: boolean;
}

export default function KnowledgePointList({ chapterId, canEdit, canDelete }: KnowledgePointListProps) {
  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', conceptId: '', weight: 0 });

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/knowledge-points?chapterId=${chapterId}`).then(r => r.json()),
      fetch('/api/admin/concepts').then(r => r.json())
    ]).then(([pointsData, conceptsData]) => {
      if (pointsData.success) setPoints(pointsData.data);
      if (conceptsData.success) setConcepts(conceptsData.data);
    }).finally(() => setLoading(false));
  }, [chapterId]);

  const handleCreate = async () => {
    const res = await fetch('/api/admin/knowledge-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, chapterId, inAssess: true, status: 'active' })
    });
    if (res.ok) {
      const data = await res.json();
      setPoints([...points, data.data]);
      setShowModal(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除?')) return;
    await fetch(`/api/admin/knowledge-points/${id}`, { method: 'DELETE' });
    setPoints(points.filter(p => p.id !== id));
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">知识点管理</h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-bold"
          >
            新建知识点
          </button>
        )}
      </div>

      <div className="bg-surface-container rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-on-surface-variant uppercase">
              <th className="p-4 text-left">名称</th>
              <th className="p-4 text-left">概念</th>
              <th className="p-4 text-left">权重</th>
              <th className="p-4 text-left">状态</th>
              {canDelete && <th className="p-4 text-right">操作</th>}
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.id} className="border-t border-outline-variant/10">
                <td className="p-4 font-bold">{p.name}</td>
                <td className="p-4 text-on-surface-variant">{p.concept.name}</td>
                <td className="p-4">
                  <span className="text-primary">{p.weight > 0 ? p.weight : p.concept.weight}</span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface text-on-surface-variant'}`}>
                    {p.status}
                  </span>
                </td>
                {canDelete && (
                  <td className="p-4 text-right">
                    <button onClick={() => handleDelete(p.id)} className="text-error">删除</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 创建弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-96">
            <h4 className="font-bold mb-4">新建知识点</h4>
            <div className="space-y-3">
              <input
                placeholder="知识点名称"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
              <select
                value={form.conceptId}
                onChange={e => setForm({ ...form, conceptId: e.target.value })}
                className="w-full p-2 rounded-lg bg-surface-container"
              >
                <option value="">选择概念...</option>
                {concepts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (权重: {c.weight})</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="权重 (0=使用概念权重)"
                value={form.weight}
                onChange={e => setForm({ ...form, weight: parseInt(e.target.value) || 0 })}
                className="w-full p-2 rounded-lg bg-surface-container"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-full bg-surface-container">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-full bg-primary text-on-primary" disabled={!form.name || !form.conceptId}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/admin/KnowledgePointList.tsx
git commit -m "feat: add KnowledgePointList component"
```

---

### Task 12: 集成到 ConsolePage

**文件:** `components/ConsolePage.tsx`

- [ ] **Step 1: 更新 data 标签页**

找到 `case 'data':` 部分（约 line 122-229），替换为：

```typescript
case 'data':
  return (
    <DataManagementTab canEdit={canEdit} canDelete={canDelete} />
  );
```

并在文件顶部添加导入：

```typescript
import DataManagementTab from './admin/DataManagementTab';
```

- [ ] **Step 2: 提交**

```bash
git add components/ConsolePage.tsx
git commit -m "feat: integrate DataManagementTab to ConsolePage"
```

---

## 验证

### Task 13: 端到端验证

- [ ] **Step 1: 验证后台管理**

1. 访问 /console
2. 进入"知识点管理"标签页
3. 创建教材 → 创建章节 → 创建知识点（选择概念）
4. 验证权重计算正确

- [ ] **Step 2: 验证数据迁移**

```bash
npx tsx prisma/seed-v3.ts
```

预期输出应显示迁移的概念和实例数量。

- [ ] **Step 3: 提交验证**

```bash
git add .
git commit -m "test: verify knowledge tree filter E2E"
```

---

## 完成检查清单

- [ ] 数据库迁移成功应用
- [ ] 种子数据和迁移脚本运行成功
- [ ] 所有 CRUD API 正常工作
- [ ] 权重验证正确使用混合模式
- [ ] DataManagementTab 组件正常工作
- [ ] 子标签切换和选择流程正常
- [ ] ConsolePage 集成成功

---

## 回滚计划

```bash
# 回滚数据库迁移
npx prisma migrate resolve --rolled-back [migration_name]

# 恢复代码
git revert [commit]
```
