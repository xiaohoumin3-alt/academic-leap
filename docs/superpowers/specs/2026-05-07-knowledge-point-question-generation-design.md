# 知识点派生题目机制设计

**日期**: 2026-05-07
**目标**: 建立知识点→题目的自动派生机制，解决"知识点存在但没有题目"的根本问题
**状态**: 设计中

---

## 一、问题背景

### 1.1 现状问题

1. **数据异常**：106 个知识点中，104 个没有关联题目
2. **机制缺失**：创建知识点时不会自动生成题目，缺少流程保障
3. **脏数据**：存在重复知识点、ID 格式不一致、题目无对应知识点

### 1.2 根因分析

| 现象 | 根因 |
|------|------|
| 知识点没有题目 | 缺少派生机制，没有流程保障 |
| 题目没有对应知识点 | 数据异常/流程 bug |
| 测评题目不足（2-3题） | 筛选逻辑遇到无题知识点 |

**核心问题**：系统没有建立"知识点→题目"的派生机制。

---

## 二、核心需求

### 2.1 功能需求

1. **派生机制**：创建知识点时，标记"待生成"，管理员可批量触发
2. **触发方式**：半自动（B类方案）
3. **题目数量**：**前端可选**，每个难度等级可配置生成数量
   - 默认配置：10 题/等级
   - 快速验证模式：1 题/等级（用于测试）
   - 完整模式：10 题/等级（生产环境）
4. **调度策略**：
   - 核心难度（4-9级）先生成
   - 边缘难度（1-3级，10-12级）后生成
   - 间隔 3 分钟（可配置）
   - 按知识点组织批次

### 2.2 数据需求

**知识点表新增字段（B类方案 + 可选字段）**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| description | String | ❌ | 知识点描述（创建时手动输入，V1 可为空） |
| examples | Json | ❌ | 示例数组（V1 可为空，V2 可 AI 辅助生成） |
| difficultyLevel | Int | ❌ | 默认难度等级（1-12） |
| relatedTopics | Json | ❌ | 关联知识点ID数组（前置知识点） |
| teachingNotes | String | ❌ | 教学要点（可选） |
| commonMistakes | String | ❌ | 易错点（可选） |

**字段填充说明**：
- V1 阶段：所有字段均可为空，AI 仅根据 `name` 生成题目
- V2 阶段：提供 UI 让管理员补充 `description` 和 `examples`
- V3 阶段：AI 自动根据知识点名称生成 `description` 和 `examples`

**生成状态字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| generationStatus | String | pending | in_progress | completed | failed |
| generationProgress | Json | { "4": 10, "5": 8, ... } 各难度已生成题数 |
| generationTarget | Int | 每等级目标题数（默认 10） |
| lastGeneratedAt | DateTime | 最后生成时间（默认 now()） |
| generationError | String? | 失败原因 |
| coreGenerationJobId | String? | pg-boss 任务 ID（core 难度 4-9） |
| edgeGenerationJobId | String? | pg-boss 任务 ID（edge 难度 1-3, 10-12） |

### 2.3 脏数据修复

1. **重复知识点**：合并或禁用重复项
2. **孤儿题目**：题目引用的知识点不存在，创建对应知识点或清理题目
3. **ID 格式不一致**：初始化脚本使用固定 ID，题目使用 cuid

---

## 三、架构设计

### 3.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      管理员触发                              │
│              POST /api/admin/generate-questions              │
│              (认证: @admin 中间件)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   QuestionGenerationService                  │
│  1. 检查去重：knowledgePoint 是否已有 in_progress 任务      │
│  2. 为每个知识点创建 pg-boss 任务                           │
│  3. 标记 generationStatus = "in_progress"                   │
│  4. 保存 generationJobId（用于去重检查）                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      pg-boss 作业队列                        │
│  - 每个知识点创建两个独立任务：                              │
│    • core-job: 难度 4-9 级（优先级: high）                 │
│    • edge-job: 难度 1-3, 10-12 级（优先级: low）           │
│  - 任务独立执行，互不干扰                                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  generateQuestionsWorker                    │
│  1. 加载知识点（含新增字段）                                │
│  2. 调用 AI 生成器                                         │
│  3. 保存到 Question 表                                      │
│  4. 更新 generationProgress                                │
│  5. 检查是否完成，未完成则 intervalSeconds 后重试           │
│  6. 超过 3 次重试则标记 failed，保留已生成的题目             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 调度策略

**任务模型**：每个知识点创建 **两个独立任务**（非重试关系）

| 任务 | 难度范围 | 题数（默认） | 优先级 |
|------|----------|-------------|--------|
| core-job | 4-9 级 | 60 题（6等级 × 10题） | high |
| edge-job | 1-3, 10-12 级 | 60 题（6等级 × 10题） | low |

**重要澄清**：
- core-job 和 edge-job 是 **两个独立任务**，可以并行执行
- 单个任务内部通过重试完成全部难度等级
- 一个任务完成后，另一个任务不受影响

**调度规则**：
- 任务入队前检查去重：对应的 `coreGenerationJobId` 或 `edgeGenerationJobId` 已存在且未过期则跳过
- 每批完成后间隔 `intervalSeconds` 秒（默认 180）
- 按知识点顺序处理
- 单任务失败重试最多 3 次，超过则标记 `failed`
- **每等级题目数量由前端参数 `questionsPerLevel` 控制**（默认 10）

**去重机制**：
```typescript
// 调度前检查（以 core 任务为例）
const jobIdField = mode === 'core' ? 'coreGenerationJobId' : 'edgeGenerationJobId'

if (kp[jobIdField]) {
  const existingJob = await pgBoss.getJobById(kp[jobIdField])
  if (existingJob && existingJob.state !== 'expired' && existingJob.state !== 'completed') {
    return { skipped: true, reason: 'Already in progress' }
  }
}

// 创建任务时保存 jobId
const newJob = await pgBoss.create('question-generation-' + mode, jobData)
await prisma.knowledgePoint.update({
  where: { id: knowledgePointId },
  data: {
    [jobIdField]: newJob.id,
    generationStatus: 'in_progress',
  }
})
```

### 3.3 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 作业队列 | pg-boss | PostgreSQL 原生，无需额外依赖 |
| AI 生成 | 现有 lib/ai/generation | 复用现有模块 |
| 进度追踪 | generationProgress 字段 | 实时追踪各难度完成情况 |

---

## 四、数据流设计

### 4.1 生成流程

```
[管理员] → POST /api/admin/question-generation
           body: {
             mode: "core" | "edge" | "all",
             knowledgePointIds?: ["kp1", "kp2"],
             questionsPerLevel: 10,  // 可选，默认 10
             intervalSeconds: 180     // 可选，默认 180（3分钟）
           }

           ↓

[QuestionGenerationService]
           → 查询 inAssess=true 且 generationStatus != completed 的知识点
           → 为每个知识点创建 pg-boss 任务
           → 标记 generationStatus = "in_progress"

           ↓

[pg-boss]
           → 任务入队（按优先级排序）
           → Worker 轮询执行

           ↓

[generateQuestionsWorker]
           → 加载知识点详情（含新增字段）
           → 调用 AI 生成（questionsPerLevel × 难度等级数）
           → 保存到 Question 表
           → 更新 generationProgress
           → 如果未完成，intervalSeconds 后重新入队

           ↓

[完成]
           → 所有难度等级都达到 questionsPerLevel 时
           → 标记 generationStatus = "completed"
```

### 4.2 状态转换

```
pending → in_progress → completed
                     ↘ failed
```

### 4.3 边界处理

**场景 1：知识点不存在**

```typescript
// Worker 加载知识点时
const kp = await prisma.knowledgePoint.findUnique({
  where: { id: knowledgePointId }
})

if (!kp) {
  await markFailed(knowledgePointId, 'Knowledge point not found')
  return  // 不重试
}
```

**场景 2：第 4 次失败**

```typescript
// 超过重试次数
if (retryCount >= 3) {
  await prisma.knowledgePoint.update({
    where: { id: knowledgePointId },
    data: {
      generationStatus: 'failed',
      generationError: `Max retries exceeded. Last error: ${error.message}`,
      // 已生成的题目保留，不删除
    }
  })
  return
}
```

**场景 3：pg-boss 宕机恢复**

```typescript
// pg-boss 启动时自动恢复未完成的任务
pgBoss.on('ready', async () => {
  const stuckJobs = await prisma.knowledgePoint.findMany({
    where: {
      generationStatus: 'in_progress',
      lastGeneratedAt: {
        lt: new Date(Date.now() - 30 * 60 * 1000)  // 30分钟前
      }
    }
  })

  for (const kp of stuckJobs) {
    // 重新入队
    await pgBoss.send('question-generation-recovery', {
      knowledgePointId: kp.id,
      mode: 'recovery'
    })
  }
})
```

**场景 4：部分难度失败**

```typescript
// 已成功的难度保留，失败的难度记录错误
for (let level = min; level <= max; level++) {
  try {
    const questions = await generateAndSaveCards(...)
    await updateProgress(kp.id, level, questions.length)
  } catch (error) {
    // 记录错误，但继续处理其他难度
    await logGenerationError(kp.id, level, error)
  }
}
```

**场景 5：AI 返回题目数量不足**

```typescript
// AI 可能返回少于预期的题目
const questions = await generateAndSaveCards({
  count: questionsPerLevel - currentCount,  // 请求 10 题
  // 但 AI 可能只返回 8 题
})

// 更新实际数量
await updateProgress(kp.id, level, questions.length)

// 下次重试时会补足差额
if (currentCount + questions.length < questionsPerLevel) {
  // 重新入队继续
}
```

**场景 6：并发竞态（同一知识点被重复调度）**

```typescript
// 使用数据库行锁保证原子性
await prisma.$transaction(async (tx) => {
  const kp = await tx.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { generationStatus: true, generationJobId: true }
  })

  // 检查是否已在进行中
  if (kp.generationStatus === 'in_progress') {
    const existingJob = await pgBoss.getJobById(kp.generationJobId)
    if (existingJob && existingJob.state !== 'expired') {
      throw new Error('Already in progress')
    }
  }

  // 标记为进行中
  await tx.knowledgePoint.update({
    where: { id: knowledgePointId },
    data: {
      generationStatus: 'in_progress',
      generationJobId: newJobId
    }
  })
})
```

---

## 五、核心组件设计

### 5.1 QuestionGenerationService（调度层）

```typescript
// lib/question-generation/service.ts

export interface GenerationOptions {
  mode: 'core' | 'edge' | 'all'
  knowledgePointIds?: string[]     // 空 = 全部
  questionsPerLevel?: number        // 每等级题目数，默认 10
  intervalSeconds?: number          // 重试间隔，默认 180（3分钟）
}

export class QuestionGenerationService {
  /**
   * 创建所有知识点的生成任务
   */
  async scheduleAll(options: GenerationOptions): Promise<{
    scheduled: number
    skipped: number
    totalQuestions: number  // 预计生成总数
  }>

  /**
   * 为单个知识点创建生成任务
   */
  async scheduleOne(
    knowledgePointId: string,
    mode: 'core' | 'edge',
    options?: Pick<GenerationOptions, 'questionsPerLevel' | 'intervalSeconds'>
  ): Promise<void>

  /**
   * 获取生成进度
   */
  async getProgress(knowledgePointId: string): Promise<GenerationProgress>

  /**
   * 取消生成任务
   */
  async cancel(knowledgePointId: string): Promise<void>
}
```

### 5.2 generateQuestionsWorker（执行层）

```typescript
// lib/question-generation/worker.ts

interface WorkerJobData {
  knowledgePointId: string
  mode: 'core' | 'edge'
  difficultyRange: { min: number; max: number }
  questionsPerLevel: number    // 从任务数据中读取
  intervalSeconds: number       // 从任务数据中读取
  retryCount: number            // 重试计数
}

export async function generateQuestionsWorker(job: PgBossJob<WorkerJobData>) {
  const { knowledgePointId, mode, difficultyRange, questionsPerLevel, intervalSeconds, retryCount } = job.data

  // 检查重试次数
  if (retryCount >= 3) {
    await markFailed(knowledgePointId, 'Max retries exceeded')
    return
  }

  // 1. 加载知识点（含描述、示例等）
  const kp = await loadKnowledgePointWithDetails(knowledgePointId)

  // 2. 为每个难度等级生成指定数量的题目
  for (let level = difficultyRange.min; level <= difficultyRange.max; level++) {
    const currentCount = kp.generationProgress?.[level] || 0
    if (currentCount >= questionsPerLevel) continue

    const questions = await generateAndSaveCards({
      knowledgePointId: kp.id,
      content: buildPromptContent(kp, level),
      difficulty: level,
      count: questionsPerLevel - currentCount,
      types: ['fill_blank', 'multiple_choice'],
    })

    // 3. 更新进度
    await updateProgress(kp.id, level, questions.length)
  }

  // 4. 检查是否完成
  const isComplete = await checkComplete(kp.id, questionsPerLevel)
  if (isComplete) {
    await markCompleted(kp.id)
  } else {
    // 5. intervalSeconds 后继续（同一批次）
    await pgBoss.send('question-generation-' + mode, {
      ...job.data,
      retryCount: retryCount + 1
    }, {
      startAfter: `${intervalSeconds} seconds`
    })
  }
}
```

### 5.3 PromptBuilder（提示词构建）

```typescript
// lib/question-generation/prompt-builder.ts
export class PromptBuilder {
  /**
   * 根据知识点信息和难度构建 AI 提示词
   */
  buildPrompt(knowledgePoint: KnowledgePointWithDetails, difficulty: number): string {
    const parts = [
      `知识点: ${knowledgePoint.name}`,
      knowledgePoint.description ? `描述: ${knowledgePoint.description}` : null,
      knowledgePoint.examples ? `示例: ${formatExamples(knowledgePoint.examples)}` : null,
      knowledgePoint.teachingNotes ? `教学要点: ${knowledgePoint.teachingNotes}` : null,
      knowledgePoint.commonMistakes ? `易错点: ${knowledgePoint.commonMistakes}` : null,
      `难度等级: ${difficulty}/12`,
      `生成 10 道题目，题型：填空题和选择题`
    ].filter(Boolean)

    return parts.join('\n\n')
  }
}
```

### 5.4 API 端点

```typescript
// app/api/admin/question-generation/route.ts
import { auth } from '@/lib/auth'
import { getAdminUser } from '@/lib/admin-auth'

// 错误码定义
enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_PARAMS = 'INVALID_PARAMS',
  KNOWLEDGE_POINT_NOT_FOUND = 'KP_NOT_FOUND',
  GENERATION_FAILED = 'GEN_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
}

interface ErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. 管理员权限检查（getAdminUser 从 cookie 读取 token 并验证）
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: '需要管理员权限',
        },
      }, { status: 403 })
    }

    // 3. 验证请求参数
    const body = await req.json()
    const options: GenerationOptions = {
      mode: body.mode || 'core',
      knowledgePointIds: body.knowledgePointIds,
      questionsPerLevel: body.questionsPerLevel ?? 10,
      intervalSeconds: body.intervalSeconds ?? 180,
    }

    // 参数校验
    if (
      !['core', 'edge', 'all'].includes(options.mode) ||
      options.questionsPerLevel < 1 ||
      options.questionsPerLevel > 100 ||
      options.intervalSeconds < 10
    ) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.INVALID_PARAMS,
          message: '参数无效',
          details: {
            mode: '必须是 core, edge, all 之一',
            questionsPerLevel: '必须在 1-100 之间',
            intervalSeconds: '必须 >= 10',
          },
        },
      }, { status: 400 })
    }

    const service = new QuestionGenerationService()
    const result = await service.scheduleAll(options)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[QuestionGeneration API] Error:', error)
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.GENERATION_FAILED,
        message: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
    }, { status: 500 })
  }
}

// app/api/admin/question-generation/progress/[id]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 管理员权限检查
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.UNAUTHORIZED,
          message: '需要管理员权限',
        },
      }, { status: 403 })
    }

    const service = new QuestionGenerationService()
    const progress = await service.getProgress(params.id)

    if (!progress) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorCode.KNOWLEDGE_POINT_NOT_FOUND,
          message: '知识点不存在',
        },
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: progress,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorCode.GENERATION_FAILED,
        message: '服务器内部错误',
      },
    }, { status: 500 })
  }
}
```

---

## 六、脏数据修复方案

### 6.1 修复脚本

| 脚本 | 作用 |
|------|------|
| `scripts/fix-orphaned-questions.ts` | 修复孤儿题目（题目引用的知识点不存在） |
| `scripts/bulk-generate-existing-kp.ts` | 为现有知识点批量生成题目 |
| `scripts/merge-duplicate-knowledge-points.ts` | 合并重复知识点 |
| `scripts/fix-id-format.ts` | 修复 ID 格式不一致 |

### 6.2 修复策略

**孤儿题目**：
1. 找出所有题目引用的知识点 ID
2. 找出不存在于 KnowledgePoint 表的 ID
3. 创建对应的知识点（inAssess=false，标记为"已删除"）

**重复知识点**：
1. 按名称分组
2. 保留有题目的版本
3. 将其他版本的 inAssess 设为 false

---

## 七、数据模型扩展

### 7.1 Prisma Schema

```prisma
model KnowledgePoint {
  // ... 现有字段

  // 新增字段（B类方案，V1 可为空）
  description        String?
  examples           Json?          // Array<{ question: string; answer: string }>
  difficultyLevel    Int?           @default(6)
  relatedTopics      Json?          // string[] 前置知识点ID

  // 可选字段
  teachingNotes      String?
  commonMistakes     String?

  // 生成状态
  generationStatus      String         @default("pending")
  generationProgress    Json?          // { "1": 10, "2": 5, ... } 注意：key是字符串
  generationTarget      Int            @default(10)     // 每等级目标题数
  lastGeneratedAt       DateTime       @default(now())  // 最后生成时间
  generationError       String?                       // 失败原因
  coreGenerationJobId   String?                       // pg-boss 任务ID（core 难度）
  edgeGenerationJobId   String?                       // pg-boss 任务ID（edge 难度）

  // 约束
  @@index([generationStatus])
  @@index([inAssess, generationStatus])
  @@index([coreGenerationJobId])
  @@index([edgeGenerationJobId])
}
```

### 7.2 类型定义

```typescript
// types/knowledge-point.ts

export interface KnowledgePointWithDetails extends KnowledgePoint {
  description?: string
  examples?: Array<{ question: string; answer: string }>
  difficultyLevel?: number
  relatedTopics?: string[]  // 前置知识点ID
  teachingNotes?: string
  commonMistakes?: string
  generationProgress?: Record<string, number>  // 注意：key是字符串 "1", "2", ...
  generationTarget?: number
  lastGeneratedAt?: Date
  generationError?: string
  coreGenerationJobId?: string               // pg-boss 任务ID（core 难度）
  edgeGenerationJobId?: string               // pg-boss 任务ID（edge 难度）
}

export interface GenerationProgress {
  knowledgePointId: string
  knowledgePointName: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  targetPerLevel: number                    // 每等级目标题数
  progress: Record<string, number>          // { "1": 10, "2": 5, ... }
  totalRequired: number                     // 12等级 × targetPerLevel
  totalGenerated: number
  lastUpdated: Date
  error?: string                            // 失败时的错误信息
  coreJobId?: string                        // pg-boss 任务ID（core 难度）
  edgeJobId?: string                        // pg-boss 任务ID（edge 难度）
}

export interface GenerationOptions {
  mode: 'core' | 'edge' | 'all'
  knowledgePointIds?: string[]     // 空 = 全部
  questionsPerLevel?: number        // 每等级题目数，默认 10
  intervalSeconds?: number          // 重试间隔，默认 180（3分钟）
}

export interface GenerationResult {
  scheduled: number                // 成功调度的知识点数
  skipped: number                  // 跳过的知识点数（已在进行中）
  totalQuestions: number           // 预计生成总数
  errors?: Array<{
    knowledgePointId: string
    error: string
  }>
}
```

---

## 八、实施计划

### Phase 1: 数据模型（0.25天）

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 1.1 | 扩展 Prisma schema | npx prisma migrate dev |
| 1.2 | 生成类型 | npx prisma generate |
| 1.3 | 更新 KnowledgePoint 类型 | tsc --noEmit 通过 |

### Phase 2: 核心服务（1天）

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 2.1 | 创建 QuestionGenerationService | 单元测试：scheduleAll 正确 |
| 2.2 | 创建 generateQuestionsWorker | 单元测试：生成逻辑正确 |
| 2.3 | 创建 PromptBuilder | 测试：提示词格式正确 |
| 2.4 | 安装 pg-boss | npm install pg-boss |
| 2.5 | 配置 pg-boss | 测试：任务入队成功 |

### Phase 3: API 端点（0.5天）

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 3.1 | 创建 /api/admin/question-generation | curl 测试：返回 200 |
| 3.2 | 创建 /api/admin/question-generation/progress/[id] | curl 测试：返回进度 |

### Phase 4: 脏数据修复（0.5天）

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 4.1 | 创建 fix-orphaned-questions.ts | 运行：孤儿题目修复 |
| 4.2 | 创建 bulk-generate-existing-kp.ts | 运行：现有知识点点开始生成 |
| 4.3 | 创建 merge-duplicate-knowledge-points.ts | 运行：重复知识点合并 |

### Phase 5: CRITICAL 修复（0.25天）

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 5.1 | 修改 `/api/assessment/start` 错误处理 | 单元测试：AI 失败返回 500 |
| 5.2 | 添加生成后验证逻辑 | 单元测试：不足时抛出错误 |
| 5.3 | 更新错误响应格式 | 测试：错误信息清晰 |

### Phase 6: 集成测试（0.25天）

| 测试场景 | 操作 | 预期结果 |
|---------|------|---------|
| 调度核心难度 | POST mode=core | 生成 4-9 级题目 |
| 调度边缘难度 | POST mode=edge | 生成 1-3, 10-12 级题目 |
| 进度查询 | GET progress/:id | 返回实时进度 |
| 失败重试 | AI 返回错误 | 3 分钟后重试 |
| 完成标记 | 120 题全部生成 | status=completed |
| **题目不足强制补全** | 模拟题目为空 | AI 生成成功或返回 500 |
| **AI 失败阻断** | 模拟 AI 失败 | 返回 500，不降级 |

**总时间**：2.75天

---

## 九、文件清单

| 文件 | 作用 | 代码量 |
|------|------|--------|
| `prisma/schema.prisma` | 扩展 KnowledgePoint 表 | ~20 行 |
| `lib/question-generation/service.ts` | 调度服务 | ~150 行 |
| `lib/question-generation/worker.ts` | 作业执行器 | ~100 行 |
| `lib/question-generation/prompt-builder.ts` | AI 提示词构建 | ~80 行 |
| `lib/question-generation/types.ts` | 类型定义 | ~30 行 |
| `app/api/admin/question-generation/route.ts` | 管理API | ~50 行 |
| `app/api/admin/question-generation/progress/[id]/route.ts` | 进度查询 | ~30 行 |
| `scripts/fix-orphaned-questions.ts` | 孤儿题目修复 | ~60 行 |
| `scripts/bulk-generate-existing-kp.ts` | 批量生成 | ~40 行 |
| `scripts/merge-duplicate-knowledge-points.ts` | 重复知识点合并 | ~50 行 |
| `app/api/assessment/start/route.ts` | 修改：过滤未完成的知识点 | ~10 行修改 |

**总计**：~620 行新增代码

---

## 十、验收标准

### 基础功能
- [ ] 管理员可触发题目生成
- [ ] 支持前端配置 `questionsPerLevel`（默认 10）
- [ ] 核心难度（4-9级）优先生成
- [ ] 边缘难度（1-3级，10-12级）可选生成
- [ ] 间隔时间可配置（默认 180 秒）
- [ ] 进度实时可查（API 返回）
- [ ] 失败自动重试（最多3次）
- [ ] 达到目标题数后标记完成
- [ ] 脏数据修复脚本可运行
- [ ] 单元测试覆盖率 >80%

### CRITICAL 修复（题目死锁）
- [ ] `/api/assessment/start` 题目不足时强制补全
- [ ] AI 生成失败时返回 500 错误（不降级）
- [ ] 绝不返回"部分题目"
- [ ] 错误信息清晰，用户可理解
- [ ] 测试用例覆盖：题目充足、题目不足、AI 失败

### 前端配置示例

```typescript
// 快速验证模式（测试用）
POST /api/admin/question-generation
{
  "mode": "core",
  "questionsPerLevel": 1,  // 每等级 1 题，共 6 题
  "intervalSeconds": 10    // 10 秒间隔
}

// 生产环境模式
POST /api/admin/question-generation
{
  "mode": "all",
  "questionsPerLevel": 10,  // 每等级 10 题，共 120 题
  "intervalSeconds": 180    // 3 分钟间隔
}
```

---

## 十一、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| AI 生成速度慢 | 生成时间长 | 分批生成，间隔 3 分钟 |
| AI 生成失败 | 题目缺失 | 失败重试 3 次 |
| API 限流 | 中断 | 实现指数退避 |
| 数据库锁 | 性能下降 | pg-boss 幂等性保证 |

---

## 十二、题目死锁修复（CRITICAL）

### 12.1 问题描述

当前 `/api/assessment/start` 存在 **CRITICAL 缺陷**：

```typescript
// 当前代码（第 243-246 行）
} catch (error) {
  console.error('[Assessment Start] AI 生成失败:', error);
  // AI 生成失败时返回已有题目，不完全失败  <-- 降级逻辑
}
```

**死锁场景**：
```
用户开始测评 → 需要题目 → AI 生成失败 → 返回错误 → 测评失败！
```

### 12.2 修复原则

**不接受降级**：必须确保题目存在，而不是"友好404"或"返回部分题目"。

### 12.3 强制补全机制

在 `/api/assessment/start` 中加入 **强制补全逻辑**：

```typescript
// 修复后的逻辑
const targetCount = 10;

// 1. 先尝试从数据库获取已有题目
for (const kp of selectedKnowledgePoints) {
  const existingQuestions = await prisma.question.findMany({
    where: {
      knowledgePoints: { contains: kp.id },
      difficulty: { gte: minDifficulty, lte: maxDifficulty },
    },
    take: targetCount,
  });

  questions.push(...existingQuestions.map(q => ({...})));
}

// 2. 题目不足时，强制同步生成
if (questions.length < targetCount) {
  const shortage = targetCount - questions.length;

  try {
    console.log(`[Assessment Start] 题目不足(${questions.length}/${targetCount})，强制生成 ${shortage} 题`);

    // 2.1 设置超时保护（15秒）
    const generatePromise = generateAndSaveCards({
      knowledgePointId: selectedKnowledgePoints[0]?.id || '',
      content: generationContent,
      types: ['fill_blank', 'multiple_choice'],
      count: shortage,
      difficulty: startDifficulty,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI生成超时（15秒）')), 15000)
    );

    const result = await Promise.race([generatePromise, timeoutPromise]) as GenerateResult;

    questions.push(...result.questions.map(q => ({...})));

    // 3. 验证生成结果
    if (questions.length < targetCount) {
      // 生成后仍不足 = 抛出错误，阻断测评
      throw new Error(`题目生成失败：已获取 ${questions.length}/${targetCount} 题`);
    }

    console.log(`[Assessment Start] 强制补全完成，共 ${questions.length} 题`);

  } catch (error) {
    // 4. 生成失败 = 不降级，直接返回错误
    console.error('[Assessment Start] 题目生成失败:', error);

    return NextResponse.json({
      success: false,
      error: '题目生成失败，请稍后重试或联系管理员',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    }, { status: 500 });
  }
}

// 5. 最终检查
if (questions.length === 0) {
  return NextResponse.json({
    success: false,
    error: '无法获取测评题目，请稍后重试',
    noQuestionsAvailable: true,
  }, { status: 400 });
}
```

### 12.4 保证

| 场景 | 行为 | 结果 |
|------|------|------|
| 题目充足 | 直接返回 | ✅ 测评开始 |
| 题目不足 + AI 成功 | 强制补全后返回 | ✅ 测评开始 |
| 题目不足 + AI 失败 | 返回 500 错误 | ❌ 测评阻断 |

**关键原则**：绝不返回"部分题目"，要么全有，要么全无。

### 12.5 实施变更

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 12.1 | 修改 `/api/assessment/start` 第 243-246 行 | 单元测试：AI 失败时返回 500 |
| 12.2 | 添加生成后验证逻辑 | 单元测试：生成不足时抛出错误 |
| 12.3 | 更新错误响应格式 | 测试：错误信息清晰 |

---

## 十三、修改记录

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| v1 | 2026-05-07 | 初始版本，固定 120 题/知识点 |
| v2 | 2026-05-07 | 题目数量改为前端可选（`questionsPerLevel` 参数） |
| v3 | 2026-05-07 | Swarm Review 反馈修复：<br>• 澄清批次概念（core-job + edge-job 独立任务）<br>• 添加任务去重机制（generationJobId + 状态检查）<br>• 定义 API 错误响应格式（ErrorCode）<br>• 添加认证/授权检查（@admin）<br>• 添加边界处理（6种场景）<br>• 添加 generationTarget、generationError、generationJobId 字段<br>• 澄清 examples 字段来源（V1可为空） |
| v4 | 2026-05-07 | 第二轮 Review 反馈修复：<br>• 修复 `generationJobId` 冲突（改为 `coreGenerationJobId` + `edgeGenerationJobId`）<br>• 修复 `requireAdmin` 调用方式（改为 `getAdminUser()`）<br>• 添加 progress API 管理员权限检查<br>• `lastGeneratedAt` 字段添加默认值 `now()`<br>• 更新去重机制使用正确的 jobId 字段 |
| v5 | 2026-05-07 | **CRITICAL 修复**：题目死锁问题<br>• 添加"强制补全机制"章节（第十二章）<br>• 明确"不接受降级"原则<br>• 修改 `/api/assessment/start` 错误处理逻辑<br>• 保证：要么全有，要么全无 |
| v6 | 2026-05-07 | 第三轮 Review 反馈修复：<br>• 添加 15 秒超时保护（Promise.race）<br>• 明确超时场景的错误处理<br>• 更新实施计划添加超时测试用例 |
