# 年级科目知识点筛选系统设计文档 v3

**日期:** 2026-04-23
**状态:** 设计中
**版本:** v3 - 修正概念+实例架构，破坏性迁移方案

## 核心决策

1. **保留双层架构** - 添加 KnowledgeConcept 表
2. **破坏性迁移** - 不保留旧API兼容性
3. **全部按8年级处理** - 现有知识点统一迁移到8年级
4. **混合权重模式** - 概念默认权重，实例可覆盖

---

## 1. 数据模型

### 1.1 新增表

#### KnowledgeConcept（知识点概念表）
```prisma
model KnowledgeConcept {
  id          String    @id @default(cuid())
  name        String    // "勾股定理" - 概念名称
  category    String?   // "几何"、"代数"
  weight      Int       @default(0) // 默认权重
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  instances   KnowledgePoint[] // 该概念的所有实例
}
```

#### TextbookVersion（教材版本表）
```prisma
model TextbookVersion {
  id          String   @id @default(cuid())
  name        String   // "人教版", "北师大版"
  publisher   String?  // "人民教育出版社"
  grade       Int      // 7-12
  subject     String   // "数学"
  year        String?  // "2024版"
  status      String   @default("active")
  chapters    Chapter[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([grade, subject, name])
  @@index([grade, subject, status])
}
```

#### Chapter（章节表）
```prisma
model Chapter {
  id              String           @id @default(cuid())
  textbookId      String           // 关联教材版本
  chapterNumber   Int              // 第几章
  chapterName     String           // "有理数"
  sectionNumber   Int?             // 第几节（可选）
  sectionName     String?          // 小节名称
  parentId        String?          // 父章节ID（用于小节）
  sort            Int              @default(0)

  textbook        TextbookVersion   @relation(fields: [textbookId], references: [id])
  parent          Chapter?         @relation("ChapterHierarchy", fields: [parentId], references: [id])
  children        Chapter[]        @relation("ChapterHierarchy")
  knowledgePoints KnowledgePoint[]

  @@index([textbookId, parentId])
}
```

#### UserEnabledKnowledge（用户勾选表）
```prisma
model UserEnabledKnowledge {
  id        String   @id @default(cuid())
  userId    String
  nodeId    String   // 章节ID或知识点ID
  nodeType  String   // "chapter" 或 "point"
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, nodeId])
  @@index([userId, nodeType])
}
```

### 1.2 修改表

#### User（用户表扩展）
```prisma
model User {
  // ... 现有字段

  // 新增字段
  selectedGrade      Int?      // 选择的年级 (7-12)
  selectedSubject    String?   // 选择的科目 (数学)
  selectedTextbookId String?   // 选择的教材版本ID
  studyProgress      Int       @default(0) // 学习进度百分比 0-100

  enabledKnowledge   UserEnabledKnowledge[]
}
```

#### KnowledgePoint（知识点表重构）
```prisma
model KnowledgePoint {
  id          String    @id @default(cuid())
  chapterId   String    // 关联章节（必填）
  conceptId   String    // 关联概念（必填）
  name        String    // 实例名称（可覆盖概念名）
  weight      Int       @default(0) // 权重：0=使用概念权重，>0=覆盖
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

### 1.3 混合权重计算
```typescript
async function getEffectiveWeight(knowledgePointId: string): Promise<number> {
  const point = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: {
      weight: true,
      concept: { select: { weight: true } }
    }
  });
  // 实例权重 > 0 用实例，否则用概念权重
  return point.weight > 0 ? point.weight : point.concept.weight;
}

async function calculateTotalWeight(): Promise<number> {
  const points = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null, inAssess: true },
    select: { weight: true, concept: { select: { weight: true } } }
  });
  return points.reduce((sum, p) => sum + getEffectiveWeight(p), 0);
}
```

---

## 2. API 设计（破坏性迁移）

### 2.1 教材管理 API
```
GET    /api/admin/textbooks              # 列表
POST   /api/admin/textbooks              # 创建
PUT    /api/admin/textbooks/[id]         # 更新
DELETE /api/admin/textbooks/[id]         # 删除
```

### 2.2 章节管理 API
```
GET    /api/admin/chapters?textbookId=   # 树形列表
POST   /api/admin/chapters               # 创建
PUT    /api/admin/chapters/[id]          # 更新
DELETE /api/admin/chapters/[id]          # 删除
PUT    /api/admin/chapters/[id]/reorder # 排序
```

### 2.3 概念管理 API（新增）
```
GET    /api/admin/concepts                # 列表
POST   /api/admin/concepts                # 创建
PUT    /api/admin/concepts/[id]          # 更新
DELETE /api/admin/concepts/[id]          # 删除
```

### 2.4 知识点实例 API
```
GET    /api/admin/knowledge-points?chapterId=  # 列表
POST   /api/admin/knowledge-points             # 创建
PUT    /api/admin/knowledge-points/[id]       # 更新
DELETE /api/admin/knowledge-points/[id]       # 删除
```

### 2.5 权重验证 API（更新）
```typescript
// POST /api/admin/knowledge/weight-validate
export async function POST(req: NextRequest) {
  const points = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null, inAssess: true },
    select: { weight: true, concept: { select: { weight: true } } }
  });

  const totalWeight = points.reduce((sum, p) => {
    return sum + (p.weight > 0 ? p.weight : p.concept.weight);
  }, 0);

  return NextResponse.json({
    success: true,
    data: {
      isValid: totalWeight === 100,
      total: totalWeight,
      expected: 100,
      conceptCount: new Set(points.map(p => p.conceptId)).size,
      pointCount: points.length
    }
  });
}
```

---

## 3. 后台管理组件设计

### 3.1 文件结构
```
components/
├── ConsolePage.tsx           # 保持不变，data标签页改为使用新组件
└── admin/
    ├── DataManagementTab.tsx     # 主容器，3个子标签切换
    ├── TextbookList.tsx          # 教材管理
    ├── ChapterTreeEditor.tsx     # 章节管理
    └── KnowledgePointList.tsx    # 知识点管理
```

### 3.2 DataManagementTab.tsx
```typescript
'use client';
import { useState } from 'react';
import TextbookList from './TextbookList';
import ChapterTreeEditor from './ChapterTreeEditor';
import KnowledgePointList from './KnowledgePointList';

type DataSubTab = 'textbooks' | 'chapters' | 'points';

export default function DataManagementTab({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<DataSubTab>('textbooks');
  const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* 子标签导航 */}
      <div className="flex gap-2">
        <button onClick={() => { setActiveSubTab('textbooks'); setSelectedChapter(null); }}
          className={activeSubTab === 'textbooks' ? 'active' : ''}>
          教材管理
        </button>
        <button onClick={() => setActiveSubTab('chapters')} disabled={!selectedTextbook}>
          章节管理
        </button>
        <button onClick={() => setActiveSubTab('points')} disabled={!selectedChapter}>
          知识点管理
        </button>
      </div>

      {/* 子页面 */}
      {activeSubTab === 'textbooks' && <TextbookList onSelect={setSelectedTextbook} />}
      {activeSubTab === 'chapters' && selectedTextbook && (
        <ChapterTreeEditor textbookId={selectedTextbook} onSelect={setSelectedChapter} />
      )}
      {activeSubTab === 'points' && selectedChapter && (
        <KnowledgePointList chapterId={selectedChapter} />
      )}
    </div>
  );
}
```

### 3.3 KnowledgePointList.tsx（知识点创建/编辑弹窗）
```typescript
// 创建/编辑弹窗中的级联选择：
// 1. 选择教材 → 2. 选择章节 → 3. 选择或创建概念
// 提交时：POST { name, chapterId, conceptId, weight, inAssess, status }
```

---

## 4. 数据迁移设计

### 4.1 迁移步骤

**Phase 1: 添加新表**
```bash
npx prisma migrate dev --name add_knowledge_tree_v3
```

**Phase 2: 种子数据**
```typescript
// 创建8年级数学教材
await prisma.textbookVersion.upsert({
  where: { grade_subject_name: { grade: 8, subject: '数学', name: '人教版' } },
  create: { grade: 8, subject: '数学', name: '人教版', year: '2024' }
});
```

**Phase 3: 创建默认章节**
```typescript
// 创建"未分类"章节
const chapter = await prisma.chapter.create({
  data: {
    textbookId: textbook.id,
    chapterNumber: 0,
    chapterName: '未分类（迁移数据）',
    sort: 999
  }
});
```

**Phase 4: 迁移知识点**
```typescript
// 1. 按名称分组创建概念
const groupedByName = groupBy(existingPoints, 'name');
for (const [name, points] of groupedByName) {
  const concept = await prisma.knowledgeConcept.create({
    data: { name, category: points[0].category, weight: points[0].weight }
  });
  conceptMap.set(name, concept.id);
}

// 2. 更新知识点实例
for (const point of existingPoints) {
  await prisma.knowledgePoint.update({
    where: { id: point.id },
    data: {
      chapterId: chapter.id,
      conceptId: conceptMap.get(point.name),
      weight: 0 // 使用概念权重
    }
  });
}
```

### 4.2 迁移后数据结构
```
KnowledgeConcept (概念层)
├── 勾股定理 (weight: 10, category: 几何)
├── 绝对值 (weight: 5, category: 代数)
└── ...

KnowledgePoint (实例层)
├── 勾股定理_8年级 (chapterId: xxx, conceptId: yyy, weight: 0)
├── 绝对值_8年级 (chapterId: xxx, conceptId: zzz, weight: 0)
└── ...
```

---

## 5. 实施计划概要

### 阶段1: 数据层 (1天)
- [ ] Prisma schema 更新
- [ ] 数据库迁移
- [ ] 种子数据（8年级数学教材）
- [ ] 数据迁移脚本

### 阶段2: API层 (2天)
- [ ] 教材 CRUD API
- [ ] 章节 CRUD API
- [ ] 概念 CRUD API
- [ ] 知识点实例 CRUD API
- [ ] 权重验证 API 更新

### 阶段3: 后台管理 UI (2天)
- [ ] DataManagementTab 组件
- [ ] TextbookList 组件
- [ ] ChapterTreeEditor 组件
- [ ] KnowledgePointList 组件
- [ ] ConsolePage 集成

### 阶段4: 用户端 (3天)
- [ ] 用户设置 API
- [ ] 知识点树 API
- [ ] 勾选/智能推荐 API
- [ ] 首次引导组件
- [ ] 设置页面

### 阶段5: 集成测试 (1天)
- [ ] 端到端测试

---

## 6. 验证方案

1. **后台管理**
   - 创建教材 → 创建章节 → 创建知识点（选择概念）
   - 验证权重计算正确

2. **数据迁移**
   - 迁移后查询知识点，应有 conceptId 和 chapterId
   - 旧字段 subject/category 可忽略

3. **用户端**
   - 选择教材 → 查看知识点树 → 勾选 → 练习
