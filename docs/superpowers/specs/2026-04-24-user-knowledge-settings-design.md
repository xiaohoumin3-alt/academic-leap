# 用户端知识点设置系统设计文档

**日期:** 2026-04-24
**状态:** 设计中
**版本:** v1

---

## 1. 概述

为用户端添加年级/科目/教材选择和知识点勾选功能，使练习和测评能够基于用户的知识点范围进行。

### 核心决策

1. **混合触发方式** - 首次测评后强制引导 + 后续可在 /me 页面更改
2. **智能推荐优先** - 默认基于学习进度推荐，可切换到手动勾选
3. **进度驱动** - 推荐逻辑只与 studyProgress 相关，不依赖测评结果
4. **共用数据源** - 练习和测评使用同一个知识点列表

---

## 2. 数据模型（已存在）

以下表已在 `prisma/schema.prisma` 中定义：

### User 表扩展字段

```prisma
model User {
  // ... 现有字段

  // 年级科目教材设置
  selectedGrade      Int?      // 选择的年级 (7-12)
  selectedSubject    String?   // 选择的科目 (数学)
  selectedTextbookId String?   // 选择的教材版本ID
  studyProgress      Int       @default(0) // 学习进度百分比 0-100

  enabledKnowledge   UserEnabledKnowledge[]
}
```

### UserEnabledKnowledge 表

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

---

## 3. API 设计

### 3.1 用户设置 API

#### GET /api/user/settings

获取用户的学习设置。

**响应:**
```json
{
  "success": true,
  "data": {
    "selectedGrade": 8,
    "selectedSubject": "数学",
    "selectedTextbookId": "xxx",
    "selectedTextbook": {
      "id": "xxx",
      "name": "人教版",
      "year": "2024版"
    },
    "studyProgress": 35
  }
}
```

#### PUT /api/user/settings

更新用户的学习设置。

**请求体:**
```json
{
  "selectedGrade": 8,
  "selectedSubject": "数学",
  "selectedTextbookId": "xxx",
  "studyProgress": 35
}
```

**响应:**
```json
{
  "success": true,
  "data": { /* 更新后的用户设置 */ }
}
```

---

### 3.2 知识点树 API

#### GET /api/user/knowledge-tree

获取用户的知识点树（带勾选状态）。

**查询参数:**
- `expand`: `true` 返回全部章节，`false` 只返回到当前进度（默认 `false`）

**响应:**
```json
{
  "success": true,
  "data": {
    "textbook": {
      "id": "xxx",
      "name": "人教版",
      "grade": 8,
      "subject": "数学"
    },
    "chapters": [
      {
        "id": "chapter1",
        "chapterNumber": 1,
        "chapterName": "有理数",
        "enabled": true,
        "knowledgePoints": [
          {
            "id": "kp1",
            "name": "有理数的加法",
            "conceptId": "concept1",
            "conceptName": "加法运算",
            "enabled": true
          }
        ]
      }
    ],
    "enabledCount": 15,
    "totalCount": 50
  }
}
```

---

### 3.3 知识点勾选 API

#### POST /api/user/knowledge/toggle

勾选或取消知识点/章节。

**请求体:**
```json
{
  "nodeId": "kp1",
  "nodeType": "point",
  "enabled": true
}
```

或批量操作：
```json
{
  "nodeId": "chapter1",
  "nodeType": "chapter",
  "enabled": true,
  "cascade": true  // 是否级联到子节点
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "affectedCount": 5  // 受影响的节点数量
  }
}
```

---

### 3.4 智能推荐 API

#### POST /api/user/knowledge/recommend

基于学习进度智能推荐知识点。

**请求体:**
```json
{
  "overwrite": false  // 是否覆盖现有勾选
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "recommendedChapterId": "chapter3",
    "recommendedChapterName": "一元一次方程",
    "progress": 35,
    "enabledCount": 15
  }
}
```

**推荐逻辑:**
1. 根据 `studyProgress` 计算当前应学到哪个章节
2. 启用该章节及之前的所有章节的知识点
3. 更新 UserEnabledKnowledge 表

---

### 3.5 进度计算 API

#### GET /api/user/progress

获取用户的进度计算结果。

**响应:**
```json
{
  "success": true,
  "data": {
    "currentChapter": {
      "id": "chapter3",
      "chapterNumber": 3,
      "chapterName": "一元一次方程"
    },
    "progress": 35,
    "completedChapters": 2,
    "totalChapters": 10,
    "enabledKnowledgeCount": 15,
    "totalKnowledgeCount": 50
  }
}
```

---

## 4. 组件设计

### 4.1 组件结构

```
components/
├── OnboardingGuide.tsx           # 首次设置引导（测评后弹出）
├── LearningSettings.tsx          # 学习设置卡片（/me 页面内）
│   ├── SettingsSummary.tsx       # 当前设置摘要
│   ├── KnowledgeSelector.tsx     # 知识点选择器
│   │   ├── SmartRecommendTab.tsx # 智能推荐标签
│   │   └── ManualSelectTab.tsx   # 手动勾选标签
│   └── ProgressSlider.tsx        # 进度滑块
└── KnowledgeTreeView.tsx         # 知识点树形组件（可折叠）
```

---

### 4.2 OnboardingGuide 组件

**时机:** 测评完成后首次弹出

**内容:**
1. 选择年级（7-12）
2. 选择科目（目前只有数学）
3. 选择教材版本（从 TextbookVersion 列表选择）
4. 点击"完成"保存设置

**状态管理:** 检查 User.initialAssessmentCompleted 且 User.selectedTextbookId 为空

---

### 4.3 LearningSettings 组件

**位置:** /me 页面中的功能卡片

**功能区域:**
1. **设置摘要** - 显示当前年级/科目/教材/进度
2. **模式切换** - 智能推荐 / 手动勾选 标签页
3. **进度滑块** - 拖动调整 studyProgress
4. **保存按钮** - 保存更改

---

### 4.4 KnowledgeSelector 组件

**智能推荐标签页:**
- 显示当前进度章节
- "应用推荐"按钮
- 预览将启用的知识点数量

**手动勾选标签页:**
- 知识点树形展示
- 默认折叠到当前进度
- "展开全部"按钮
- 复选框勾选章节/知识点

---

### 4.5 KnowledgeTreeView 组件

**功能:**
- 树形展示: 教材 → 章节 → 知识点
- 支持折叠/展开
- 支持全选章节（级联到子知识点）
- 显示概念名称（KnowledgeConcept.name）

**数据结构:**
```typescript
interface KnowledgeTreeNode {
  id: string;
  name: string;
  type: 'chapter' | 'point';
  enabled: boolean;
  conceptName?: string;
  children?: KnowledgeTreeNode[];
}
```

---

## 5. 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        用户端                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 测评完成        │
                    │ (Assessment)    │
                    └────────┬────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ OnboardingGuide          │
              │ (首次引导)                │
              │ 选择: 年级/科目/教材      │
              └────────┬─────────────────┘
                       │ PUT /api/user/settings
                       ▼
              ┌──────────────────────────┐
              │ /me 页面                  │
              │ LearningSettings         │
              └────────┬─────────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │ 智能推荐     │         │ 手动勾选     │
    │ (基于进度)  │         │ (树形选择)  │
    └──────┬──────┘         └──────┬──────┘
           │                       │
           │ POST /api/user/knowledge/recommend
           │                       │ POST /api/user/knowledge/toggle
           │                       │
           └───────────┬───────────┘
                       ▼
              ┌─────────────────┐
              │ UserEnabledKnowledge │
              │ (勾选数据)       │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ GET /api/user/knowledge-tree │
              │ (获取知识点列表) │
              └────────┬────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │ 练习模式     │         │ 测评模式     │
    │ (Practice)  │         │ (Assessment) │
    └─────────────┘         └─────────────┘
```

---

## 6. 实施计划概要

### 阶段1: API 层
- [ ] GET/PUT /api/user/settings
- [ ] GET /api/user/knowledge-tree
- [ ] POST /api/user/knowledge/toggle
- [ ] POST /api/user/knowledge/recommend
- [ ] GET /api/user/progress

### 阶段2: 组件开发
- [ ] OnboardingGuide 组件
- [ ] LearningSettings 组件
- [ ] KnowledgeTreeView 组件
- [ ] /me 页面集成

### 阶段3: 练习/测评集成
- [ ] 练习模式使用知识点列表
- [ ] 测评模式使用知识点列表

### 阶段4: 测试
- [ ] E2E 测试

---

## 7. 验证方案

1. **首次引导**
   - 新用户测评完成后弹出引导
   - 选择年级/科目/教材后保存成功

2. **设置页面**
   - /me 页面显示"学习设置"入口
   - 可更改年级/科目/教材
   - 进度滑块可拖动

3. **知识点选择**
   - 智能推荐：根据进度推荐正确章节
   - 手动勾选：树形展示正常，勾选生效

4. **练习/测评**
   - 练习使用勾选的知识点范围
   - 测评使用勾选的知识点范围
