# 分析页面统计数据修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复分析页面数据混乱问题：首次分数被覆盖、练习数据混入诊断测评、标签错误

**Architecture:** 前端直接使用 diagnosticAttempts[0] 获取首次分数；API 新增 training 专用统计字段；前端更新使用新字段

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `app/api/analytics/overview/route.ts` | 修改 | 新增 trainingQuestions, trainingCorrectRate, trainingMinutes 字段 |
| `components/AnalyzePage.tsx` | 修改 | 首次分数逻辑、使用新字段、更新标签、改标题 |

---

## Task 1: 修复首次分数逻辑

**Files:**
- Modify: `components/AnalyzePage.tsx` (line 128-146)

- [ ] **Step 1: 定位代码位置**

在 `components/AnalyzePage.tsx` 中找到 `getGrowthStoryData` 函数（第 128-146 行）。

- [ ] **Step 2: 修改首次分数计算逻辑**

将第 128-146 行的代码替换为：

```typescript
// 计算成长故事数据
const getGrowthStoryData = (overview: OverviewData['overview']) => {
  const diagnosticAttempts = overview?.diagnosticAttempts || [];

  // 首次测评分数：直接使用第一次诊断测评记录（不会被后续测试覆盖）
  const firstScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[0].score
    : null;

  // 最近测评分数
  const latestScore = diagnosticAttempts.length > 0
    ? diagnosticAttempts[diagnosticAttempts.length - 1].score
    : null;

  // 提升值
  const growth = (firstScore !== null && latestScore !== null && firstScore !== latestScore)
    ? latestScore - firstScore
    : null;

  return { firstScore, latestScore, growth };
};
```

- [ ] **Step 3: 修改标题**

将第 277 行的标题从"测评成长轨迹"改为"成长轨迹"：

找到：
```tsx
<h3 className="text-xl font-display font-black text-on-surface">测评成长轨迹</h3>
```

改为：
```tsx
<h3 className="text-xl font-display font-black text-on-surface">成长轨迹</h3>
```

- [ ] **Step 4: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: 提交**

```bash
git add components/AnalyzePage.tsx
git commit -m "fix: use first diagnostic attempt score for 'first' display

- Change to use diagnosticAttempts[0].score directly instead of initialAssessmentScore
- This prevents the 'first' score from being overwritten by retests
- Change title from '测评成长轨迹' to '成长轨迹'"
```

---

## Task 2: API 层新增练习专用统计

**Files:**
- Modify: `app/api/analytics/overview/route.ts`

- [ ] **Step 1: 定位代码位置**

在 `app/api/analytics/overview/route.ts` 中找到练习统计相关代码（第 164-233 行）。

- [ ] **Step 2: 获取 training 模式的 attempt IDs**

在第 177 行（trainingAttempts 查询之后）添加：

```typescript
// 获取练习模式 attempt IDs（用于统计练习专用数据）
const trainingAttemptIds = await prisma.attempt.findMany({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'training',
  },
  select: { id: true },
});

const trainingAttemptIdList = trainingAttemptIds.map((a) => a.id);
```

- [ ] **Step 3: 计算练习专用统计数据**

在第 233 行（correctRate 计算之后）添加：

```typescript
// 练习专用统计（只统计 training 模式）
const trainingQuestionsCount = trainingAttemptIdList.length > 0
  ? await prisma.attemptStep.count({
      where: { attemptId: { in: trainingAttemptIdList } },
    })
  : 0;

const trainingCorrectStepsCount = trainingAttemptIdList.length > 0
  ? await prisma.attemptStep.count({
      where: {
        attemptId: { in: trainingAttemptIdList },
        isCorrect: true,
      },
    })
  : 0;

const trainingCorrectRate = trainingQuestionsCount > 0
  ? Math.round((trainingCorrectStepsCount / trainingQuestionsCount) * 100)
  : 0;

const trainingDuration = await prisma.attempt.aggregate({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'training',
  },
  _sum: { duration: true },
});

const trainingMinutes = Math.floor((trainingDuration._sum.duration || 0) / 60);
```

- [ ] **Step 4: 更新 API 响应**

在第 257 行（trainingAvgScore 字段之后）添加新字段：

找到：
```typescript
trainingAvgScore,
trainingCount: trainingAttempts.length,
```

改为：
```typescript
trainingAvgScore,
trainingCount: trainingAttempts.length,
// 练习专用统计
trainingQuestions: trainingQuestionsCount,
trainingCorrectRate,
trainingMinutes,
```

- [ ] **Step 5: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 6: 提交**

```bash
git add app/api/analytics/overview/route.ts
git commit -m "feat: add training-specific statistics to overview API

- Add trainingQuestions, trainingCorrectRate, trainingMinutes
- These fields only count mode='training' attempts
- Keeps diagnostic data separate from practice data"
```

---

## Task 3: 前端使用新的练习统计字段

**Files:**
- Modify: `components/AnalyzePage.tsx`

- [ ] **Step 1: 更新接口类型定义**

在第 56-63 行的 `OverviewInner` 接口中添加新字段：

找到：
```typescript
interface OverviewInner {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  lowestScore: number;
  totalMinutes: number;
  completionRate: number;
  // ...
  trainingAvgScore: number;
  trainingCount: number;
}
```

改为：
```typescript
interface OverviewInner {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  lowestScore: number;
  totalMinutes: number;
  completionRate: number;
  // ...
  trainingAvgScore: number;
  trainingCount: number;
  // 练习专用统计
  trainingQuestions: number;
  trainingCorrectRate: number;
  trainingMinutes: number;
}
```

- [ ] **Step 2: 更新 getPracticeStats 函数**

在第 149-155 行，修改 `getPracticeStats` 函数：

找到：
```typescript
const getPracticeStats = (overview: OverviewData['overview']) => {
  return {
    avgScore: overview?.trainingAvgScore || 0,
    totalQuestions: overview?.totalQuestions || 0,
    totalMinutes: overview?.totalMinutes || 0,
  };
};
```

改为：
```typescript
const getPracticeStats = (overview: OverviewData['overview']) => {
  return {
    avgScore: overview?.trainingAvgScore || 0,
    correctRate: overview?.trainingCorrectRate || 0,
    totalQuestions: overview?.trainingQuestions || 0,
    totalMinutes: overview?.trainingMinutes || 0,
  };
};
```

- [ ] **Step 3: 更新显示标签和内容**

在第 343-365 行，更新练习状态卡片的显示：

找到：
```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {(() => {
        const stats = getPracticeStats(overview?.overview);
        return stats.avgScore > 0 ? stats.avgScore : '-';
      })()}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">正确率</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {overview?.overview?.totalQuestions || 0}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {overview?.overview?.totalMinutes || 0}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
  </div>
</div>
```

改为：
```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {(() => {
        const stats = getPracticeStats(overview?.overview);
        return stats.correctRate > 0 ? stats.correctRate + '%' : '-';
      })()}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">正确率</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {(() => {
        const stats = getPracticeStats(overview?.overview);
        return stats.totalQuestions > 0 ? stats.totalQuestions : '-';
      })()}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {(() => {
        const stats = getPracticeStats(overview?.overview);
        return stats.totalMinutes > 0 ? stats.totalMinutes : '-';
      })()}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
  </div>
</div>
```

- [ ] **Step 4: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: 提交**

```bash
git add components/AnalyzePage.tsx
git commit -m "fix: use training-specific statistics in practice stats card

- Use trainingQuestions, trainingCorrectRate, trainingMinutes
- Display correctRate with % instead of avgScore
- Show '-' when no data instead of '0'"
```

---

## Task 4: 验证改动

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/seanxx/academic-leap/academic-leap && pnpm dev`

- [ ] **Step 2: 手动测试首次分数逻辑**

1. 访问 `/analyze` 页面
2. 确认"首次"分数显示第一次诊断测评的分数
3. 重新完成诊断测评后，确认"首次"分数保持不变
4. 确认"最近"分数显示最新的测评分数

- [ ] **Step 3: 手动测试练习统计**

1. 确认只做了诊断测评时，练习状态显示 `-`（不是 93 或其他数字）
2. 完成几次练习后，确认总题数、正确率、分钟数只统计练习模式
3. 确认诊断测评的题目不计入练习统计

- [ ] **Step 4: 检查控制台**

打开浏览器控制台，确认没有错误信息

- [ ] **Step 5: 测试边界情况**

1. 无练习数据时显示 `-`
2. 只有诊断测评时练习统计为 `-`
3. 数据为 0 时显示 `-` 而不是 `0`

---

## 验收清单

- [ ] "首次"分数始终显示第一次诊断测评的分数
- [ ] 重新测评后"首次"分数不变
- [ ] "最近"分数显示最新一次诊断测评分数
- [ ] 标题改为"成长轨迹"
- [ ] 练习统计只包含 `mode='training'` 的数据
- [ ] 诊断测评数据不计入练习统计
- [ ] 标签与显示内容一致（"正确率"显示正确率带 %）
- [ ] 无练习数据时显示 `-`
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误
