# 年级科目知识点筛选系统设计文档 v2

**日期:** 2026-04-23
**状态:** 设计中
**版本:** v2 - 补充后台管理和兼容性设计

## 1. 需求概述

### 1.1 功能需求
1. 支持用户选择年级、科目、教材版本
2. 知识点按年级+科目+教材版本筛选展示
3. 知识点按教材章节顺序排列
4. 用户可勾选/取消勾选知识点（整章或单个）
5. 智能推荐：根据学习进度自动推荐应勾选的知识点
6. 练习/测评仅使用勾选范围内的知识点
7. **后台管理：教材、章节、知识点（概念+实例模式）**

### 1.2 用户故事
- 作为学生，我希望设置我的年级和教材，这样练习内容匹配我正在学习的内容
- 作为学生，我希望选择我学过的章节，这样测评只考我学过的内容
- 作为学生，我希望系统能根据我的学习进度自动推荐要练习的知识点
- 作为管理员，我希望按教材章节组织知识点，便于管理
- 作为管理员，我希望同一知识点概念能在不同教材中复用

---

## 2. 系统架构与现有系统集成

### 2.1 现有系统分析

#### 现有后台管理系统结构
```
/console
├── dashboard    - 仪表盘（统计数据）
├── template     - 模板编辑器
├── difficulty   - 难度校准
├── data         - 知识点管理 ← 需要重构
├── quality      - 质量分析
└── config       - 分数地图（权重配置）
```

#### 现有知识点数据模型
```prisma
// 现有 KnowledgePoint
model KnowledgePoint {
  id          String
  name        String
  subject     String    // "初中"/"高中" - 将移除
  category    String    // "代数"/"几何"/"统计" - 将移除
  weight      Int       // 权重 - 需重新设计
  inAssess    Boolean   // 参与测评
  status      String
}
```

### 2.2 现有后台管理系统完整分析

#### 2.2.1 现有系统架构

**前端组件：**
```
components/ConsolePage.tsx
├── 标签页系统 (Tab系统)
│   ├── dashboard    - 仪表盘（统计数据）
│   ├── template     - 模板编辑器
│   ├── difficulty   - 难度校准
│   ├── data         - 知识点管理 ← 需要重构
│   ├── quality      - 质量分析
│   └── config       - 分数地图（权重配置）
├── 权限系统 (角色: admin/editor/viewer)
└── EditModal        - 知识点编辑弹窗
```

**API 路由：**
```
app/api/admin/
├── knowledge/
│   ├── route.ts              - GET(list), POST(create)
│   ├── [id]/route.ts         - PUT(update), DELETE(soft)
│   ├── [id]/restore/route.ts - 恢复删除
│   └── weight-validate/route.ts - 权重验证
├── templates/
│   ├── route.ts              - GET(list), POST(create)
│   └── [id]/
│       ├── route.ts          - GET, PUT, DELETE
│       ├── publish/route.ts  - 发布
│       ├── deploy/route.ts   - 部署
│       └── rollback/route.ts - 回滚
├── analytics/
│   └── difficulty-matrix/route.ts - 难度矩阵
├── audit-logs/route.ts       - 审计日志
├── users/route.ts            - 用户管理
└── login/me/logout/*         - 认证相关
```

**数据模型 (Prisma)：**
```prisma
// 核心模型
User {
  grade, targetScore, ... (现有字段)
  assessments Assessment[]
  knowledge UserKnowledge[]
}

KnowledgePoint {
  id, name, subject, category, weight, inAssess, status
  histories KnowledgePointHistory[]
  templates Template[]
}

Template {
  id, name, type, structure, params, steps, version, status
  knowledgeId String?  // 关联知识点
  knowledge KnowledgePoint?
}

Admin {
  id, userId, role  // admin/editor/viewer
  user User
  auditLogs AuditLog[]
  templates Template[]
}

KnowledgePointHistory {
  id, knowledgeId, field, oldValue, newValue, operator, reason
  knowledge KnowledgePoint
}
```

**Hooks (useAdminData.ts)：**
```typescript
- useKnowledgePoints(page, limit, filters) - 知识点列表
- useTemplates() - 模板列表
- useDifficultyMatrix() - 难度矩阵
- useWeightValidation() - 权重验证
- useAdminUser() - 当前管理员用户
```

#### 2.2.2 集成影响矩阵（详细版）

| 组件 | 影响级别 | 变化内容 | 代码位置 |
|------|---------|---------|---------|
| **前端组件** ||||
| `ConsolePage.tsx` | 🔴 高 | data标签页重构为3个子标签，新增子标签切换UI | components/ConsolePage.tsx:120-230 |
| EditModal | 🔴 高 | 新增教材/章节选择器，概念选择器 | components/ConsolePage.tsx:677-780 |
| **API路由** ||||
| `/api/admin/knowledge` | 🔴 高 | POST需指定chapterId/conceptId，GET需兼容旧字段 | app/api/admin/knowledge/route.ts:58-100 |
| `/api/admin/knowledge/[id]` | 🔴 高 | PUT需处理新字段，history记录扩展 | app/api/admin/knowledge/[id]/route.ts:5-86 |
| **新增API** ||||
| `/api/admin/textbooks` | 🟢 新增 | 教材CRUD | 新建 |
| `/api/admin/chapters` | 🟢 新增 | 章节CRUD + 树形结构 | 新建 |
| `/api/admin/concepts` | 🟢 新增 | 概念CRUD | 新建 |
| **数据模型** ||||
| `KnowledgePoint` | 🔴 高 | 新增chapterId, conceptId字段，移除subject/category | prisma/schema.prisma:189-203 |
| `User` | 🟡 中 | 新增selectedGrade, selectedSubject等字段 | prisma/schema.prisma:13-42 |
| `UserKnowledge` | 🟢 低 | 无变化，继续关联knowledgePoint实例ID | prisma/schema.prisma:115-126 |
| `Template` | 🟢 低 | knowledgeId继续指向实例，无需修改 | prisma/schema.prisma:220-239 |
| **Hooks** ||||
| `useKnowledgePoints` | 🟡 中 | 新增教材/章节过滤参数 | lib/hooks/useAdminData.ts:57-115 |
| `useWeightValidation` | 🟡 中 | 权重计算改为去重概念后累加 | lib/hooks/useAdminData.ts |
| **其他系统** ||||
| 分数地图(config) | 🟡 中 | 权重计算规则调整：按概念去重 | components/ConsolePage.tsx:474-506 |
| 难度校准 | 🟢 低 | 通过知识点ID关联，无影响 | components/ConsolePage.tsx:298-471 |
| 质量分析 | 🟢 低 | 通过模板关联，无影响 | components/QualityAnalysis.tsx |
| 权限系统 | 🟢 低 | 基于角色，新功能沿用现有权限 | lib/admin-auth.ts |
| 审计日志 | 🟢 低 | 新增表/字段自动记录，无需修改 | prisma/schema.prisma:269+ |

### 2.3 兼容性策略详解

#### 2.3.1 API 兼容性设计

**旧API保留（兼容模式）：**
```typescript
// GET /api/admin/knowledge (保留兼容)
// 旧客户端继续工作，通过 join 获取 subject/category
export async function GET(req: NextRequest) {
  const items = await prisma.knowledgePoint.findMany({
    include: {
      chapter: {
        include: {
          textbook: { select: { grade: true, subject: true } }
        }
      }
    }
  });

  // 兼容旧格式：从教材信息推导 subject
  const legacyFormat = items.map(item => ({
    ...item,
    subject: item.chapter?.textbook?.subject === '数学'
      ? (item.chapter?.textbook?.grade <= 9 ? '初中' : '高中')
      : item.chapter?.textbook?.subject,
    category: item.concept?.category || '未分类'
  }));

  return NextResponse.json({ success: true, data: legacyFormat });
}
```

**新API（增量）：**
```typescript
// POST /api/admin/knowledge (新逻辑)
export async function POST(req: NextRequest) {
  const { name, chapterId, conceptId, weight, inAssess, status } = body;

  // 验证必填
  if (!chapterId || !conceptId) {
    return NextResponse.json(
      { error: '必须指定章节和概念' },
      { status: 400 }
    );
  }

  const knowledge = await prisma.knowledgePoint.create({
    data: { name, chapterId, conceptId, weight, inAssess, status }
  });

  return NextResponse.json({ success: true, data: knowledge });
}
```

**新增API端点：**
```typescript
GET    /api/admin/textbooks              // 教材列表
POST   /api/admin/textbooks              // 创建教材
PUT    /api/admin/textbooks/[id]         // 更新教材
DELETE /api/admin/textbooks/[id]         // 删除教材

GET    /api/admin/chapters?textbookId=xxx  // 章节树
POST   /api/admin/chapters                  // 创建章节
PUT    /api/admin/chapters/[id]             // 更新章节
DELETE /api/admin/chapters/[id]             // 删除章节
PUT    /api/admin/chapters/[id]/reorder     // 调整顺序

GET    /api/admin/concepts               // 概念列表
POST   /api/admin/concepts               // 创建概念
PUT    /api/admin/concepts/[id]          // 更新概念
GET    /api/admin/concepts/[id]/instances // 概念的所有实例
```

#### 2.3.2 数据迁移路径

**Phase 1: 添加新表（不影响现有数据）**
```sql
-- 新增表，不影响现有数据
CREATE TABLE TextbookVersion (...);
CREATE TABLE Chapter (...);
CREATE TABLE KnowledgeConcept (...);
CREATE TABLE UserEnabledKnowledge (...);
```

**Phase 2: 创建默认教材数据**
```typescript
// scripts/seed-textbooks.ts
const textbooks = [
  { grade: 7, subject: '数学', name: '人教版', year: '2024' },
  { grade: 8, subject: '数学', name: '人教版', year: '2024' },
  // ...
];
```

**Phase 3: 迁移现有知识点**
```typescript
// scripts/migrate-knowledge-points.ts

// 策略1: 按名称分组创建概念
const groupedByName = groupBy(existingPoints, 'name');
for (const [name, points] of groupedByName) {
  const concept = await prisma.knowledgeConcept.create({
    data: {
      name,
      category: points[0].category, // 从第一个提取
      weight: points[0].weight
    }
  });
  conceptMap.set(name, concept.id);
}

// 策略2: 为每种 subject 创建默认教材和"未分类"章节
const defaultTextbook = await prisma.textbookVersion.upsert({
  where: { grade_subject_name: { grade: 7, subject: '数学', name: '人教版' } },
  create: { grade: 7, subject: '数学', name: '人教版', year: '2024' }
});

const uncategorizedChapter = await prisma.chapter.create({
  data: {
    textbookId: defaultTextbook.id,
    chapterNumber: 0,
    chapterName: '未分类（迁移数据）',
    sort: 999
  }
});

// 策略3: 更新知识点实例
await prisma.knowledgePoint.updateMany({
  data: {
    chapterId: uncategorizedChapter.id,
    conceptId: conceptMap.get(point.name)
  }
});
```

**Phase 4: 更新后台管理界面**
- 重构 data 标签页为3个子标签
- 更新知识点创建/编辑表单

**Phase 5: 废弃旧 API（3个月后）**
```typescript
// 添加 deprecation 警告
export async function GET(req: NextRequest) {
  // 添加警告头
  return NextResponse.json(
    { data: legacyFormat, _warning: 'deprecated: use new API' },
    { headers: { 'X-API-Deprecation': 'Use /api/admin/knowledge-points with chapterId filter' } }
  );
}
```

#### 2.3.3 前端兼容性

**知识点列表组件：**
```typescript
// 旧版本：直接显示 subject, category
<table>
  <tr>
    <td>{item.subject}</td>
    <td>{item.category}</td>
  </tr>
</table>

// 新版本：通过 chapter 获取，保留旧字段兼容
<table>
  <tr>
    <td>{item.subject || item.chapter?.textbook?.subject}</td>
    <td>{item.category || item.concept?.category}</td>
  </tr>
</table>
```

**创建知识点表单：**
```typescript
// 旧版本表单
<select name="subject">
  <option>初中</option>
  <option>高中</option>
</select>
<select name="category">
  <option>代数</option>
  <option>几何</option>
</select>

// 新版本表单（级联选择）
<select name="textbookId" onChange={loadChapters}>
  <option>选择教材版本...</option>
</select>
<select name="chapterId">
  <option>选择章节...</option>
</select>
<select name="conceptId">
  <option>选择或创建概念...</option>
</select>
```

#### 2.3.4 权重系统迁移

**旧权重计算：**
```typescript
// 所有 inAssess=true 的知识点权重总和 = 100
const totalWeight = knowledgePoints
  .filter(k => k.inAssess)
  .reduce((sum, k) => sum + k.weight, 0);
```

**新权重计算：**
```typescript
// 用户勾选的知识点中，去重概念后计算总权重
async function calculateTotalWeight(enabledPointIds: string[]): number {
  // 1. 获取勾选的知识点实例
  const points = await prisma.knowledgePoint.findMany({
    where: { id: { in: enabledPointIds } },
    select: { conceptId: true },
    distinct: ['conceptId'] // 去重概念
  });

  // 2. 累加概念权重
  const concepts = await prisma.knowledgeConcept.findMany({
    where: { id: { in: points.map(p => p.conceptId) } },
    select: { weight: true }
  });

  return concepts.reduce((sum, c) => sum + c.weight, 0);
}
```

**迁移影响：**
- 分数地图显示逻辑需要更新
- 权重验证API需要修改
- 后台config标签页需要适配
- GET /api/admin/textbooks
- GET /api/admin/chapters
```

#### 数据迁移路径
```
Phase 1: 添加新表（不影响现有数据）
Phase 2: 创建默认教材和章节
Phase 3: 迁移现有知识点为"实例"
Phase 4: 更新后台管理界面
Phase 5: 废弃旧 API（3个月后）
```

---

## 3. 数据模型

### 3.1 新增表

#### TextbookVersion（教材版本表）
```prisma
model TextbookVersion {
  id          String   @id @default(cuid())
  name        String   // "人教版", "北师大版"
  publisher   String?  // "人民教育出版社"
  grade       Int      // 7-12
  subject     String   // "数学", "物理", "化学"
  year        String?  // "2024版"
  status      String   @default("active") // active, archived
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

  textbook        TextbookVersion  @relation(fields: [textbookId], references: [id])
  parent          Chapter?         @relation("ChapterHierarchy", fields: [parentId], references: [id])
  children        Chapter[]        @relation("ChapterHierarchy")
  knowledgePoints KnowledgePoint[]
  enabledBy       UserEnabledKnowledge[]

  @@index([textbookId, parentId])
}
```

#### KnowledgeConcept（知识点概念表）- 新增
```prisma
model KnowledgeConcept {
  id          String    @id @default(cuid())
  name        String    // "勾股定理" - 概念名称
  description String?   // 概念描述
  category    String?   // "几何"、"代数" - 从知识点提取
  weight      Int       @default(0) // 权重（概念级别）
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  instances   KnowledgePoint[] // 该概念的所有实例
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

### 3.2 修改现有表

#### User（用户表扩展）
```prisma
model User {
  // ... 现有字段保持不变

  // 新增字段
  selectedGrade      Int?      // 选择的年级 (7-12)
  selectedSubject    String?   // 选择的科目
  selectedTextbookId String?   // 选择的教材版本ID
  studyProgress      Int       @default(0) // 学习进度百分比 0-100

  enabledKnowledge   UserEnabledKnowledge[]
}
```

#### KnowledgePoint（知识点表重构）
```prisma
model KnowledgePoint {
  id          String    @id @default(cuid())
  chapterId   String    // 关联章节（新增）
  conceptId   String    // 关联概念（新增）
  name        String    // 实例名称（可覆盖概念名）
  weight      Int       @default(0) // 实例权重（可选覆盖概念权重）
  inAssess    Boolean   @default(true) // 参与测评
  status      String    @default("active") // active/draft/archived
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  chapter     Chapter           @relation(fields: [chapterId], references: [id])
  concept     KnowledgeConcept  @relation(fields: [conceptId], references: [id]) // 新增

  // 保持现有的关联
  histories   KnowledgePointHistory[]
  templates   Template[]
  enabledBy   UserEnabledKnowledge[]
}
```

### 3.3 概念+实例模式说明

```
概念层 (KnowledgeConcept):
├── 勾股定理 (weight: 10)
├── 绝对值 (weight: 5)
└── 有理数运算 (weight: 8)

实例层 (KnowledgePoint):
├── 勾股定理_人教版8年级_ch3 (chapterId: xxx, conceptId: yyy)
├── 勾股定理_苏教版8年级_ch5 (chapterId: aaa, conceptId: yyy)
├── 绝对值_人教版7年级_ch1 (chapterId: bbb, conceptId: zzz)
└── ...
```

**优势**:
1. 同一概念可在多本教材中复用
2. 概念级别的权重统一管理
3. 分析学生掌握度时可按概念聚合

### 3.4 数据关系图
```
User (1) ────── (N) UserEnabledKnowledge
                      │
                      ├── nodeId → Chapter.id (nodeType='chapter')
                      └── nodeId → KnowledgePoint.id (nodeType='point')

TextbookVersion (1) ────── (N) Chapter
                              │
                              ├── parent (自关联)
                              └── (1) ── (N) KnowledgePoint
                                        │
                                        └── (N) ── (1) KnowledgeConcept
```

---

## 4. 后台管理系统设计

### 4.1 ConsolePage.tsx 重构详解

#### 4.1.1 现有代码结构分析

**当前 data 标签页渲染逻辑（ConsolePage.tsx:120-230）：**
```typescript
// 当前实现：单一表格视图
case 'data':
  return (
    <div className="space-y-6">
      {/* 筛选器 */}
      <input placeholder="搜索知识点..." value={filters.search} />
      <select value={filters.subject}>
        <option>全部学科</option>
        <option>初中</option>
        <option>高中</option>
      </select>

      {/* 知识点表格 */}
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>学科</th>      // ← 需要移除，改为显示教材
            <th>分类</th>      // ← 需要移除，改为显示章节
            <th>权重</th>
            <th>参与测评</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {knowledgePoints.map(item => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.subject}</td>    // ← 需要修改
              <td>{item.category}</td>   // ← 需要修改
              ...
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
```

#### 4.1.2 新代码结构设计

**重构后的 data 标签页：**
```typescript
// 新实现：子标签切换
case 'data':
  return (
    <DataManagementTab        // 新组件
      activeSubTab={dataSubTab}  // 'textbooks' | 'chapters' | 'points'
      onSubTabChange={setDataSubTab}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
```

**DataManagementTab 组件结构：**
```typescript
// components/DataManagementTab.tsx (新建)

type DataSubTab = 'textbooks' | 'chapters' | 'points';

interface DataManagementTabProps {
  activeSubTab: DataSubTab;
  onSubTabChange: (tab: DataSubTab) => void;
  canEdit: boolean;
  canDelete: boolean;
}

const DataManagementTab: React.FC<DataManagementTabProps> = ({
  activeSubTab, onSubTabChange, canEdit, canDelete
}) => {
  // 共享状态
  const [selectedTextbook, setSelectedTextbook] = useState<string>();
  const [selectedChapter, setSelectedChapter] = useState<string>();

  return (
    <div className="space-y-6">
      {/* 子标签导航 */}
      <div className="flex gap-2">
        <button
          className={activeSubTab === 'textbooks' ? 'bg-primary text-on-primary' : ''}
          onClick={() => onSubTabChange('textbooks')}
        >
          教材管理
        </button>
        <button
          className={activeSubTab === 'chapters' ? 'bg-primary text-on-primary' : ''}
          onClick={() => onSubTabChange('chapters')}
          disabled={!selectedTextbook}
        >
          章节管理
        </button>
        <button
          className={activeSubTab === 'points' ? 'bg-primary text-on-primary' : ''}
          onClick={() => onSubTabChange('points')}
          disabled={!selectedChapter}
        >
          知识点管理
        </button>
      </div>

      {/* 子标签内容 */}
      {activeSubTab === 'textbooks' && <TextbookList onSelect={setSelectedTextbook} />}
      {activeSubTab === 'chapters' && <ChapterTree textbookId={selectedTextbook} onSelect={setSelectedChapter} />}
      {activeSubTab === 'points' && <KnowledgePointList chapterId={selectedChapter} canEdit={canEdit} />}
    </div>
  );
};
```

#### 4.1.3 EditModal 重构

**现有编辑弹窗（ConsolePage.tsx:677-780）：**
```typescript
// 现有实现：固定字段表单
<div className="space-y-4">
  <div>
    <label>学科</label>
    <select value={editForm.subject}>
      <option>初中</option>
      <option>高中</option>
    </select>
  </div>
  <div>
    <label>分类</label>
    <select value={editForm.category}>
      <option>代数</option>
      <option>几何</option>
      <option>统计</option>
    </select>
  </div>
  <div>
    <label>权重</label>
    <input type="number" value={editForm.weight} />
  </div>
  ...
</div>
```

**新编辑弹窗设计：**
```typescript
// 新实现：级联选择器 + 概念选择
<div className="space-y-4">
  {/* 级联选择：教材 -> 章节 */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label>教材版本</label>
      <select
        value={editForm.textbookId}
        onChange={e => loadChapters(e.target.value)}
      >
        <option value="">选择教材...</option>
        {textbooks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
    <div>
      <label>章节</label>
      <select
        value={editForm.chapterId}
        onChange={e => setEditForm({...editForm, chapterId: e.target.value})}
      >
        <option value="">选择章节...</option>
        {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  </div>

  {/* 概念选择器：可搜索、可创建 */}
  <div>
    <label>知识点概念</label>
    <ConceptSelector
      value={editForm.conceptId}
      onChange={conceptId => setEditForm({...editForm, conceptId})}
      onCreateNew={handleCreateConcept}
    />
  </div>

  {/* 实例权重（可选覆盖概念权重） */}
  <div>
    <label>权重（留空则使用概念权重）</label>
    <input
      type="number"
      placeholder={selectedConcept?.weight}
      value={editForm.weight || ''}
      onChange={e => setEditForm({...editForm, weight: parseInt(e.target.value)})}
    />
  </div>
</div>
```

#### 4.1.4 hooks 扩展

**useAdminData.ts 新增 hooks：**
```typescript
// 新增：教材管理
export function useTextbooks(filters?: { grade?: number; subject?: string }) {
  const [data, setData] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters?.grade) params.append('grade', String(filters.grade));
    if (filters?.subject) params.append('subject', filters.subject);

    fetch(`/api/admin/textbooks?${params}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  return { data, loading };
}

// 新增：章节树
export function useChapterTree(textbookId?: string) {
  const [tree, setTree] = useState<ChapterNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!textbookId) return;

    fetch(`/api/admin/chapters?textbookId=${textbookId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setTree(json.tree);
      })
      .finally(() => setLoading(false));
  }, [textbookId]);

  return { tree, loading };
}

// 修改：知识点列表（新增章节过滤）
export function useKnowledgePoints(
  page = 1,
  limit = 20,
  filters?: {
    subject?: string;
    status?: string;
    search?: string;
    chapterId?: string;  // ← 新增
    textbookId?: string; // ← 新增
  }
) {
  // ... 现有逻辑
  // 在 URL 参数中添加 chapterId 和 textbookId
}
```

### 4.2 data 标签页子页面设计
```
┌─────────────────────────────────────────┐
│ Data                                    │
├─────────────────────────────────────────┤
│ [教材管理] [章节管理] [知识点管理]      │
├─────────────────────────────────────────┤
│                                         │
│ (子标签内容...)                         │
│                                         │
└─────────────────────────────────────────┘
```

#### 子标签1: 教材管理

```
┌─────────────────────────────────────────┐
│ 教材库                    [+ 新建教材]  │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ 人教版 2024 ──────────────────────┐ │
│ │ 数学 · 7年级 · 人民教育出版社       │ │
│ │ 章节: 12章  知识点: 85个  [编辑]    │ │
│ └────────────────────────────────────┘ │
│                                         │
│ ┌─ 北师大版 2024 ────────────────────┐ │
│ │ 数学 · 7年级 · 北京师范大学出版社   │ │
│ │ 章节: 10章  知识点: 72个  [编辑]    │ │
│ └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**功能**:
- 创建/编辑/删除教材版本
- 查看教材统计（章节数、知识点数）
- 启用/归档教材

#### 子标签2: 章节管理

```
┌─────────────────────────────────────────┐
│ 章节管理                                │
│ [人教版 2024 ▼]  [树形视图] [列表视图]  │
├─────────────────────────────────────────┤
│                                         │
│ ▼ 第一章 有理数              [编辑] [×] │
│   ▼ 1.1 正数和负数         [编辑] [×] │
│     · 绝对值的概念         [→]         │
│     · 相反数的概念         [→]         │
│   ▼ 1.2 有理数运算         [编辑] [×] │
│ ▶ 第二章 整式                           │
│                                         │
└─────────────────────────────────────────┘
```

**功能**:
- 选择教材后管理其章节
- 树形视图：拖拽排序、右键菜单、折叠展开
- 列表视图：表格形式、批量编辑
- 创建/编辑/删除章节

#### 子标签3: 知识点管理（重构）

```
┌─────────────────────────────────────────┐
│ 知识点管理                                │
│ [人教版 2024 ▼] [第一章 有理数 ▼]       │
├─────────────────────────────────────────┤
│                                         │
│ ┌─ 绝对值的概念 ─────────────────────┐ │
│ │ 概念: 绝对值  权重: 5  [→ 概念]     │ │
│ │ 状态: active  测评: ✓               │ │
│ │                         [编辑] [×]  │ │
│ └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**功能**:
- 按教材 > 章节筛选知识点
- 显示关联的概念信息
- 创建知识点时选择/创建概念
- 支持从现有概念创建新实例

### 4.2 后台 API 设计

#### 教材管理 API
```
GET    /api/admin/textbooks              # 获取教材列表
POST   /api/admin/textbooks              # 创建教材
PUT    /api/admin/textbooks/[id]         # 更新教材
DELETE /api/admin/textbooks/[id]         # 删除教材
```

#### 章节管理 API
```
GET    /api/admin/chapters?textbookId=xxx  # 获取章节树
POST   /api/admin/chapters                  # 创建章节
PUT    /api/admin/chapters/[id]             # 更新章节
DELETE /api/admin/chapters/[id]             # 删除章节
PUT    /api/admin/chapters/[id]/reorder     # 调整顺序
```

#### 知识点概念 API（新增）
```
GET    /api/admin/concepts               # 获取概念列表
POST   /api/admin/concepts               # 创建概念
PUT    /api/admin/concepts/[id]          # 更新概念
GET    /api/admin/concepts/[id]/instances # 获取概念的所有实例
```

#### 知识点实例 API（修改）
```
GET    /api/admin/knowledge-points?chapterId=xxx  # 获取知识点实例
POST   /api/admin/knowledge-points                  # 创建实例（需选择概念）
PUT    /api/admin/knowledge-points/[id]             # 更新实例
DELETE /api/admin/knowledge-points/[id]             # 删除实例
```

### 4.3 后台 UI 组件

#### TextbookList 组件
- 教材卡片列表
- 创建/编辑教材弹窗
- 教材统计显示

#### ChapterTreeEditor 组件
- 树形视图：可拖拽、右键菜单
- 列表视图：表格形式、批量编辑
- 视图切换按钮

#### ConceptSelector 组件
- 创建知识点时选择或创建概念
- 显示概念的跨教材使用情况
- 搜索现有概念

---

## 5. 用户端设计

### 5.1 用户设置 API

#### 获取用户设置
```
GET /api/user/settings

Response:
{
  "grade": 7,
  "subject": "数学",
  "textbookId": "xxx",
  "textbookName": "人教版 2024",
  "progress": 40
}
```

#### 更新用户设置
```
PUT /api/user/settings
Body: { grade: 7, subject: "数学", textbookId: "xxx" }
```

#### 更新学习进度
```
PUT /api/user/settings/progress
Body: { progress: 40 }
```

### 5.2 知识点树 API

#### 获取教材列表
```
GET /api/textbooks?grade=7&subject=数学

Response:
{
  "textbooks": [
    { "id": "xxx", "name": "人教版", "year": "2024" },
    { "id": "yyy", "name": "北师大版", "year": "2024" }
  ]
}
```

#### 获取知识点树
```
GET /api/knowledge/tree?textbookId=xxx

Response:
{
  "tree": [
    {
      "id": "chapter1",
      "type": "chapter",
      "name": "第一章 有理数",
      "number": "1",
      "enabled": true,
      "children": [
        {
          "id": "point1",
          "type": "point",
          "name": "绝对值的定义",
          "enabled": true
        }
      ]
    }
  ]
}
```

#### 勾选/取消勾选节点
```
PUT /api/knowledge/enable
Body: {
  nodeId: "xxx",
  nodeType: "chapter",
  enabled: true
}

Response:
{
  "affected": ["xxx", "yyy", "zzz"] // 被影响的所有节点ID
}
```

#### 智能推荐
```
POST /api/knowledge/smart-enable
Body: {
  progress: 40
}

Response:
{
  "enabled": ["xxx", "yyy"], // 被勾选的节点ID
  "message": "已推荐前2章内容"
}
```

### 5.3 题目筛选修改

#### 获取题目（修改）
```
GET /api/questions
  ?grade=7
  &subject=数学
  &textbookId=xxx
  &enabledOnly=true  // 只返回勾选知识点相关的题目

现有参数保持兼容，新增筛选参数。
```

### 5.4 首次引导流程

**入口:** 用户首次登录检测 `selectedGrade` 为空

**步骤:**
1. 欢迎页：说明设置年级和教材的重要性
2. 选择年级（7-12）→ 单选按钮
3. 选择科目 → 单选按钮
4. 选择教材版本 → 根据年级+科目过滤显示
5. 设置学习进度 → 滑块（显示推荐章节预览）
6. 完成引导 → 跳转主页

### 5.5 我的-设置页面

**布局:**
```
┌─────────────────────────────────┐
│ < 我的        设置               │
├─────────────────────────────────┤
│                                 │
│ ┌─ 学习设置 ─────────────────┐ │
│ │ 📚 年级: 初一 (7年级)  [>]  │ │
│ │ 📖 科目: 数学            [>] │ │
│ │ 📕 教材: 人教版 2024     [>] │ │
│ │ 📊 进度: 40% ========    [>] │ │
│ └────────────────────────────┘ │
│                                 │
│ ┌─ 知识点选择 ───────────────┐ │
│ │ [🤖智能推荐] [✓全选] [✗清空]│ │
│ │                             │ │
│ │ ▶ 第一章 有理数            │ │
│ │   ├ ☑ 1.1 绝对值           │ │
│ │   └ ☑ 1.2 有理数运算       │ │
│ │ ▶ 第二章 整式              │ │
│ │   └ ☐ 2.1 单项式           │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│           [保存设置]            │
└─────────────────────────────────┘
```

---

## 6. 智能推荐算法

### 6.1 推荐逻辑

```typescript
function recommendKnowledgePoints(
  userId: string,
  textbookId: string,
  progress: number
): string[] {
  // 1. 获取该教材所有顶层章节数量
  const chapters = getTopLevelChapters(textbookId);
  const totalChapters = chapters.length;

  // 2. 计算应推荐的章节数
  const targetChapterCount = Math.floor(totalChapters * progress / 100);

  // 3. 获取前N个章节及其所有子节点
  const targetChapters = chapters.slice(0, targetChapterCount);
  const allNodeIds = flattenChapterTree(targetChapters);

  // 4. 勾选这些节点
  enableNodes(userId, allNodeIds);

  return allNodeIds;
}

function flattenChapterTree(chapters: Chapter[]): string[] {
  const result: string[] = [];
  for (const chapter of chapters) {
    result.push(chapter.id);
    if (chapter.children) {
      result.push(...flattenChapterTree(chapter.children));
    }
  }
  return result;
}
```

### 6.2 进度计算

```typescript
// 默认进度：根据当前日期计算
function calculateDefaultProgress(): number {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 8, 1); // 9月1日开学
  const yearEnd = new Date(now.getFullYear() + 1, 0, 31); // 1月底结束
  const total = yearEnd.getTime() - yearStart.getTime();
  const elapsed = now.getTime() - Math.min(yearStart.getTime(), now.getTime());
  return Math.min(100, Math.max(0, Math.floor((elapsed / total) * 100)));
}
```

---

## 7. 权重系统重新设计

### 7.1 旧权重系统问题

**现有设计**: 所有 `inAssess=true` 的知识点权重总和 = 100

**问题**:
- 知识点按教材拆分后，不同教材的知识点无法统一计算
- 同一概念的多个实例权重重复计算

### 7.2 新权重系统

**设计原则**:
1. 权重在"概念"级别设置（KnowledgeConcept.weight）
2. 用户勾选的知识点中，去重概念后计算总权重
3. 不同教材的同一概念只计算一次权重

**计算逻辑**:
```typescript
function calculateTotalWeight(enabledPointIds: string[]): number {
  // 1. 获取所有勾选的知识点实例
  const points = await prisma.knowledgePoint.findMany({
    where: { id: { in: enabledPointIds } },
    select: { conceptId: true },
    distinct: ['conceptId'], // 去重概念
  });

  // 2. 累加概念权重
  const concepts = await prisma.knowledgeConcept.findMany({
    where: { id: { in: points.map(p => p.conceptId) } },
    select: { weight: true },
  });

  return concepts.reduce((sum, c) => sum + c.weight, 0);
}
```

### 7.3 分数地图适配

**显示逻辑**:
- 显示用户勾选范围内的概念权重
- 目标总和仍为 100
- 显示每个概念的教材实例数量

---

## 8. 模板关联策略

### 8.1 现有模板系统

```prisma
model Template {
  id          String
  knowledgeId String?  // 关联知识点
  // ...
}
```

### 8.2 关联策略决策

**决策**: 模板关联"知识点实例"（KnowledgePoint）

**原因**:
1. 不同教材的同一概念，题目表述可能不同
2. 模板参数需要根据教材调整
3. 保留现有模板的关联关系

**迁移影响**:
- 现有模板的 `knowledgeId` 继续有效
- 创建新模板时需选择教材和章节
- 同一概念的不同实例可使用不同模板

### 8.3 模板创建流程调整

**旧流程**: 选择知识点 → 创建模板

**新流程**: 
1. 选择教材版本
2. 选择章节
3. 选择知识点实例（或创建新实例）
4. 创建模板

---

## 9. 数据迁移

### 9.1 迁移步骤

**Phase 1: 添加新表（不影响现有数据）**
```bash
npx prisma migrate dev --name add_knowledge_tree_v2
```

**Phase 2: 创建默认教材数据**
```typescript
// scripts/seed-textbooks.ts
const textbooks = [
  { grade: 7, subject: '数学', name: '人教版', year: '2024' },
  { grade: 7, subject: '数学', name: '北师大版', year: '2024' },
  // ...
];
```

**Phase 3: 创建概念和章节**
```typescript
// scripts/migrate-knowledge-points.ts

// 1. 为每种 subject + category 组合创建默认教材
// 2. 为每个教材创建"未分类"章节
// 3. 从现有知识点提取概念
//    - 相同名称的知识点 → 同一概念
//    - 创建 KnowledgeConcept 记录
// 4. 为每个现有知识点创建实例
//    - 设置 chapterId 和 conceptId
//    - 保留原有的 weight, inAssess, status
```

**Phase 4: 验证和回滚**
```bash
# 验证迁移结果
npm run verify-migration

# 如需回滚
npx prisma migrate resolve --rolled-back [migration_name]
```

### 9.2 迁移脚本详细设计

```typescript
// scripts/migrate-knowledge-concepts.ts

async function migrateKnowledgePoints() {
  // 1. 按名称分组现有知识点
  const existingPoints = await prisma.knowledgePoint.findMany({
    where: { deletedAt: null },
  });

  const groupedByName = new Map<string, any[]>();
  for (const point of existingPoints) {
    if (!groupedByName.has(point.name)) {
      groupedByName.set(point.name, []);
    }
    groupedByName.get(point.name)!.push(point);
  }

  // 2. 为每组同名知识点创建概念
  const conceptMap = new Map<string, string>();

  for (const [name, points] of groupedByName) {
    const firstPoint = points[0];
    const concept = await prisma.knowledgeConcept.create({
      data: {
        name: name,
        category: firstPoint.category,
        weight: firstPoint.weight,
      },
    });
    conceptMap.set(name, concept.id);
  }

  // 3. 为每个教材创建"未分类"章节
  const textbooks = await prisma.textbookVersion.findMany();
  for (const textbook of textbooks) {
    await prisma.chapter.create({
      data: {
        textbookId: textbook.id,
        chapterNumber: 0,
        chapterName: '未分类（迁移数据）',
        sort: 999,
      },
    });
  }

  // 4. 更新知识点实例
  for (const [name, points] of groupedByName) {
    const conceptId = conceptMap.get(name)!;
    
    for (const point of points) {
      // 查找对应的教材和章节
      const textbook = await findOrCreateTextbook(point.subject);
      const chapter = await findOrCreateChapter(textbook.id);

      await prisma.knowledgePoint.update({
        where: { id: point.id },
        data: {
          chapterId: chapter.id,
          conceptId: conceptId,
        },
      });
    }
  }
}
```

### 9.3 回滚计划

```sql
-- 如需回滚
DROP TABLE UserEnabledKnowledge;
DROP TABLE Chapter;
DROP TABLE TextbookVersion;
DROP TABLE KnowledgeConcept;

-- 恢复 KnowledgePoint 原有字段（已通过迁移保留）
```

---

## 10. 实施计划

### 10.1 阶段划分

**阶段1: 数据层（2-3天）**
- Prisma schema 更新
- 数据库迁移脚本
- 种子数据（教材版本）
- 概念和实例迁移脚本

**阶段2: 后台管理（3-4天）**
- 教材管理 API 和页面
- 章节管理 API 和页面
- 知识点管理 API 重构
- 概念管理功能

**阶段3: 用户端 API（2-3天）**
- 用户设置 API
- 教材列表 API
- 知识点树 API
- 智能推荐 API
- 题目筛选修改

**阶段4: 用户端 UI（3-4天）**
- 首次引导组件
- 设置页面重构
- 知识点树选择组件
- 选择器组件（年级/科目/教材）

**阶段5: 集成测试（2天）**
- 练习页面集成筛选
- 测评页面集成筛选
- 分析页面数据过滤
- 端到端测试

### 10.2 依赖关系

```
阶段1(数据层)
    ↓
阶段2(后台管理) ← ─ ─ ─ ┐
    ↓                  │
阶段3(用户端API) ─ ─ ─ ─ ─┘
    ↓
阶段4(用户端UI)
    ↓
阶段5(集成测试)
```

### 10.3 风险点

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 数据迁移失败 | 高 | 先在测试环境验证，保留回滚脚本 |
| 概念提取不准确 | 中 | 提供后台手动调整功能 |
| 权重计算变化 | 中 | 分数地图适配新计算方式 |
| 模板关联兼容 | 低 | 模板继续关联实例ID，无需修改 |

---

## 11. 测试计划

### 11.1 单元测试
- 智能推荐算法
- 知识点树展开/收起逻辑
- 勾选状态传播逻辑
- 权重计算逻辑（去重概念）

### 11.2 集成测试
- API 端到端测试
- 数据库迁移脚本
- 用户设置与题目筛选联动
- 后台管理 CRUD

### 11.3 E2E 测试
- 首次引导流程
- 设置页面保存
- 练习页面使用筛选后的题目
- 后台教材/章节/知识点管理

---

## 12. 性能考虑

- 知识点树数据量小（<1000节点），前端全量加载
- 用户勾选状态按需获取
- 题目筛选添加数据库索引
- 概念去重使用数据库 distinct 查询

---

## 13. 未来扩展

- 支持多科目同时选择
- 支持跨年级知识点
- 知识点依赖关系（前置知识点）
- 个性化推荐（基于掌握度）
- 知识点难度自适应
