# 自适应学习路径系统设计

**日期:** 2026-04-24
**状态:** 草案

---

## 背景

### 当前状态
- **测评系统:** 已实现初始测评，记录各知识点掌握度
- **知识体系:** 教材→章节→知识点三层结构
- **用户勾选:** 用户可手动勾选学习内容
- **智能推荐:** 基于学期进度一键勾选知识点

### 问题
1. **静态路径:** 推荐后路径固定，不随学习表现动态调整
2. **缺乏优先级:** 所有待学知识点平等对待，无重点引导
3. **遗忘无处理:** 已掌握知识点长期不练习，逐渐遗忘但系统不提醒
4. **进度可视化弱:** 用户无法直观看到"我学到哪了"、"接下来学什么"

---

## 目标用户场景

### 场景1: 新用户测评后
```
用户完成初始测评，得分75分
→ 系统分析: 15个知识点薄弱，按权重×掌握度排序
→ 展示推荐路径: "建议先学这5个核心知识点"
→ 用户确认/微调
→ 生成正式学习路径
```

### 场景2: 日常练习后
```
用户练习"勾股定理"，连续正确
→ 系统检测: 该知识点掌握度从0.3→0.7
→ 微调路径: 该知识点优先级下降，下一个薄弱知识点上浮
→ 用户看到: "勾股定理进步很大！接下来建议学习..."
```

### 场景3: 每周回顾
```
周日系统生成周报
→ 展示: 本周练习了8个知识点，其中3个从弱→中
→ 检测: "相似三角形"连续10天未练习，掌握度可能下降
→ 询问: "是否将已掌握但久未练习的知识点加入复习队列？"
→ 路径重新洗牌
```

---

## 核心设计

### 1. 适用范围

| 测评分数 | 处理 |
|---------|------|
| < 60分 | 题目偏难，建议降低难度重新测评 |
| 60-89分 | **生成学习路径** |
| ≥ 90分 | 题目偏易，建议提高难度重新测评 |

### 2. 学习路径数据模型

```prisma
// 学习路径（新增模型）
model LearningPath {
  id                String   @id @default(cuid())
  userId            String
  name              String   // "2024秋季学期学习路径"
  type              String   // 'initial' | 'weekly' | 'manual'
  status            String   @default('active') // active/archived
  knowledgeData     Json     // [{nodeId, priority, status, addedAt, reasons}]
  generatedAt       DateTime @default(now())
  expiresAt         DateTime? // 周路径的过期时间

  user              User     @relation(fields: [userId], references: [id])
  adjustments       PathAdjustment[]
  weeklyReports     WeeklyReport[]

  @@index([userId, status])
}

// 路径调整记录
model PathAdjustment {
  id                String   @id @default(cuid())
  pathId            String
  type              String   // 'micro' | 'weekly'
  trigger           String   // 'practice_completed' | 'weekly_recalibration'
  changes           Json     // {added: [], removed: [], reordered: []}
  createdAt         DateTime @default(now())

  path              LearningPath @relation(fields: [pathId], references: [id], onDelete: Cascade)
}

// 周报
model WeeklyReport {
  id                String   @id @default(cuid())
  pathId            String
  weekStart         DateTime
  weekEnd           DateTime
  summary           Json     // {practicedCount, masteredCount, weakCount}
  staleKnowledge    Json     // [{nodeId, lastPractice, mastery}]
  recommendations   Json     // {toReview: [], toLearn: []}

  path              LearningPath @relation(fields: [pathId], references: [id], onDelete: Cascade)
}
```

**knowledgeData 结构:**
```typescript
{
  nodeId: string,           // 知识点ID
  priority: number,         // 优先级分数（越高越优先）
  status: 'pending' | 'learning' | 'mastered' | 'stale',
  addedAt: DateTime,
  reasons: string[],        // ["权重高", "测评正确率低", "7天未练习"]
}
```

### 3. 优先级计算公式

```typescript
function calculatePriority(kp: KnowledgePoint, user: User): number {
  const mastery = getUserMastery(user.id, kp.id); // 0-1
  const weight = kp.weight || 3; // 1-5
  const daysSincePractice = daysSince(user.id, kp.id);
  const recentFailureRate = getRecentFailureRate(user.id, kp.id, 7); // 7天内

  // 基础优先级 = 权重 × (1 - 掌握度)
  let baseScore = weight * (1 - mastery);

  // 最近失败加成
  const failureBonus = recentFailureRate > 0.5 ? 1.5 : 1.0;

  // 遗忘惩罚（可选，用户控制）
  const stalePenalty = user.includeStale ? 0 : (daysSincePractice > 14 ? 0.5 : 1);

  return baseScore * failureBonus * stalePenalty;
}
```

### 4. 混合调整策略

#### 微调（Micro-adjustment）
- **触发时机:** 每次练习完成
- **调整范围:** 仅调整本次练习知识点及其相关节点
- **逻辑:**
  - 练习正确 → 该知识点优先级下降20%
  - 练习错误 → 该知识点优先级上升30%
  - 相同章节的其他知识点优先级微调±5%

#### 周重组（Weekly Reshuffle）
- **触发时机:** 每周日晚上或用户手动触发
- **调整范围:** 全路径重新计算
- **逻辑:**
  - 重新计算所有知识点优先级
  - 检测"stale"知识点（14天未练习且掌握度>0.7）
  - 生成周报和复习建议

---

## 界面设计

### 1. 学习路径概览页

```
┌─────────────────────────────────────────────┐
│ 学习路径                                     │
├─────────────────────────────────────────────┤
│                                             │
│  📍 当前位置: 第3章 - 相似三角形              │
│  📊 本周进度: 8/12 知识点已练习               │
│  🎯 下一个: 相似三角形的判定                  │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  ●     ●     ●     ○     ○     ○           │
│ 已完成  进行中   待学习                       │
│                                             │
│  [查看详细路径]  [编辑路径]  [周报]          │
└─────────────────────────────────────────────┘
```

### 2. 知识点树集成

```
┌─────────────────────────────────────────────┐
│ 知识点树（学习路径模式）                      │
├─────────────────────────────────────────────┤
│                                             │
│ ▼ 第3章 相似三角形 [进度: 60%]              │
│   ✅ 3.1 相似图形的认识 [掌握: 0.9]          │
│   🔄 3.2 相似三角形的判定 [掌握: 0.5] ←当前   │
│   ⬜ 3.3 相似三角形的应用 [掌握: 0.2]         │
│     💡 优先级: 高 (权重4 + 测评薄弱)         │
│   ⬜ 3.4 位似图形 [掌握: 0]                   │
│                                             │
│ ○ 第4章 锐角三角函数 [进度: 0%]              │
│                                             │
└─────────────────────────────────────────────┘
```

### 3. 周报弹窗

```
┌─────────────────────────────────────────────┐
│ 📅 本周学习报告                              │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ 已掌握: 勾股定理、一元二次方程           │
│  📈 进步明显: 相似三角形 (0.3 → 0.7)         │
│  ⚠️  需关注: 根与系数关系 (连续错误)         │
│                                             │
│  🔄 久未复习:                                │
│     · 有理数运算 (上次: 15天前, 掌握度0.85)  │
│     · 整式乘除 (上次: 20天前, 掌握度0.78)    │
│                                             │
│  是否将以上知识点加入复习队列？               │
│                                             │
│  [加入复习]  [保持现状]  [稍后提醒]          │
└─────────────────────────────────────────────┘
```

---

## API 设计

### 1. 路径生成

**POST /api/learning-path/generate**
```typescript
// 请求
{
  assessmentId: string,  // 关联的测评记录
  userEdits?: {          // 用户可选的编辑
    add: string[],       // 额外添加的知识点
    remove: string[]     // 移除的知识点
  }
}

// 响应
{
  success: true,
  data: {
    pathId: string,
    knowledgeData: Array<{
      nodeId: string
      priority: number
      status: string
      reasons: string[]
    }>
  }
}
```

### 2. 路径查询

**GET /api/learning-path**
```typescript
// 响应
{
  success: true,
  data: {
    path: {
      id: string
      name: string
      status: string
      currentIndex: number  // 当前进行到第几个
    },
    roadmap: Array<{
      nodeId: string
      name: string
      status: 'completed' | 'current' | 'pending'
      mastery: number
      priority: number
    }>,
    weeklySummary: {
      practicedCount: number
      masteredCount: number
      weakCount: number
    }
  }
}
```

### 3. 练习后微调

**POST /api/learning-path/adjust**
```typescript
// 请求（练习完成时自动调用）
{
  attemptId: string,
  practiceResults: Array<{
    knowledgePointId: string
    isCorrect: boolean
  }>
}

// 响应
{
  success: true,
  data: {
    adjustments: Array<{
      nodeId: string
      oldPriority: number
      newPriority: number
      reason: string
    }>,
    nextRecommendation: {
      nodeId: string
      name: string
    }
  }
}
```

### 4. 周报与重组

**GET /api/learning-path/weekly-report**
```typescript
// 响应
{
  success: true,
  data: {
    weekStart: DateTime
    weekEnd: DateTime
    summary: {
      practicedCount: number
      masteredCount: number
      weakCount: number
    }
    staleKnowledge: Array<{
      nodeId: string
      name: string
      lastPractice: DateTime
      mastery: number
    }>
    recommendations: {
      toReview: string[]
      toLearn: string[]
    }
  }
}
```

**POST /api/learning-path/recalibrate**
```typescript
// 请求
{
  includeStale: boolean  // 是否将久未练习的已掌握知识点加入
}

// 响应
{
  success: true,
  data: {
    newPath: {
      knowledgeData: [...]
    }
  }
}
```

---

## 用户设置

**新增用户偏好设置:**

```prisma
model User {
  // ... 现有字段

  // 学习路径偏好
  includeStale      Boolean @default(false)  // 是否包含久未练习的已掌握知识点
  pathUpdateMode    String  @default('auto') // 'auto' | 'manual'
  weeklyReportDay   Int     @default(0)      // 0=周日, 1=周一, ...
}
```

---

## 实施文件

1. **数据模型**
   - `prisma/schema.prisma` - 添加 LearningPath, PathAdjustment, WeeklyReport

2. **后端API**
   - `app/api/learning-path/generate/route.ts` - 路径生成
   - `app/api/learning-path/route.ts` - 路径查询
   - `app/api/learning-path/adjust/route.ts` - 微调
   - `app/api/learning-path/weekly-report/route.ts` - 周报
   - `app/api/learning-path/recalibrate/route.ts` - 重组
   - `lib/learning-path/priority.ts` - 优先级计算
   - `lib/learning-path/adapter.ts` - 微调逻辑

3. **前端组件**
   - `components/LearningPathOverview.tsx` - 路径概览
   - `components/LearningPathRoadmap.tsx` - 路径可视化
   - `components/WeeklyReportDialog.tsx` - 周报弹窗
   - `components/KnowledgeTreeWithPath.tsx` - 知识树+路径集成
   - `app/me/page.tsx` - 整合到"我的"页面

4. **服务**
   - `lib/learning-path/weekly-job.ts` - 周报定时任务

---

## 验收标准

- [ ] 测评分数60-89分时，引导用户生成学习路径
- [ ] 初始路径按优先级正确排序
- [ ] 练习完成后自动微调相关知识点优先级
- [ ] 周报正确检测stale知识点
- [ ] 用户可选择是否将stale知识点加入复习
- [ ] 路径可视化显示当前位置和下一步
- [ ] 知识树显示路径状态标记

---

## 后续优化

1. **智能预测:** 基于历史数据预测"按当前进度X天后可掌握"
2. **社交激励:** "本周你超过了80%的同学"
3. **考前冲刺:** 用户可设置考试日期，系统自动生成冲刺路径
