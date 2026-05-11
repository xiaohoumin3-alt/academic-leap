# 深度思考型题目系统设计文档

**创建日期**: 2026-05-11
**设计者**: Claude
**状态**: 设计阶段
**目标**: 解决题目过于简单、缺乏思考过程的问题

---

## 一、问题定义

### 1.1 核心问题

当前 academic-leap 系统生成的题目存在以下问题：

- **题目过于简单**：96%的题目是简单的"代入公式"类型
- **缺乏思考过程**：题目不要求学生展示推理、建模、分析过程
- **题型单一**：主要是选择题和填空题，缺乏场景化应用题
- **认知层次低**：大部分题目只测试记忆和理解，缺乏应用和分析

**数据支持**：
- 数据库中共1673道题
- 简单题型分布：multiple_choice (530题), fill_blank (519题)
- 深度题型：calculation (96题, 仅7%)
- 96%的题目是简单回忆/代入，只有4%是场景化推理题

### 1.2 用户反馈

用户实际测试反馈：
- "题目还是那么幼稚，等于照搬知识点，没有任何想象空间"
- "题目太简单，只是代入公式，没有思考过程"
- 改造后"没有任何改善"

### 1.3 目标

**设计一个深度思考型题目系统，让题目更有挑战性，需要深度思考**

---

## 二、设计决策

### 2.1 题型选择：场景建模选择题

经过分析，选择**场景建模选择题**作为深度思考题的主要形式：

**为什么选择题？**
- ✅ 可以测试**建模思维**（是否正确理解问题、选择合适的工具）
- ✅ 可以形成**微推理链**（2-3道相关选择题，层层递进）
- ✅ 评分客观，便于自动化

**为什么场景建模？**
- ✅ 最接近中学实际题目（优化问题、增长问题、几何应用）
- ✅ 有明确的建模步骤（理解→建模→求解）
- ✅ 可以设计多样化的情境

### 2.2 技术方案：模板+AI混合

**B方案：模板+AI混合** - 最接近中学实际

- **模板定义**：预定义场景框架（如"优化问题"、"增长问题"）
- **AI生成**：AI负责生成具体数值、情境细节、调整难度
- **优点**：
  - 有结构保证（类似教材章节结构）
  - AI可以生成不同情境但保持题型一致
  - 难度可控
- **缺点**：
  - 需要设计场景框架

### 2.3 覆盖范围：全面覆盖初中数学

**A方案：按教材章节全面覆盖**（8-9年级全册）

- **代数**：有理数、整式、方程、不等式、函数（一次、二次、反比例）
- **几何**：三角形、四边形、圆、相似、锐角三角函数
- **统计概率**：数据分析、概率计算
- **估计**：约30-40个知识点，每个设计2-3个场景模板

### 2.4 架构选择：混合模式

**C方案：混合模式** - 核心模板复用 + 特殊模板独立

- **核心场景模板**（可复用）：
  - 优化问题模板（利润最大化、面积最大化、成本最小化）
  - 增长衰减问题模板（人口增长、细菌分裂、复利增长）
  - 几何度量问题模板（勾股定理应用、相似三角形、测量距离）
- **知识点专属模板**（独立设计）：
  - 二次函数抛物线应用（桥梁、隧道、投篮）
  - 一元二次方程根的分布
  - 其他特殊知识点模板

---

## 三、系统架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    题目生成请求                           │
│  知识点: "二次函数" | 难度: 3 | 题型: 选择题 | mode: "deep"│
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              模板路由器 (TemplateRouter)                │
│  根据知识点选择模板类型：                                 │
│  • 核心场景模板 (优化/增长/几何度量)                     │
│  • 知识点专属模板 (二次函数抛物线/一元二次方程根的分布)     │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ 核心模板引擎  │    │ 专属模板引擎  │
│ CoreTemplate │    │SpecialTemplate│
└──────────────┘    └──────────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
┌─────────────────────────────────────────────────────────┐
│              AI 参数生成器 (AIParamGenerator)           │
│  • 生成具体数值和情境细节                                 │
│  • 调整难度级别                                          │
│  • 创造情境变体                                          │
└─────────────────┬───────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────┐
│           题目组装器 (QuestionAssembler)                │
│  • 生成选择题序列（理解→建模→求解）                      │
│  • 添加干扰选项                                          │
│  • 生成解析和答案                                         │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│              数据库持久化 (Prisma)                      │
│  Question 表 + ReasoningStep 表                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 模板系统设计

#### 3.2.1 三大核心场景模板

**1. 优化问题模板**

```typescript
// lib/question-engine/templates/core/optimization.ts
interface OptimizationTemplate {
  category: "optimization"
  
  // 场景类型
  scenario: "profit" | "cost" | "area" | "volume" | "resource"
  
  // 数学模型类型
  modelType: "quadratic" | "linear" | "derivative"
  
  // 生成参数
  generateParams(difficulty: number): {
    constraint: string      // 约束条件（如"总长40米"）
    objective: string       // 优化目标（如"面积最大"）
    variable: string        // 设定的变量
    coefficients: { a: number, b?: number, c?: number }
  }
  
  // 建模步骤（选择题序列）
  buildSteps(params): [
    {
      step: "understanding"
      question: "这个问题的核心是求什么的最值？"
      options: ["利润", "成本", "面积", "体积", "长度"]
      answer: string
    },
    {
      step: "modeling"
      question: `设${params.variable}为变量，则目标函数是`
      options: string[]  // AI生成4个选项（1个正确+3个干扰）
      answer: string
    },
    {
      step: "solving"
      question: "求最值的方法是"
      options: ["导数法", "配方法", "顶点公式", "基本不等式", "试数法"]
      answer: string
    }
  ]
}
```

**示例题目**（难度3）：
```
【场景】某农场要围一个矩形菜地，一边靠墙（墙长20米），另三边用总长40米的篱笆围成。

Q1. 设矩形与墙平行的一边长为x米，则垂直于墙的边长为：
A) (40-x)米
B) (40-2x)米  ✓
C) (20-x)米
D) (40/2 - x)米

Q2. 菜地面积S关于x的函数是：
A) S = x(40-x)
B) S = x(40-2x)  ✓
C) S = x(20-x)
D) S = 2x(20-x)

Q3. 要使面积最大，x应取：
A) 10米
B) 13.33米  ✓
C) 20米
D) 40米
```

**2. 增长衰减问题模板**

```typescript
interface GrowthDecayTemplate {
  category: "growth_decay"
  
  scenario: "population" | "bacteria" | "compound_interest" | "depreciation" | "radioactive"
  
  generateParams(difficulty: number): {
    initial: number         // 初始值
    rate: number            // 增长/衰减率
    timeUnit: string        // 时间单位（年/月/天）
    targetTime: number      // 目标时间点
  }
  
  buildSteps(params): [
    {
      step: "model_selection"
      question: "这个问题应该使用什么函数模型？"
      options: ["一次函数", "二次函数", "指数函数", "反比例函数"]
      answer: string
    },
    {
      step: "parameter_identification"
      question: `初始值和增长率分别是`
      options: string[]
      answer: string
    },
    {
      step: "prediction"
      question: `${params.targetTime}${params.timeUnit}后的值是`
      options: string[]
      answer: string
    }
  ]
}
```

**3. 几何度量问题模板**

```typescript
interface GeometryMeasurementTemplate {
  category: "geometry_measurement"
  
  scenario: "pythagorean" | "similar_triangles" | "trigonometry" | "circle"
  
  generateParams(difficulty: number): {
    realObject: string       // 真实物体（"梯子靠墙""测量河宽"）
    knownLengths: number[]   // 已知长度
    target: string           // 目标量（"梯子底端到墙的距离"）
  }
  
  buildSteps(params): [
    {
      step: "abstraction"
      question: "这个问题可以抽象成什么几何模型？"
      options: ["勾股定理", "相似三角形", "锐角三角函数", "圆的切线性质"]
      answer: string
    },
    {
      step: "setup"
      question: "设所求长度为x，则方程是"
      options: string[]
      answer: string
    },
    {
      step: "calculation"
      question: "x的值是"
      options: string[]
      answer: string
    }
  ]
}
```

#### 3.2.2 知识点专属模板

**二次函数专属模板**

```typescript
// lib/question-engine/templates/special/quadratic-function.ts
interface QuadraticFunctionTemplate {
  knowledgePoint: "quadratic_function"
  
  // 子类型
  subType: "vertex_application" | "intersection" | "inequality" | "word_problem"
  
  generateParams(difficulty: number, subType: string) {
    switch (subType) {
      case "vertex_application":
        return this.generateVertexParams(difficulty)
      case "intersection":
        return this.generateIntersectionParams(difficulty)
    }
  }
  
  // 抛物线应用（桥梁、隧道、投篮）
  private generateVertexParams(difficulty: number) {
    return {
      scenario: ["桥梁", "隧道", "喷泉", "投篮轨迹"][difficulty % 4],
      vertex: { h: this.randomInt(-5, 5), k: this.randomInt(0, 10) },
      direction: Math.random() > 0.5 ? "up" : "down",
      constraint: `高度不低于${this.randomInt(2, 5)}米`
    }
  }
}
```

---

## 四、依赖分析与集成

### 4.1 依赖关系图

```
┌─────────────────────────────────────────────────────────┐
│                    用户界面层                            │
│  app/practice/training/page.tsx                         │
│  - 显示题目                                              │
│  - 用户答题                                              │
│  - 显示答案解析                                          │
└─────────────────┬───────────────────────────────────────┘
                  │ 调用推荐API
                  ▼
┌─────────────────────────────────────────────────────────┐
│              推荐系统 (uok/recommend)                    │
│  app/api/uok/recommend/route.ts                         │
│  - 当前逻辑：从数据库随机/按复杂度推荐                   │
│  - 需要改造：增加深度思考题权重                          │
└─────────────────┬───────────────────────────────────────┘
                  │ 从数据库读取
                  ▼
┌─────────────────────────────────────────────────────────┐
│                  数据库层                                │
│  Question表                                              │
│  - 当前：1673题（96%简单题，4%场景题）                   │
│  - 改造后：新增深度思考题标记                            │
└─────────────────▲───────────────────────────────────────┘
                  │ 写入
                  │
┌─────────────────┴───────────────────────────────────────┐
│              题目生成 (questions/generate)               │
│  app/api/questions/generate/route.ts                    │
│  - 当前：简单模板 + AI直接生成                           │
│  - 改造后：场景建模模板                                  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 影响范围分析

| 改造点 | 影响范围 | 风险 |
|--------|---------|------|
| **新增模板系统** | `lib/question-engine/templates/` | ✅ 新增目录，不影响现有代码 |
| **改造生成API** | `app/api/questions/generate/route.ts` | ⚠️ 需要保持向后兼容 |
| **改造推荐API** | `app/api/uok/recommend/route.ts` | ⚠️ 核心改动，需充分测试 |
| **数据库schema** | `prisma/schema.prisma` | ⚠️ 需要migration |
| **UI显示逻辑** | `app/practice/training/page.tsx` | ⚠️ 需要显示深度标识 |

### 4.3 向后兼容策略

**问题**：现有1673道题都是简单题，不能废弃

**方案**：**渐进式迁移**

```typescript
// 数据库schema：新增字段，保持默认值兼容
model Question {
  // 现有字段保持不变
  id          Int @id
  type        String
  content     Json
  
  // 新增字段（默认值保证兼容）
  isDeepThinking Boolean @default(false)  // 默认false
  deepType     String?                    // 'optimization' | 'growth' | 'geometry' | null
  cognitiveLevel Json?                   // { understanding, modeling, solving }
  
  @@index([isDeepThinking, type])
}

// 批量标记现有题目
// 运行一次，标记所有非calculation类型为简单题
await prisma.question.updateMany({
  where: {
    type: { in: ['multiple_choice', 'fill_blank'] }
  },
  data: {
    isDeepThinking: false
  }
})
```

### 4.4 API兼容性

**改造后的生成API**支持两种模式：

```typescript
// POST /api/questions/generate
{
  "knowledgePoint": "二次函数",
  "difficulty": 3,
  "count": 5,
  "mode": "deep"  // 新增：模式选择
}

// mode参数：
// - "deep"（默认）：优先生成深度思考题（场景建模）
// - "simple"：生成简单题（公式代入）
// - "mixed"：混合模式（3道深度 + 2道简单）
```

---

## 五、UI设计方案

### 5.1 题目卡片组件改造

**当前UI**（简单题目）：
```
┌─────────────────────────────────┐
│  已知二次函数 y = x² - 4x + 3  │
│                                  │
│  求顶点坐标：____               │
│                                  │
│  [提交答案]                     │
└─────────────────────────────────┘
```

**新UI**（深度思考题 - 场景建模）：
```
┌─────────────────────────────────────────────┐
│  🧠 深度思考题 - 优化问题                   │
│  难度：★★★☆☆ | 认知层次：建模推理       │
│                                             │
│  【场景】                                 │
│  某农场要围一个矩形菜地，一边靠墙（墙长   │
│  20米），另三边用总长40米的篱笆围成。      │
│                                             │
│  Q1. 设矩形与墙平行的一边长为x米，则垂直  │
│      于墙的边长为：                        │
│  ⚪ A) (40-x)米                            │
│  ⚪ B) (40-2x)米  ← 选择                  │
│  ⚪ C) (20-x)米                            │
│  ⚪ D) (40/2 - x)米                        │
│                                             │
│  💡 思考提示：先理解题意，再设变量        │
│                                             │
│  [提交答案]  [跳过此题]                   │
└─────────────────────────────────────────────┘
```

### 5.2 前端组件设计

```typescript
// components/practice/QuestionCard.tsx
interface QuestionCardProps {
  question: Question
  
  // 新增：深度思考题标识
  isDeepThinking?: boolean
  
  // 新增：场景信息
  scenario?: {
    type: "optimization" | "growth" | "geometry"
    description: string
    icon: React.ComponentType
  }
  
  // 新增：认知层次标签
  cognitiveLevel?: {
    understanding: number    // 理解：1-5
    modeling: number         // 建模：1-5
    solving: number          // 求解：1-5
  }
}

// 显示深度标识
{isDeepThinking && (
  <div className="flex items-center gap-2 mb-4 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">
    <Brain className="w-4 h-4 text-purple-400" />
    <span className="text-xs font-bold text-purple-400">深度思考题</span>
  </div>
)}

// 显示认知层次（进度条形式）
{cognitiveLevel && (
  <div className="space-y-2 mb-4">
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-16">理解</span>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full" 
          style={{ width: `${cognitiveLevel.understanding * 20}%` }}
        />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-16">建模</span>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div 
          className="bg-purple-500 h-2 rounded-full" 
          style={{ width: `${cognitiveLevel.modeling * 20}%` }}
        />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-16">求解</span>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div 
          className="bg-green-500 h-2 rounded-full" 
          style={{ width: `${cognitiveLevel.solving * 20}%` }}
        />
      </div>
    </div>
  </div>
)}
```

### 5.3 答案解析UI改造

**深度思考题的答案解析**需要展示推理链：

```
┌─────────────────────────────────────────────┐
│  ✅ 回答正确！                             │
│                                             │
│  【解题思路】                               │
│  第一步：理解题意 ✓                         │
│  • 目标：求矩形面积的最大值                 │
│  • 约束：三边篱笆总长40米                   │
│                                             │
│  第二步：建立模型 ✓                         │
│  • 设平行于墙的边为x米                      │
│  • 则垂直边为 (40-2x) 米                    │
│  • 面积函数：S = x(40-2x) = -2x² + 40x    │
│                                             │
│  第三步：求解优化 ✓                         │
│  • 方法：二次函数顶点公式                   │
│  • 顶点x = -b/(2a) = -40/(2×(-2)) = 10     │
│  • 最大面积S = 10×(40-20) = 200平方米      │
│                                             │
│  【易错点提醒】                             │
│  ❌ 常见错误：忘记墙的作用，设两边都是x    │
│  ❌ 常见错误：把面积函数写成S = x(40-x)    │
│                                             │
│  [继续练习]  [查看知识点详解]              │
└─────────────────────────────────────────────┘
```

---

## 六、数据模型设计

### 6.1 扩展数据库Schema

```prisma
// prisma/schema.prisma

model Question {
  id                Int      @id @default(autoincrement())
  type              String   // 'calculation' | 'multiple_choice' | 'fill_blank'
  difficulty        Int
  content           Json
  answer            String
  hint              String?
  knowledgePoints   String   // JSON array
  isAI             Boolean  @default(false)
  templateId        String?
  params            String?  // JSON
  stepTypes         String?  // JSON array
  
  // 新增：深度思考题相关字段
  isDeepThinking    Boolean  @default(false)
  deepType          String?  // 'optimization' | 'growth' | 'geometry' | 'special'
  cognitiveLevel    Json?    // { understanding: 1-5, modeling: 1-5, solving: 1-5 }
  reasoningSteps    Json?    // 推理步骤数组
  
  // 复杂度特征（已有，需要确保被正确提取）
  complexity        Float?
  cognitiveLoad     Float?
  reasoningDepth    Float?
  extractionStatus  String   @default("PENDING")
  featuresExtractedAt DateTime?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  steps             QuestionStep[]
  questionAttempts  QuestionAttempt[]
  
  @@index([isDeepThinking, type])
  @@index([knowledgePoints])
  @@index([extractionStatus])
}

// 新增：推理步骤表（可选，用于存储详细的推理链）
model ReasoningStep {
  id          Int      @id @default(autoincrement())
  questionId  Int
  stepNumber  Int      // 1, 2, 3...
  stepType    String   // 'understanding' | 'modeling' | 'solving'
  question    String   // 这一步的问题
  options     Json     // 选项数组
  answer      String   // 正确答案
  explanation String?  // 这一步的解析
  hint        String?  // 这一步的提示
  
  question    Question @relation(fields: [questionId], references: [id])
  
  @@index([questionId, stepNumber])
}
```

### 6.2 模板配置Schema

```typescript
// lib/question-engine/templates/schema.ts

interface TemplateConfig {
  id: string                    // 模板ID，如 "optimization_profit"
  category: "core" | "special"  // 核心模板 vs 专属模板
  knowledgePoints: string[]      // 适用的知识点
  difficultyRange: [number, number]  // 难度范围
  
  // 参数生成器
  generateParams(difficulty: number): TemplateParams
  
  // 题目构建器
  buildQuestion(params: TemplateParams, difficulty: number): {
    content: {
      scenario: string          // 场景描述
      questions: QuestionStep[]  // 问题序列
    }
    cognitiveLevel: {
      understanding: number
      modeling: number
      solving: number
    }
    reasoningDepth: number
  }
}

interface TemplateParams {
  // 场景参数
  scenario: {
    type: string
    description: string
    constraints: string[]
  }
  
  // 数学参数
  math: {
    variables: Record<string, number>
    target: string
    conditions: string[]
  }
  
  // 难度调整
  difficulty: {
    numbers: "simple" | "complex"  // 数值复杂度
    steps: number                   // 推理步骤数
    distractions: number            // 干扰项数量
  }
}
```

---

## 七、推荐算法改造

### 7.1 问题

当前推荐算法不区分题目深度，导致推荐的多是简单题。

### 7.2 解决方案

在推荐API中添加复杂度权重：

```typescript
// app/api/uok/recommend/route.ts
async function getRecommendations(userId: string, knowledgePoint: string) {
  // 原有逻辑：获取所有题目
  const allQuestions = await prisma.question.findMany({
    where: {
      knowledgePoints: { contains: knowledgePoint },
      extractionStatus: 'SUCCESS'
    }
  })
  
  // 新增：按题目类型和复杂度加权
  const scoredQuestions = allQuestions.map(q => {
    let score = 0
    
    // 优先推荐calculation类型（模板生成的场景题）
    if (q.type === 'calculation') {
      score += 50
    } else if (q.type === 'multiple_choice') {
      score += 30
    } else {
      score += 10  // fill_blank权重最低
    }
    
    // 复杂度加成（从features表读取）
    if (q.complexity) {
      score += q.complexity * 10
    }
    
    if (q.reasoningDepth) {
      score += q.reasoningDepth * 15  // 推理深度权重更高
    }
    
    // 认知负荷加成（避免太简单）
    if (q.cognitiveLoad && q.cognitiveLoad > 0.3) {
      score += q.cognitiveLoad * 10
    }
    
    return { question: q, score }
  })
  
  // 按分数排序，取前10题
  const recommended = scoredQuestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.question)
  
  return recommended
}
```

### 7.3 渐进式推荐策略

```typescript
// 推荐API改造：分阶段上线
async function getRecommendations(userId: string, knowledgePoint: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }})
  
  // 阶段1：检查用户偏好（新增字段）
  const preferDeep = user.preferences?.preferDeepThinking ?? false
  
  // 阶段2：根据偏好调整推荐策略
  let deepRatio = 0.3  // 默认30%深度题
  
  if (preferDeep) {
    deepRatio = 0.7    // 用户偏好深度：70%
  }
  
  // 阶段3：混合推荐
  const deepQuestions = await prisma.question.findMany({
    where: {
      knowledgePoints: { contains: knowledgePoint },
      isDeepThinking: true
    },
    take: Math.ceil(10 * deepRatio)
  })
  
  const simpleQuestions = await prisma.question.findMany({
    where: {
      knowledgePoints: { contains: knowledgePoint },
      isDeepThinking: false
    },
    take: 10 - deepQuestions.length
  })
  
  return [...deepQuestions, ...simpleQuestions]
    .sort(() => Math.random() - 0.5)  // 打乱顺序
}
```

---

## 八、实施计划

### 8.1 分阶段实施

**Phase 1：核心基础设施（1-2周）**
- 创建模板系统架构
- 实现三大核心模板（优化、增长、几何度量）
- 数据库schema扩展
- 基础测试

**Phase 2：专属模板开发（2-3周）**
- 二次函数专属模板（3-4个子类型）
- 一元二次方程专属模板
- 其他高频知识点模板
- 共计15-20个知识点

**Phase 3：系统集成（1周）**
- 改造推荐API
- 改造生成API
- UI组件开发
- 端到端测试

**Phase 4：优化与迭代（1周）**
- 根据测试反馈调整
- 补充剩余知识点模板
- 性能优化
- 文档完善

**总周期：5-7周**

### 8.2 关键里程碑

| 里程碑 | 交付物 | 验收标准 |
|--------|--------|---------|
| M1: 核心模板完成 | 三大核心模板实现 | 能生成优化/增长/几何三类深度题 |
| M2: 数据库扩展完成 | 新增字段+migration | 现有题目正确标记 isDeepThinking |
| M3: 推荐API改造完成 | 加权推荐算法 | 深度题占比≥30% |
| M4: UI组件完成 | 深度标识+推理链展示 | 用户可见🧠标识和推理过程 |
| M5: 首批专属模板完成 | 15-20个知识点模板 | 覆盖8-9年级核心知识点 |

---

## 九、验证与测试

### 9.1 验证标准

**系统层面**：
- [ ] 推荐API返回的题目中，深度题占比 ≥ 30%
- [ ] 深度题的 `isDeepThinking=true`
- [ ] 深度题的 `reasoningDepth > 0.3`

**内容层面**：
- [ ] 深度题包含"理解→建模→求解"三步
- [ ] 每步都有对应的选项
- [ ] 答案解析展示完整推理链

**UI层面**：
- [ ] 深度题显示🧠标识
- [ ] 显示认知层次进度条
- [ ] 答案解析展示推理链

### 9.2 测试计划

```bash
# 1. 生成深度题
curl -X POST http://localhost:3000/api/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "difficulty": 3,
    "count": 5,
    "mode": "deep"
  }'

# 验证：返回的题目中，isDeepThinking = true，type = "calculation"

# 2. 测试推荐API
curl -X POST http://localhost:3000/api/uok/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePoint": "二次函数",
    "count": 10
  }'

# 验证：返回的题目中，至少3道 isDeepThinking = true

# 3. UI验证
# 访问 http://localhost:3000/practice/training
# 验证：深度题显示🧠标识和认知层次进度条
```

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **AI生成质量不稳定** | 深度题质量参差不齐 | 1. 模板约束AI生成范围<br>2. 人工审核首批题目<br>3. 用户反馈机制 |
| **题目太难导致挫败感** | 学生放弃学习 | 1. 难度渐进设计<br>2. 提供"跳过"功能<br>3. 混合推荐（深度+简单） |
| **模板开发周期长** | 无法快速覆盖所有知识点 | 1. 优先高频知识点<br>2. 复用核心模板<br>3. 分批次上线 |
| **向后兼容性问题** | 现有功能受影响 | 1. 新增字段默认兼容<br>2. API保持向后兼容<br>3. 灰度发布 |
| **性能问题** | AI生成耗时 | 1. 批量预生成<br>2. 缓存机制<br>3. 异步生成 |

---

## 十一、成功指标

### 11.1 定量指标

- 深度题在推荐中的占比 ≥ 30%
- 深度题的 `reasoningDepth` 平均值 > 0.4
- 用户答题正确率：60-80%（太难或太简单都不好）
- 首批上线：15-20个知识点模板

### 11.2 定性指标

- 用户反馈："题目更有挑战性"、"需要思考才能做对"
- 题目不再是简单的"代入公式"
- 答案解析能帮助理解推理过程
- UI能清晰标识深度题和推理步骤

---

## 十二、参考调研

### 12.1 kidding-study（本地项目）

**特点**：
- 用MiniMax API生成学习卡片
- 支持3种题型：填空题、选择题、简答题
- 从PDF/PPT/网页解析内容，自动生成题目
- **特点**：基于内容提取知识点，但仍是"记忆型"题目

**可借鉴**：
- 流式生成进度展示
- 多输入源支持（PDF/PPT/网页/粘贴）
- 章节分析和分块生成

### 12.2 DeepTutor（HKUDS开源）

**特点**：
- **Quiz Generation模式**：基于知识库生成带验证的评估题
- **Book Engine**：将材料转化为"活教材"，包含13种块类型
- **Question Bank**：重访和收藏所有生成的问题
- **Skills系统**：自定义教学人设

**可借鉴**：
- 多模态题目生成（quiz + flash cards + interactive demos）
- 知识库驱动的题目生成
- 问题银行和收藏系统
- Agent-native架构

---

## 附录：知识点清单

### 初中数学核心知识点（30-40个）

**代数部分**：
1. 有理数 - 运算、绝对值、科学记数法
2. 整式加减 - 合并同类项
3. 整式乘除 - 幂的运算、乘法公式
4. 因式分解 - 提公因式、公式法
5. 分式 - 基本性质、运算、分式方程
6. 一元一次方程 - 解法、应用题
7. 二元一次方程组 - 代入消元、加减消元
8. 一元一次不等式 - 解法、应用题
9. 一元二次方程 - 解法（公式、因式分解）、根的分布、应用题
10. 平面直角坐标系 - 点坐标、距离公式
11. 函数基础 - 概念、表示法
12. 一次函数 - 性质、图像、应用
13. 反比例函数 - 性质、图像、应用
14. 二次函数 - 性质、图像、顶点、应用
15. 锐角三角函数 - 正弦、余弦、正切

**几何部分**：
16. 线段、角 - 相交线、平行线
17. 三角形 - 边角关系、全等
18. 多边形与平行四边形 - 平行四边形、矩形、菱形、正方形
19. 三角形全等 - SSS、SAS、ASA、AAS、HL
20. 轴对称 - 性质、应用
21. 勾股定理 - 逆定理、应用
22. 四边形 - 特殊平行四边形
23. 圆 - 基本性质、切线、弧长、扇形面积
24. 相似三角形 - 判定、性质、应用
25. 解直角三角形 - 坡度、仰角俯角

**统计概率部分**：
26. 数据的收集与整理 - 普查、抽样
27. 统计图 - 条形图、折线图、扇形图
28. 平均数、中位数、众数
29. 方差 - 意义、计算
30. 概率初步 - 等可能、树状图
31. 概率计算 - 列举法、频率估计

---

**文档结束**
