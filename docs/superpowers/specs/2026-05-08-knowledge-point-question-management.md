# 知识点-题目管理体系重构设计

**日期**: 2026-05-08
**状态**: 已批准
**目标**: 将题目管理嵌入知识点上下文，统一数据层级

---

## 1. 背景

### 当前问题

| 问题 | 说明 |
|------|------|
| 题目生成脱离上下文 | 独立页面 `/admin/question-generation`，无法从知识点触达 |
| 复杂度特征独立管理 | 独立 tab，与题目分离 |
| 知识点无详情 | 只有列表，无法查看关联题目 |

### 数据层级（已正确）

```
教材 → 章节 → 知识点 → 题目 → 题目特征
```

---

## 2. 设计目标

1. **知识点详情行内展开** - 点击知识点行展开详情，不离开列表
2. **关联题目列表** - 知识点详情内显示该知识点生成的题目
3. **题目管理页面** - 管理端题目列表，支持筛选和复杂度编辑
4. **移除冗余** - 删除独立题目生成页面

---

## 3. 导航结构

```
数据管理
├── 教材管理
├── 章节管理
├── 知识点管理          ← 重构
│     └── 行内展开
│           ├── 基本信息
│           ├── 关联题目列表
│           └── 生成按钮
└── 题目管理            ← 新增
      ├── 题目列表
      ├── 复杂度列内编辑
      └── 批量操作
```

---

## 4. 组件设计

### 4.1 KnowledgePointList（重构）

**职责**: 知识点列表 + 行内展开详情

**状态**:
- `expandedKpids: Set<string>` - 当前展开的知识点 ID 集合（支持多行同时展开）
- 点击行切换该行的展开状态

**展开行结构**:
```tsx
{expandedKpids.has(kp.id) && (
  <KnowledgePointDetail
    kp={kp}
    chapterPath={getChapterPath(kp)}  // 面包屑上下文
    onClose={() => setExpandedKpids(prev => {
      const next = new Set(prev);
      next.delete(kp.id);
      return next;
    })}
    onRefresh={refetch}
    onGenerate={handleGenerate}
  />
)}
```

### 4.2 KnowledgePointDetail（新增）

**职责**: 展开区域，显示知识点详情和关联题目

**布局**:
```
┌─────────────────────────────────────────────────┐
│ 教材: 初中数学 → 章节: 二次根式           [X] │
├─────────────────────────────────────────────────┤
│ 知识点: 二次根式的定义                         │
├─────────────────────────────────────────────────┤
│ 描述: 二次根式的概念和基本性质               │
├─────────────────────────────────────────────────┤
│ 关联题目 (12)              [生成题目]        │
├─────────────────────────────────────────────────┤
│ 难度  题目类型   复杂度  操作                │
│ 5     填空题    0.72    [编辑]               │
│ 6     选择题    0.85    [编辑]               │
│ ...                                         │
└─────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface KnowledgePointDetailProps {
  kp: KnowledgePointWithDetails;
  chapterPath: string;  // 面包屑: "教材名 → 章节名"
  onClose: () => void;
  onRefresh: () => void;
  onGenerate: (kpId: string) => Promise<void>;  // 触发题目生成
}
```

**交互约定**:
- 复杂度编辑：单击复杂度值 → 输入框 → Enter 保存 / Esc 取消
- 编辑失败：回滚到原值，显示错误提示
- 空状态：显示"暂无关联题目"占位符

### 4.3 QuestionList（新增）

**职责**: 管理端题目列表

**位置**: `components/admin/QuestionList.tsx`
**访问**: 数据管理 → 题目管理 tab

**功能**:
- 按知识点筛选
- 按难度/复杂度范围筛选
- 按 extractionStatus 筛选
- 复杂度列内编辑
- 批量提取复杂度

**API**: `/api/admin/questions`

### 4.4 DataManagementTab（调整）

**变更**:
- 移除独立 "题目生成" tab（已迁移到知识点内）
- 移除独立 "题目特征" tab（已内嵌到题目管理）
- 新增 "题目管理" tab

```typescript
type DataSubTab = 'textbooks' | 'chapters' | 'points' | 'questions';
```

---

## 5. API 设计

### 5.1 获取知识点关联题目

**GET** `/api/admin/knowledge-points/[id]/questions`

**Response**:
```json
{
  "success": true,
  "data": {
    "knowledgePoint": { ... },
    "questions": [
      {
        "id": "xxx",
        "type": "fill_blank",
        "difficulty": 5,
        "complexity": 0.72,
        "cognitiveLoad": 0.65,
        "reasoningDepth": 0.80,
        "extractionStatus": "SUCCESS"
      }
    ],
    "stats": {
      "total": 12,
      "pending": 0,
      "completed": 12
    }
  }
}
```

### 5.2 触发单个知识点题目生成

**POST** `/api/admin/question-generation/trigger`

已有，保留。

### 5.3 题目列表

**GET** `/api/admin/questions`

**Query 参数**:
- `knowledgePointId` - 按知识点筛选
- `difficultyMin` / `difficultyMax` - 按难度范围
- `complexityMin` / `complexityMax` - 按复杂度范围
- `status` - extractionStatus 筛选
- `page` / `limit` - 分页

**Response**:
```json
{
  "success": true,
  "data": {
    "questions": [...],
    "pagination": { "total": 100, "page": 1, "limit": 20 }
  }
}
```

### 5.4 更新题目复杂度

**PATCH** `/api/admin/questions/[id]/complexity`

**Body**:
```json
{
  "complexity": 0.72,
  "cognitiveLoad": 0.65,
  "reasoningDepth": 0.80,
  "difficulty": 5
}
```

### 5.5 批量提取复杂度

**POST** `/api/admin/complexity/batch-extract`

**Request Body**:
```json
{
  "questionIds": ["id1", "id2", "id3"]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "queued": 3
  }
}
```

**说明**:
- 返回表示任务已入队，具体进度通过轮询 `/api/admin/complexity/status` 获取
- 如 `questionIds` 为空，则处理所有待提取题目

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "NO_PENDING_QUESTIONS",
    "message": "没有待提取的题目"
  }
}
```

---

## 6. 数据库

无需变更。现有模型已支持：

- `Question.knowledgePoints` - JSON 数组存储关联知识点 ID
- `Question.extractionStatus` - 复杂度提取状态
- `Question.complexity/cognitiveLoad/reasoningDepth` - 复杂度特征

---

## 7. 迁移计划

### Phase 1: 核心结构

1. 新增 `KnowledgePointDetail` 组件
2. 重构 `KnowledgePointList` 支持行内展开
3. 新增 `QuestionList` 组件
4. 调整 `DataManagementTab` 导航

### Phase 2: 功能完善

5. 实现 `/api/admin/knowledge-points/[id]/questions`
6. 实现 `/api/admin/questions` 列表 API
7. 实现题目复杂度内嵌编辑
8. 连接知识点详情页"生成题目"按钮 → `POST /api/admin/question-generation/trigger`
9. 实现批量提取进度轮询（QuestionList 刷新状态）

### Phase 3: 清理

10. 从 ConsolePage 菜单移除"题目生成"入口（已迁移到知识点内）
11. 移除 "题目特征" 独立 tab
12. 确认 `/api/admin/question-generation/*` API 保留（知识点详情仍需调用）

---

## 8. 验收标准

| 验收点 | 验证方法 |
|--------|----------|
| 点击知识点行展开详情 | 点击知识点行，下方展开详情区域 |
| 详情显示关联题目 | 展开后能看到该知识点的关联题目列表 |
| 知识点内生成题目 | 点击"生成题目"按钮，任务触发 |
| 题目管理列表 | 数据管理 → 题目管理，显示题目列表 |
| 复杂度内嵌编辑 | 点击复杂度值，直接编辑并保存 |
| 复杂度批量提取 | 点击"批量提取"，进度更新 |

---

## 9. 非目标（暂不实现）

- 题目创建/编辑表单（仅管理已生成的题目）
- 题目删除功能
- 题目批量删除
- 题目导入/导出

---

## 10. 错误响应规范

所有 API 遵循统一错误格式：

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;      // 错误码，如 "UNAUTHORIZED", "NOT_FOUND"
    message: string;   // 用户可读的错误描述
  };
}
```

**常用错误码**:
| 错误码 | HTTP 状态码 | 说明 |
|--------|-------------|------|
| UNAUTHORIZED | 401 | 未登录或 token 失效 |
| FORBIDDEN | 403 | 无权限 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 参数校验失败 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 11. 风险与约束

| 风险 | 级别 | 缓解 |
|------|------|------|
| 行内展开区域过大 | 低 | 限制题目列表显示数量，展开收起 |
| API 变更影响现有功能 | 中 | 保留原有 API，新增端点 |
| 题目关联多知识点 | 低 | 列表显示所有关联知识点 |
| 并发编辑复杂度 | 低 | 使用乐观更新，冲突时提示用户刷新 |
