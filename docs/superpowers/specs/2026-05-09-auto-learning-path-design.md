# 自动生成学习路径方案设计

**日期**: 2026-05-09
**目标**: 60-89分测评完成后自动生成学习路径，无需用户手动点击

---

## 一、问题背景

### 1.1 当前流程

```
测评完成(85分) → 结果页显示"一键生成学习路径"按钮
                              ↓
                    用户手动点击
                              ↓
                    调用 generate API
```

### 1.2 问题

- 用户体验断点：需要手动点击
- 如果用户跳过结果页直接去练习，知识点范围不清晰
- 练习题目来源不明确

### 1.3 期望流程

```
测评完成(85分) → 服务端自动生成学习路径 → 结果页直接显示"查看学习路径"
                              ↓
                    进入练习时检查学习路径
                              ↓
                    练习题目来自学习路径
                              ↓
              允许手工重新生成（救济措施）
```

---

## 二、方案设计

### 2.1 核心改动

#### 1. `finish` API 自动生成 (`app/api/assessment/finish/route.ts`)

在 60-89 分时，返回结果前自动生成学习路径：

```typescript
// 在事务中
if (60 <= scoreResult.score && scoreResult.score < 90) {
  // 复用 generate 的核心逻辑，不调用外部 API
  const learningPathId = await generateLearningPathInTransaction(tx, {
    userId: session.user.id,
    assessmentId: createdAssessmentId,
    knowledgeData: scoreResult.knowledgeLevels,
  });
  returnData.learningPathId = learningPathId;
}
```

#### 2. 创建检查 API (`app/api/practice/check/route.ts`)

所有进入练习的入口先调用此 API：

```
POST /api/practice/check
{
  "returnTo": "/practice"  // 或 "/practice?knowledgePointId=xxx"
}

Response:
{
  "success": true,
  "redirectUrl": "/practice",  // 可能已自动生成路径
  "hasLearningPath": true,
  "learningPathId": "xxx"
}
```

#### 3. 统一入口函数 (`lib/practice-nav.ts`)

```typescript
// 供所有入口使用
export async function ensureLearningPathAndNavigate(
  userId: string,
  returnTo: string
): Promise<{ redirectUrl: string; hasLearningPath: boolean }>
```

#### 4. 允许手工重新生成（救济措施）

| 入口位置 | 触发条件 | 动作 |
|---------|---------|------|
| **学习路径 tab** (`LearningPathTab`) | 有路径时 | "更新路径"按钮（已有） |
| **成长分析 tab** (`GrowthAnalysisTab`) | AI 建议卡片 | "重新生成路径"按钮（已有） |
| **学习路径 tab** (`LearningPathTab`) | 无路径时 | 显示"生成学习路径"按钮（新增）|

### 2.2 入口点处理

**统一函数** `lib/practice-nav.ts`（简化修改）：

```typescript
/**
 * 确保有学习路径后导航到练习页
 * @param userId 用户 ID
 * @param returnTo 目标页面，默认 /practice
 * @returns { redirectUrl, hasLearningPath, learningPathId }
 */
export async function ensureLearningPathAndNavigate(
  userId: string,
  returnTo: string = '/practice'
): Promise<{ redirectUrl: string; hasLearningPath: boolean; learningPathId: string | null }> {
  const res = await fetch('/api/practice/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnTo }),
  });
  const data = await res.json();

  if (data.success) {
    return {
      redirectUrl: data.redirectUrl,
      hasLearningPath: data.hasLearningPath,
      learningPathId: data.learningPathId || null,
    };
  }

  // 未测评情况，跳转到诊断页
  if (data.needsDiagnostic) {
    return { redirectUrl: '/assessment/diagnostic', hasLearningPath: false, learningPathId: null };
  }

  // 默认返回原目标
  return { redirectUrl: returnTo, hasLearningPath: false, learningPathId: null };
}
```

**入口文件改动**（最小修改原则）：

| 入口文件 | 改动方式 |
|---------|---------|
| `app/assessment/result/page.tsx` | 根据 finish API 返回的 `learningPathId` 显示不同按钮 |
| `components/AnalyzePage/LearningPathTab.tsx` | 无路径时显示"生成学习路径"按钮 |
| 其他跳转练习的入口 | 可选：使用 `ensureLearningPathAndNavigate` |

**说明**：由于 finish API 已经自动生成，大部分入口不需要修改。只有测评结果页需要根据 `learningPathId` 显示不同按钮。

### 2.3 数据流

```
用户点击"开始练习"
        ↓
调用 /api/practice/check
        ↓
检查 LearningPath 是否存在
        ↓
  存在 → 返回 { redirectUrl: returnTo }
  不存在 → 检查是否完成测评
              ↓
        已完成测评 → 自动生成 LearningPath → 返回
        未完成测评 → 生成默认路径或返回错误
```

---

## 三、关键代码改动

### 3.1 finish API 改动

**文件**: `app/api/assessment/finish/route.ts`

**在事务中、返回 JSON 前添加**（注意：在事务内部执行，确保原子性）：

```typescript
// 在事务内部（createdAssessmentId 创建后）
let learningPathId: string | null = null;
if (60 <= scoreResult.score && scoreResult.score < 90) {
  try {
    // 在同一事务内生成学习路径，确保原子性
    learningPathId = await generateLearningPathInTransaction(tx, {
      userId: session.user.id,
      assessmentId: createdAssessmentId,
    });
    console.log('[Assessment Finish] Learning path auto-generated:', learningPathId);
  } catch (err) {
    console.error('[Assessment Finish] Failed to auto-generate learning path:', err);
    // 不阻塞流程，允许用户稍后手动生成
    learningPathId = null;
  }
}
```

**关键设计决策：**
- **在事务内部生成**：确保学习路径创建和测评记录的原子性
- **失败不阻塞**：生成失败时返回 `learningPathId: null`，前端显示"生成学习路径"按钮作为救济
- **返回值明确**：`null` 表示未生成或失败，字符串 ID 表示成功生成

### 3.2 新增 check API

**文件**: `app/api/practice/check/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { returnTo } = await req.json();

  // 1. 检查是否已有 active 学习路径
  const existingPath = await prisma.learningPath.findFirst({
    where: { userId: session.user.id, status: 'active' }
  });

  if (existingPath) {
    return NextResponse.json({
      success: true,
      redirectUrl: returnTo || '/practice',
      hasLearningPath: true,
      learningPathId: existingPath.id
    });
  }

  // 2. 检查是否完成测评
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { initialAssessmentCompleted: true, initialAssessmentScore: true }
  });

  if (!user?.initialAssessmentCompleted) {
    // 未测评：返回提示或跳转诊断页
    return NextResponse.json({
      success: false,
      needsDiagnostic: true,
      redirectUrl: '/assessment/diagnostic'
    });
  }

  // 3. 测评已完成但无路径：检查分数是否适合自动生成
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: session.user.id, type: 'initial' },
    orderBy: { completedAt: 'desc' }
  });

  if (latestAssessment && 60 <= latestAssessment.score && latestAssessment.score < 90) {
    try {
      const newPathId = await generateLearningPathInTransaction(prisma, {
        userId: session.user.id,
        assessmentId: latestAssessment.id,
      });

      return NextResponse.json({
        success: true,
        redirectUrl: returnTo || '/practice',
        hasLearningPath: true,
        learningPathId: newPathId,
        autoGenerated: true
      });
    } catch (err) {
      console.error('[Practice Check] Auto-generate failed:', err);
      // 生成失败，允许进入练习（使用 UserKnowledge）
    }
  }

  // 4. 其他情况：允许进入（使用 UserKnowledge）
  return NextResponse.json({
    success: true,
    redirectUrl: returnTo || '/practice',
    hasLearningPath: false,
    learningPathId: null
  });
}
```

**关键设计决策：**
- **幂等性**：先检查 `existingPath`，避免重复生成
- **自动生成尝试**：测评 60-89 分时自动尝试生成
- **失败降级**：生成失败时仍允许进入练习，使用 UserKnowledge 机制

### 3.3 抽取生成逻辑

**文件**: `lib/learning-path/auto-generate.ts`

将 `generate/route.ts` 的核心逻辑抽取为可复用函数：

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calculatePriority,
  generatePriorityReasons,
  getUserMastery,
  getDaysSincePractice,
  getRecentFailureRate,
} from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';
import { PathNodeStatus } from '@/lib/learning-path/types';

const MASTERY_THRESHOLD = 0.9;

/**
 * 在事务内部生成学习路径
 * 注意：此函数在事务内部调用，使用传入的 tx 而不是全局 prisma
 */
export async function generateLearningPathInTransaction(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    assessmentId: string;
  }
): Promise<string> {
  const { userId, assessmentId } = params;

  // 1. 获取测评记录并提取薄弱知识点
  const assessment = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { score: true, knowledgeData: true },
  });

  if (!assessment) {
    throw new Error('测评记录不存在');
  }

  if (assessment.score < 60 || assessment.score >= 90) {
    throw new Error(`测评分数不在可生成学习路径的范围内 (${assessment.score}，要求60-89分)`);
  }

  // 2. 解析知识点数据，提取薄弱知识点 (level <= 1)
  const knowledgeData = assessment.knowledgeData as unknown as AssessmentKnowledgeData;
  const weakKnowledgePointIds = new Set(
    Object.entries(knowledgeData)
      .filter(([_, data]) => data.level <= 1)
      .map(([id, _]) => id)
  );

  if (weakKnowledgePointIds.size === 0) {
    throw new Error('测评中未发现薄弱知识点（无法生成学习路径）');
  }

  // 3. 获取用户数据
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { selectedTextbookId: true, includeStale: true },
  });

  if (!user?.selectedTextbookId) {
    throw new Error('请先选择教材版本');
  }

  // 4. 获取用户启用的知识点
  const enabledKnowledge = await tx.userEnabledKnowledge.findMany({
    where: { userId, nodeType: 'point' },
    select: { nodeId: true },
  });

  const enabledNodeIds = enabledKnowledge.map((ek) => ek.nodeId);

  // 5. 获取知识点
  const knowledgePoints = await tx.knowledgePoint.findMany({
    where: {
      chapter: { textbookId: user.selectedTextbookId },
      status: 'active',
    },
    select: { id: true, name: true, weight: true },
  });

  // 6. 过滤知识点（必须是启用的且薄弱的）
  const enabledKnowledgePoints = knowledgePoints.filter((kp) => {
    if (!enabledNodeIds.includes(kp.id)) return false;
    if (!weakKnowledgePointIds.has(kp.id)) return false;
    return true;
  });

  if (enabledKnowledgePoints.length === 0) {
    throw new Error('没有可生成学习路径的知识点');
  }

  // 7. 计算优先级
  const masteryData = await Promise.all(
    enabledKnowledgePoints.map(async (kp) => {
      const [mastery, daysSincePractice, recentFailureRate] = await Promise.all([
        getUserMastery(userId, kp.id),
        getDaysSincePractice(userId, kp.id),
        getRecentFailureRate(userId, kp.id, 7),
      ]);

      return { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate };
    })
  );

  const knowledgeNodes: PathKnowledgeNode[] = [];
  const now = new Date().toISOString();

  for (const data of masteryData) {
    const { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate } = data;

    if (mastery >= MASTERY_THRESHOLD) continue;

    const priorityResult = calculatePriority({
      mastery,
      weight: kp.weight || 3,
      daysSincePractice,
      recentFailureRate,
      includeStale: user.includeStale,
    });

    const reasons = generatePriorityReasons({
      mastery,
      weight: kp.weight || 3,
      daysSincePractice,
      recentFailureRate,
      includeStale: user.includeStale,
    });

    knowledgeNodes.push({
      nodeId: kp.id,
      priority: priorityResult.score,
      status: 'pending' as PathNodeStatus,
      addedAt: now,
      reasons,
    });
  }

  // 8. 按优先级排序
  knowledgeNodes.sort((a, b) => b.priority - a.priority);

  // 9. 归档旧路径并创建新路径
  await tx.learningPath.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'archived' },
  });

  const path = await tx.learningPath.create({
    data: {
      userId,
      name: `基于测评的学习路径`,
      type: 'initial',
      status: 'active',
      knowledgeData: JSON.stringify(knowledgeNodes),
    },
    select: { id: true },
  });

  return path.id;
}
```

**关键设计决策：**
- **事务参数**：接受 `tx: Prisma.TransactionClient`，在调用方的事务中执行
- **简化版**：仅支持基于测评生成，不支持 `userEdits`（简化逻辑）
- **错误抛出**：失败时抛出错误，由调用方决定是否阻塞

### 3.4 测评结果页改动

**文件**: `app/assessment/result/page.tsx`

**核心改动**：根据 finish API 返回的 `learningPathId` 显示不同内容

```typescript
// 扩展 AssessmentResultData 接口
interface AssessmentResultData {
  // ... 现有字段
  learningPathId?: string | null;  // 新增：自动生成的学习路径 ID
}

// 在 useEffect 中从 finish API 获取结果
const data = await response.json();
if (data.success && data.data) {
  setResult(data.data);
  // data.data.learningPathId 会包含自动生成的学习路径 ID（如果有）
}

// 修改按钮显示逻辑
// 删除：原有的 canGeneratePath 条件和生成按钮
// 替换为：

{result.learningPathId ? (
  // 已自动生成：显示"查看学习路径"
  <div className="bg-success/10 rounded-2xl p-4 mb-4">
    <div className="flex items-center gap-2 mb-2">
      <MaterialIcon icon="check_circle" className="text-success" />
      <h3 className="font-bold text-on-surface">学习路径已生成</h3>
    </div>
    <p className="text-sm text-on-surface-variant mb-3">
      系统已根据你的测评结果生成了个性化学习路径。
    </p>
    <button
      onClick={() => router.push('/analyze?tab=path')}
      className="w-full py-3 rounded-xl font-medium bg-success text-on-success"
    >
      查看学习路径
    </button>
  </div>
) : result.score >= 60 && result.score < 90 ? (
  // 应该生成但失败：显示"生成学习路径"（救济措施）
  <div className="bg-surface-container-low rounded-2xl p-4 mb-4">
    <h3 className="font-bold text-on-surface mb-3">生成学习路径</h3>
    <p className="text-sm text-on-surface-variant mb-4">
      根据你的测评结果，系统可以为你生成一个个性化的学习路径。
    </p>
    <button
      onClick={handleGenerateLearningPath}
      disabled={generatingPath}
      className="w-full py-3 rounded-xl font-medium bg-primary text-on-primary"
    >
      {generatingPath ? '生成中...' : '生成学习路径'}
    </button>
  </div>
) : null}
```

**关键设计决策**：
- **三种状态**：`learningPathId` 有值 → 已生成；`learningPathId` 为 null 且分数 60-89 → 显示生成按钮；其他 → 不显示
- **救济措施**：生成失败时用户仍可手动点击生成
- **保留现有逻辑**：`handleGenerateLearningPath` 函数复用现有代码

---

## 四、验证方法

### 4.1 单元测试

```typescript
// finish API 测试
test('60-89分时自动生成学习路径', async () => {
  const result = await finishAssessment({ score: 85 });
  expect(result.learningPathId).toBeDefined();
});

// check API 测试
test('已有路径时直接返回', async () => {
  mockPrisma.learningPath.findFirst.mockResolvedValue(mockPath);
  const result = await checkPractice({ userId });
  expect(result.hasLearningPath).toBe(true);
});

test('未测评时返回诊断页', async () => {
  mockPrisma.learningPath.findFirst.mockResolvedValue(null);
  mockPrisma.user.initialAssessmentCompleted = false;
  const result = await checkPractice({ userId });
  expect(result.needsDiagnostic).toBe(true);
});
```

### 4.2 E2E 测试

1. 完成测评（85分）→ 结果页显示"查看学习路径"（非"一键生成"）
2. 进入练习页 → 题目来自学习路径
3. 测评完成后直接进入练习 → 自动生成路径

---

## 五、风险与边界

### 5.1 设计审查发现的问题与修复

| 问题 | 类型 | 修复方案 |
|------|------|---------|
| **finish API race condition** | 逻辑一致性 | 在事务内部生成，确保原子性；失败返回 null 而非 undefined |
| **重复生成风险** | 逻辑一致性 | check API 先查 `existingPath`；finish API 在事务内归档旧路径 |
| **generateLearningPathInternal 未定义** | 细节完整性 | 补充完整函数签名和实现 |
| **前端入口过多** | 最小变更 | 创建统一函数 `ensureLearningPathAndNavigate` |
| **救济措施按钮逻辑模糊** | 细节完整性 | 明确三种状态：已生成、可生成、不可生成 |

### 5.2 技术风险

| 风险 | 缓解措施 |
|------|---------|
| finish API 变慢 | 在事务内生成，但超时风险低（仅查询+插入） |
| 生成失败 | try-catch 捕获，返回 null，不阻塞流程 |
| 重复生成 | 归档旧路径 + check API 幂等性检查 |

### 5.3 边界情况

| 情况 | 处理 |
|------|------|
| 用户已有 active 路径 | finish API：归档旧路径，创建新路径；check API：直接返回 |
| 测评分数不在 60-89 | finish API：不自动生成；check API：不自动生成 |
| 用户未完成测评 | check API：返回 needsDiagnostic=true |
| 生成失败 | 返回 learningPathId: null，前端显示"生成学习路径"按钮 |
| 无薄弱知识点 | 抛出错误，finish API 捕获后返回 null

---

## 六、实施步骤

| 步骤 | 任务 | 验证方法 |
|------|------|---------|
| 1 | 创建 `lib/learning-path/auto-generate.ts` | `pnpm build` → exit code 0 |
| 2 | 修改 `finish` API，在事务内调用自动生成 | 测评 85 分后 API 返回 `learningPathId`（字符串） |
| 3 | 修改 `finish` API 返回类型，包含 `learningPathId` | `grep -n "learningPathId" app/api/assessment/finish/route.ts` → 有结果 |
| 4 | 创建 `/api/practice/check` API | `curl -X POST http://localhost:3000/api/practice/check` → 返回 JSON |
| 5 | 修改 `app/assessment/result/page.tsx` | 页面根据 `learningPathId` 显示不同按钮 |
| 6 | 测试完整流程：测评 → 结果页 → 查看路径 | E2E 测试通过 |

### 依赖分析

**删除目标**：测评结果页的"一键生成学习路径"按钮逻辑

| 删除内容 | 使用位置 | 风险评估 |
|---------|----------|----------|
| `canGeneratePath && !pathGenerated` 条件 | `app/assessment/result/page.tsx` | ✅ 替换为 `learningPathId` 判断 |
| `pathGenerated` state | `app/assessment/result/page.tsx` | ✅ 不再需要 |

**新增内容**：

| 新增内容 | 位置 | 依赖 |
|---------|------|------|
| `learningPathId` 字段 | `AssessmentResultData` 接口 | finish API 返回 |
| `generateLearningPathInTransaction` 函数 | `lib/learning-path/auto-generate.ts` | prisma, priority 函数 |
| `/api/practice/check` 路由 | `app/api/practice/check/route.ts` | prisma, auto-generate |
