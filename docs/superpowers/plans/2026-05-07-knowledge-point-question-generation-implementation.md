# 知识点派生题目机制 - 实施计划

**日期**: 2026-05-07
**设计文档**: `docs/superpowers/specs/2026-05-07-knowledge-point-question-generation-design.md`
**总时间**: 2.75 天

---

## Phase 1: 数据模型扩展（0.25天）

| Step | Action | File | Verification |
|------|--------|------|--------------|
| 1.1 | 扩展 KnowledgePoint 模型添加生成状态字段 | `prisma/schema.prisma` | `npx prisma migrate dev --name add_generation_fields` 成功 |
| 1.2 | 添加索引优化查询性能 | `prisma/schema.prisma` | Schema 包含 4 个新索引 |
| 1.3 | 生成 Prisma Client | - | `npx prisma generate` 无错误 |
| 1.4 | 创建类型定义文件 | `lib/question-generation/types.ts` | `tsc --noEmit` 通过 |

**新增字段清单**：
```prisma
// KnowledgePoint 新增字段
description            String?
examples               Json?
difficultyLevel        Int?           @default(6)
relatedTopics          Json?
teachingNotes          String?
commonMistakes         String?
generationStatus       String         @default("pending")
generationProgress     Json?          // Record<string, number>
generationTarget       Int            @default(10)
lastGeneratedAt        DateTime       @default(now())
generationError        String?
coreGenerationJobId    String?
edgeGenerationJobId    String?
```

**新增索引**：
```prisma
@@index([generationStatus])
@@index([inAssess, generationStatus])
@@index([coreGenerationJobId])
@@index([edgeGenerationJobId])
```

---

## Phase 2: 核心服务层（1天）

| Step | Action | File | Verification |
|------|--------|------|--------------|
| 2.1 | 创建 PromptBuilder 类 | `lib/question-generation/prompt-builder.ts` | 单元测试：提示词格式正确 |
| 2.2 | 创建 QuestionGenerationService | `lib/question-generation/service.ts` | 单元测试：scheduleAll 返回正确计数 |
| 2.3 | 创建状态管理辅助函数 | `lib/question-generation/state-helpers.ts` | 单元测试：状态转换正确 |
| 2.4 | 安装并配置 pg-boss | `lib/question-generation/pg-boss.ts` | 测试：任务入队成功 |
| 2.5 | 创建 generateQuestionsWorker | `lib/question-generation/worker.ts` | 集成测试：生成流程完整 |

### 2.1 PromptBuilder (`lib/question-generation/prompt-builder.ts`)
```typescript
export class PromptBuilder {
  buildPrompt(kp: KnowledgePointWithDetails, difficulty: number): string
  private formatExamples(examples: Array<{question, answer}>): string
}
```

### 2.2 QuestionGenerationService (`lib/question-generation/service.ts`)
```typescript
export class QuestionGenerationService {
  async scheduleAll(options: GenerationOptions): Promise<GenerationResult>
  async scheduleOne(knowledgePointId: string, mode: 'core' | 'edge', options?: ScheduleOptions): Promise<void>
  async getProgress(knowledgePointId: string): Promise<GenerationProgress | null>
  async cancel(knowledgePointId: string): Promise<void>
  private checkDuplicate(kp: KnowledgePoint, mode: 'core' | 'edge'): Promise<boolean>
}
```

### 2.3 State Helpers (`lib/question-generation/state-helpers.ts`)
```typescript
export async function markPending(knowledgePointId: string): Promise<void>
export async function markInProgress(knowledgePointId: string, jobId: string, mode: 'core' | 'edge'): Promise<void>
export async function markCompleted(knowledgePointId: string): Promise<void>
export async function markFailed(knowledgePointId: string, error: string): Promise<void>
export async function updateProgress(knowledgePointId: string, level: number, count: number): Promise<void>
export async function checkComplete(knowledgePointId: string, targetPerLevel: number): Promise<boolean>
export function loadKnowledgePointWithDetails(knowledgePointId: string): Promise<KnowledgePointWithDetails | null>
```

### 2.4 pg-boss 配置 (`lib/question-generation/pg-boss.ts`)
```typescript
import PgBoss from 'pg-boss'

export const pgBoss = new PgBoss(process.env.DATABASE_URL)

export async function initPgBoss(): Promise<void> {
  await pgBoss.start()
  await pgBoss.createQueue('question-generation-core')
  await pgBoss.createQueue('question-generation-edge')
}

// 在 app.ts 或 server.ts 启动时调用
// initPgBoss().catch(console.error)
```

---

## Phase 3: 管理员 API（0.5天）

| Step | Action | File | Verification |
|------|--------|------|--------------|
| 3.1 | 创建主调度 API | `app/api/admin/question-generation/route.ts` | `curl -X POST` 返回 200 |
| 3.2 | 创建进度查询 API | `app/api/admin/question-generation/progress/[id]/route.ts` | `curl -X GET` 返回进度 |
| 3.3 | 创建取消任务 API | `app/api/admin/question-generation/cancel/[id]/route.ts` | `curl -X DELETE` 标记取消 |

**API 端点规格**：

### POST /api/admin/question-generation
```typescript
Request: { mode: 'core' | 'edge' | 'all', knowledgePointIds?: string[], questionsPerLevel?: number, intervalSeconds?: number }
Response: { success: true, data: { scheduled: number, skipped: number, totalQuestions: number } }
```

### GET /api/admin/question-generation/progress/[id]
```typescript
Response: { success: true, data: { status, progress, totalGenerated, error? } }
```

---

## Phase 4: 脏数据修复（0.5天）

| Step | Action | File | Verification |
|------|--------|------|--------------|
| 4.1 | 创建孤儿题目修复脚本 | `scripts/fix-orphaned-questions.ts` | 运行后无孤儿题目 |
| 4.2 | 创建批量生成脚本 | `scripts/bulk-generate-existing-kp.ts` | 所有知识点状态更新 |
| 4.3 | 创建重复知识点合并脚本 | `scripts/merge-duplicate-knowledge-points.ts` | 重复项被禁用 |

---

## Phase 5: CRITICAL 修复 - 题目死锁（0.25天）

| Step | Action | File | Verification |
|------|--------|------|--------------|
| 5.1 | 修改 `/api/assessment/start` 错误处理 | `app/api/assessment/start/route.ts:243-246` | 单元测试：AI 失败返回 500 |
| 5.2 | 添加可配置超时保护 | `app/api/assessment/start/route.ts` | 测试：超时后返回错误 |
| 5.3 | 添加生成后验证逻辑 | `app/api/assessment/start/route.ts` | 单元测试：不足时抛错 |

**环境变量**（`.env.local`）：
```bash
# AI 生成超时时间（毫秒），默认 15000（15秒）
AI_GENERATION_TIMEOUT=15000
```

**核心变更**：
```typescript
// 替换第 243-246 行的降级逻辑
if (questions.length < targetCount) {
  const shortage = targetCount - questions.length;
  const timeout = parseInt(process.env.AI_GENERATION_TIMEOUT || '15000', 10);

  try {
    const generatePromise = generateAndSaveCards({...});
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI生成超时（${timeout}ms）`)), timeout)
    );
    const result = await Promise.race([generatePromise, timeoutPromise]);
    questions.push(...result.questions);

    if (questions.length < targetCount) {
      throw new Error(`题目生成失败：已获取 ${questions.length}/${targetCount} 题`);
    }
  } catch (error) {
    return NextResponse.json({ error: '题目生成失败，请稍后重试' }, { status: 500 });
  }
}
```

---

## Phase 6: 集成测试（0.25天）

| 测试场景 | 操作 | 预期结果 |
|---------|------|---------|
| 调度核心难度 | POST mode=core | 生成 4-9 级题目 |
| 调度边缘难度 | POST mode=edge | 生成 1-3, 10-12 级题目 |
| 并发调度 | 两次 POST 相同知识点 | 第二次返回 skipped=1 |
| 进度查询 | GET progress/:id | 返回实时进度 |
| **题目不足强制补全** | 模拟题目为空 | AI 生成成功或返回 500 |
| **AI 失败阻断** | 模拟 AI 失败 | 返回 500，不降级 |
| **超时保护** | 模拟 AI 超时 | 15 秒（可配置）后返回错误 |

---

## 文件清单总结

| 文件 | 新增/修改 | 代码量 |
|------|----------|--------|
| `prisma/schema.prisma` | 修改 | ~30 行 |
| `lib/question-generation/types.ts` | 新增 | ~50 行 |
| `lib/question-generation/prompt-builder.ts` | 新增 | ~80 行 |
| `lib/question-generation/service.ts` | 新增 | ~180 行 |
| `lib/question-generation/state-helpers.ts` | 新增 | ~100 行 |
| `lib/question-generation/pg-boss.ts` | 新增 | ~40 行 |
| `lib/question-generation/worker.ts` | 新增 | ~120 行 |
| `app/api/admin/question-generation/route.ts` | 新增 | ~80 行 |
| `app/api/admin/question-generation/progress/[id]/route.ts` | 新增 | ~50 行 |
| `app/api/admin/question-generation/cancel/[id]/route.ts` | 新增 | ~40 行 |
| `app/api/assessment/start/route.ts` | 修改 | ~50 行修改 |
| `scripts/fix-orphaned-questions.ts` | 新增 | ~60 行 |
| `scripts/bulk-generate-existing-kp.ts` | 新增 | ~40 行 |
| `scripts/merge-duplicate-knowledge-points.ts` | 新增 | ~50 行 |
| 测试文件 | 新增 | ~300 行 |

**总计**：~1230 行新增代码

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| pg-boss 安装失败 | 高 | 先本地测试安装 |
| AI 生成速度慢 | 中 | 分批生成，intervalSeconds 可配置 |
| 数据库锁 | 中 | 使用事务隔离级别 READ COMMITTED |
| 超时处理 | 高 | Promise.race 实现，超时时间可配置（AI_GENERATION_TIMEOUT） |
| 环境变量缺失 | 中 | 提供默认值 15000ms |

## 环境变量清单

```bash
# .env.local
AI_GENERATION_TIMEOUT=15000  # AI 生成超时时间（毫秒）
DATABASE_URL=...              # pg-boss 使用数据库连接
```
