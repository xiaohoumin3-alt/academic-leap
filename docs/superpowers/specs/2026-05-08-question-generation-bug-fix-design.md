# 题目生成状态不一致Bug修复设计

**日期**: 2026-05-08
**状态**: 设计中
**优先级**: HIGH

## 问题描述

### 现象
1. **UI显示不一致**: 页面显示"共18题"但"关联题目(132)"
2. **无限循环生成**: 已生成132题还在继续生成，无法停止

### 根本原因
1. `checkComplete()` 只检查 `generationProgress` 字段，没有检查数据库实际题目数
2. UI显示"共X题"只计算本次生成进度，没有包含已有题目
3. Worker没有在生成前检查是否已有足够题目

## 设计方案

### 1. 后端修复：完成检查逻辑

**文件**: `lib/question-generation/state-helpers.ts`

**修改 `checkComplete()` 函数**，增加数据库实际题目数检查：

```typescript
export async function checkComplete(
  knowledgePointId: string,
  targetPerLevel: number,
  difficultyRange?: { min: number; max: number }
): Promise<boolean> {
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { generationProgress: true, generationStatus: true },
  })

  if (kp?.generationStatus === 'completed') return true

  // 新增：检查数据库中实际题目数量
  const actualCount = await prisma.question.count({
    where: { generatedFrom: knowledgePointId }
  })

  const minLevel = difficultyRange?.min ?? 1
  const maxLevel = difficultyRange?.max ?? 12
  const totalLevels = maxLevel - minLevel + 1
  const totalTarget = totalLevels * targetPerLevel

  // 如果实际题目数已达标，直接返回完成
  if (actualCount >= totalTarget) {
    return true
  }

  // 原有逻辑：检查generationProgress
  const progress = (kp?.generationProgress as Record<string, number>) || {}
  for (let level = minLevel; level <= maxLevel; level++) {
    const count = progress[String(level)] || 0
    if (count < targetPerLevel) {
      return false
    }
  }

  return true
}
```

### 2. Worker安全停止条件

**文件**: `lib/question-generation/worker.ts`

在 `generateQuestionsWorker()` 开始时增加检查：

```typescript
export async function generateQuestionsWorker(job: Job<WorkerJobData>): Promise<void> {
  const { knowledgePointId, difficultyRange, questionsPerLevel } = job.data

  // 新增：生成前检查是否已有足够题目
  const totalLevels = difficultyRange.max - difficultyRange.min + 1
  const totalTarget = totalLevels * questionsPerLevel

  const actualCount = await prisma.question.count({
    where: { generatedFrom: knowledgePointId }
  })

  if (actualCount >= totalTarget) {
    console.log(`[Worker] Knowledge point ${knowledgePointId} already has ${actualCount} questions, marking as completed`)
    await markCompleted(knowledgePointId)
    return
  }

  // 原有生成逻辑...
}
```

### 3. 前端UI显示修正

**文件**: `components/admin/KnowledgePointDetail.tsx`

修改第313行，使用API返回的 `actualQuestionCount`：

```tsx
// 修改前
共 {Object.values(genProgress).reduce((a, b) => a + b, 0)} 题

// 修改后 - 直接使用API返回的实际题目数
共 {questions.length} 题
```

或者从状态API获取 `actualQuestionCount` 字段。

## 验收标准

1. [ ] 当知识点已有足够题目时，生成任务自动停止
2. [ ] UI显示的"共X题"与数据库实际题目数一致
3. [ ] "关联题目(X)"显示数据库中的总题目数
4. [ ] 生成进度正确反映剩余需生成数量

## 风险评估

- **低风险**: 修改集中在状态检查逻辑
- **兼容性**: 不影响现有数据结构
- **性能**: 增加一次数据库count查询，影响可忽略
