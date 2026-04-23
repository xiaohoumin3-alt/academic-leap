# 年级科目知识点筛选系统设计文档

**日期:** 2026-04-23
**状态:** 设计中

## 1. 需求概述

### 1.1 功能需求
1. 支持用户选择年级、科目、教材版本
2. 知识点按年级+科目+教材版本筛选展示
3. 知识点按教材章节顺序排列
4. 用户可勾选/取消勾选知识点（整章或单个）
5. 智能推荐：根据学习进度自动推荐应勾选的知识点
6. 练习/测评仅使用勾选范围内的知识点

### 1.2 用户故事
- 作为学生，我希望设置我的年级和教材，这样练习内容匹配我正在学习的内容
- 作为学生，我希望选择我学过的章节，这样测评只考我学过的内容
- 作为学生，我希望系统能根据我的学习进度自动推荐要练习的知识点

## 2. 数据模型

### 2.1 新增表

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
  id            String       @id @default(cuid())
  textbookId    String       // 关联教材版本
  chapterNumber Int          // 第几章
  chapterName   String       // "有理数"
  sectionNumber Int?         // 第几节（可选）
  sectionName   String?      // 小节名称
  parentId      String?      // 父章节ID（用于小节）

  textbook      TextbookVersion @relation(fields: [textbookId], references: [id])
  parent        Chapter?      @relation("ChapterHierarchy", fields: [parentId], references: [id])
  children      Chapter[]     @relation("ChapterHierarchy")
  knowledgePoints KnowledgePoint[]

  sort          Int          @default(0)

  @@index([textbookId, parentId])
}
```

#### UserEnabledKnowledge（用户勾选表）
```prisma
model UserEnabledKnowledge {
  id              String   @id @default(cuid())
  userId          String
  nodeId          String   // 章节ID或知识点ID
  nodeType        String   // "chapter" 或 "point"
  createdAt       DateTime @default(now())

  user            User     @relation(fields: [userId], references: [id])

  @@unique([userId, nodeId])
  @@index([userId, nodeType])
}
```

### 2.2 修改现有表

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

#### KnowledgePoint（知识点表修改）
```prisma
model KnowledgePoint {
  id          String   @id @default(cuid())
  chapterId   String   // 关联章节（新增）
  name        String   // 知识点名称

  // 移除或废弃的字段：
  // subject (通过章节的教材获取)
  // category (通过章节的教材获取)
  // weight (可选保留或移除)

  chapter     Chapter  @relation(fields: [chapterId], references: [id])

  // 保持现有的关联
  histories   KnowledgePointHistory[]
  templates   Template[]
  userEnabled UserEnabledKnowledge[]
}
```

### 2.3 数据关系图
```
User (1) ────── (N) UserEnabledKnowledge
                      │
                      ├── nodeId → Chapter.id (nodeType='chapter')
                      └── nodeId → KnowledgePoint.id (nodeType='point')

TextbookVersion (1) ────── (N) Chapter
                              │
                              ├── parent (自关联)
                              └── (1) ── (N) KnowledgePoint
```

## 3. API 设计

### 3.1 用户设置 API

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

### 3.2 知识点树 API

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

### 3.3 题目筛选修改

#### 获取题目（修改）
```
GET /api/questions
  ?grade=7
  &subject=数学
  &textbookId=xxx
  &enabledOnly=true  // 只返回勾选知识点相关的题目

现有参数保持兼容，新增筛选参数。
```

## 4. 智能推荐算法

### 4.1 推荐逻辑

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

### 4.2 进度计算

```typescript
// 默认进度：根据当前日期计算
function calculateDefaultProgress(): number {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 8, 1); // 9月1日开学
  const yearEnd = new Date(now.getFullYear() + 1, 0, 31); // 1月底结束
  const total = yearEnd.getTime() - yearStart.getTime();
  const elapsed = now.getTime() - yearStart.getTime();
  return Math.min(100, Math.max(0, Math.floor((elapsed / total) * 100)));
}
```

## 5. UI/UX 设计

### 5.1 首次引导流程

**入口:** 用户首次登录检测 `selectedGrade` 为空

**步骤:**
1. 欢迎页：说明设置年级和教材的重要性
2. 选择年级（7-12）→ 单选按钮
3. 选择科目 → 单选按钮
4. 选择教材版本 → 根据年级+科目过滤显示
5. 设置学习进度 → 滑块（显示推荐章节预览）
6. 完成引导 → 跳转主页

**跳过:** 允许暂时跳过，使用默认设置（初一数学人教版）

### 5.2 我的-设置页面

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

**交互:**
- 点击年级/科目/教材/进度 → 弹出选择器
- 点击章节 → 展开/收起子节点
- 勾选父节点 → 自动勾选所有子节点
- 取消子节点 → 自动取消父节点勾选
- 搜索框 → 过滤知识点名称

### 5.3 知识点树组件

**组件: KnowledgeTree**

```typescript
interface TreeNode {
  id: string;
  type: 'chapter' | 'point';
  name: string;
  number?: string;
  enabled: boolean;
  children?: TreeNode[];
}

interface KnowledgeTreeProps {
  tree: TreeNode[];
  onToggle: (nodeId: string, enabled: boolean) => void;
  searchQuery?: string;
}
```

**状态:**
- `expandedIds`: 展开的节点ID集合
- `indeterminateIds`: 部分子节点勾选的父节点

## 6. 数据迁移

### 6.1 迁移步骤

**Step 1: 创建新表**
```sql
-- 执行 Prisma migrate
npx prisma migrate dev --name add_knowledge_tree
```

**Step 2: 创建默认教材数据**
```typescript
// scripts/seed-textbooks.ts
const textbooks = [
  { grade: 7, subject: '数学', name: '人教版', year: '2024' },
  { grade: 7, subject: '数学', name: '北师大版', year: '2024' },
  { grade: 8, subject: '数学', name: '人教版', year: '2024' },
  // ...
];
```

**Step 3: 迁移现有知识点**
```typescript
// scripts/migrate-knowledge-points.ts
// 1. 创建"未分类"章节
// 2. 将现有知识点关联到该章节
// 3. 保留原有数据用于回滚
```

**Step 4: 兼容性处理**
- 旧 API 继续可用
- 新 API 支持筛选参数
- 用户未设置时使用默认值

### 6.2 回滚计划

```sql
-- 如需回滚
DROP TABLE UserEnabledKnowledge;
DROP TABLE Chapter;
DROP TABLE TextbookVersion;
-- 恢复 KnowledgePoint 原有字段
```

## 7. 实施计划

### 7.1 阶段划分

**阶段1: 数据层（2-3天）**
- Prisma schema 更新
- 数据库迁移脚本
- 种子数据（教材版本）
- 数据迁移脚本

**阶段2: API 层（3-4天）**
- 用户设置 API
- 教材列表 API
- 知识点树 API
- 智能推荐 API
- 题目筛选修改

**阶段3: UI 组件（3-4天）**
- 首次引导组件
- 设置页面重构
- 知识点树选择组件
- 选择器组件（年级/科目/教材）

**阶段4: 集成测试（2天）**
- 练习页面集成筛选
- 测评页面集成筛选
- 分析页面数据过滤
- 端到端测试

### 7.2 依赖关系

```
阶段1(数据层)
    ↓
阶段2(API层) ← ─ ─ ─ ┐
    ↓                  │
阶段3(UI组件) ─ ─ ─ ─ ─┘
    ↓
阶段4(集成)
```

### 7.3 风险点

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 数据迁移失败 | 高 | 先在测试环境验证，保留回滚脚本 |
| 现有用户数据不兼容 | 中 | 提供默认值，兼容旧API |
| 教材版本数据不完整 | 低 | 先上线主要版本，逐步补充 |

## 8. 测试计划

### 8.1 单元测试
- 智能推荐算法
- 知识点树展开/收起逻辑
- 勾选状态传播逻辑

### 8.2 集成测试
- API 端到端测试
- 数据库迁移脚本
- 用户设置与题目筛选联动

### 8.3 E2E 测试
- 首次引导流程
- 设置页面保存
- 练习页面使用筛选后的题目

## 9. 性能考虑

- 知识点树数据量小（<1000节点），前端全量加载
- 用户勾选状态按需获取
- 题目筛选添加数据库索引

## 10. 未来扩展

- 支持多科目同时选择
- 支持跨年级知识点
- 知识点依赖关系（前置知识点）
- 个性化推荐（基于掌握度）
