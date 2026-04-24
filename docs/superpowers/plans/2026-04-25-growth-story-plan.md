# 分析页成长故事重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构分析页"成长故事"模块，测评数据与练习数据分离展示

**Architecture:** 扩展 overview API 返回 diagnostic attempts 列表，前端按 mode 过滤分别展示

**Tech Stack:** Next.js, Prisma, React, TypeScript

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `app/api/analytics/overview/route.ts` | 修改 | 增加 diagnosticAttempts 数组返回 |
| `components/AnalyzePage.tsx` | 修改 | 改造成长故事卡片 + 新增练习统计卡片 |
| `lib/api.ts` | 修改 | OverviewResponse 类型增加新字段 |

---

## Task 1: 扩展 Overview API 返回 Diagnostic Attempts

**Files:**
- Modify: `app/api/analytics/overview/route.ts` (在第 145-170 行之间添加)
- Modify: `lib/api.ts` (在 OverviewResponse 接口中添加新字段)

- [ ] **Step 1: 在 overview API 中添加 diagnostic attempts 查询**

在 `app/api/analytics/overview/route.ts` 中，在 `// 获取用户初始测评状态` 之后（约第 136 行）添加：

```typescript
// 获取诊断测评记录（按时间排序）
const diagnosticAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    completedAt: { not: null },
    score: { gt: 0 },
    mode: 'diagnostic',
  },
  select: {
    id: true,
    score: true,
    completedAt: true,
  },
  orderBy: { completedAt: 'asc' },
});

// 获取练习记录统计（只统计 training 模式）
const trainingAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    completedAt: { not: null },
    score: { gt: 0 },
    mode: 'training',
  },
  select: { score: true },
});

const trainingAvgScore = trainingAttempts.length > 0
  ? Math.round(trainingAttempts.reduce((sum: number, a: { score: number }) => sum + a.score, 0) / trainingAttempts.length)
  : 0;
```

- [ ] **Step 2: 在 overview 返回值中添加新字段**

在 return 语句的 overview 对象中（约第 205 行），添加：

```typescript
return NextResponse.json({
  overview: {
    // ... 现有字段保持不变 ...
    totalAttempts,
    completedAttempts,
    averageScore: Math.round(averageScore),  // 保持混合平均分（向下兼容）
    lowestScore: Math.round(lowestScore),
    // ... 其他现有字段 ...

    // 新增字段
    initialAssessmentScore: user?.initialAssessmentScore ?? 0,
    diagnosticAttempts: diagnosticAttempts.map((a) => ({
      id: a.id,
      score: a.score,
      completedAt: a.completedAt?.toISOString(),
    })),
    trainingAvgScore,
    trainingCount: trainingAttempts.length,
  },
  // ... 其他返回值 ...
});
```

- [ ] **Step 3: 更新 lib/api.ts 中的类型定义**

在 `lib/api.ts` 的 `OverviewResponse` 接口中添加：

```typescript
interface DiagnosticAttempt {
  id: string;
  score: number;
  completedAt: string;
}

interface OverviewResponse {
  overview: {
    // ... 现有字段 ...
    totalAttempts: number;
    averageScore: number;
    initialAssessmentScore: number;
    // 新增
    diagnosticAttempts: DiagnosticAttempt[];
    trainingAvgScore: number;
    trainingCount: number;
    // ... 其他现有字段 ...
  };
  dailyData: Array<{ date: string; count: number; avgScore: number }>;
  topKnowledge: Array<{ knowledgePoint: string; mastery: number }>;
}
```

- [ ] **Step 4: 验证 API 返回**

Run: `curl -H "Cookie: $(cat ~/.next-auth-cookie 2>/dev/null || echo '')" http://localhost:3000/api/analytics/overview | jq '.overview | {initialAssessmentScore, diagnosticAttempts, trainingAvgScore, trainingCount}'`

Expected: 返回 diagnosticAttempts 数组和 training 统计

---

## Task 2: 重构 AnalyzePage 成长故事模块

**Files:**
- Modify: `components/AnalyzePage.tsx` (第 199-266 行)

- [ ] **Step 1: 更新类型定义**

在 `OverviewInner` 接口中添加新字段：

```typescript
interface DiagnosticAttempt {
  id: string;
  score: number;
  completedAt: string;
}

interface OverviewInner {
  // ... 现有字段 ...
  initialAssessmentScore: number;
  // 新增
  diagnosticAttempts: DiagnosticAttempt[];
  trainingAvgScore: number;
  trainingCount: number;
}
```

- [ ] **Step 2: 添加练习统计数据计算**

在 `loadAnalytics` 函数之后添加辅助函数：

```typescript
// 计算成长故事数据
const getGrowthStoryData = (overview: OverviewData['overview']) => {
  const diagnosticAttempts = overview?.diagnosticAttempts || [];

  // 首次测评分数
  const firstScore = overview?.initialAssessmentScore ||
    (diagnosticAttempts.length > 0 ? diagnosticAttempts[0].score : null);

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

// 计算练习统计数据
const getPracticeStats = (overview: OverviewData['overview']) => {
  return {
    avgScore: overview?.trainingAvgScore || 0,
    totalQuestions: overview?.totalQuestions || 0,
    totalMinutes: overview?.totalMinutes || 0,
    practiceCount: overview?.trainingCount || 0,
  };
};
```

- [ ] **Step 3: 替换"成绩提升"卡片**

找到现有的"成绩提升"卡片代码（约第 239-266 行），替换为：

```typescript
{/* 成长故事（测评） */}
<section className="bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden ambient-shadow">
  <div className="absolute -right-8 -top-8 w-40 h-40 bg-gradient-to-br from-primary/10 to-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

  {(() => {
    const { firstScore, latestScore, growth } = getGrowthStoryData(overview?.overview);
    const hasData = firstScore !== null && latestScore !== null;

    return (
      <>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h3 className="text-xl font-display font-black text-on-surface">测评成长轨迹</h3>
          <span className="text-[10px] px-3 py-1 bg-warning-container text-on-warning-container rounded-full font-bold">
            真实水平
          </span>
        </div>

        {!hasData ? (
          <div className="text-center py-8">
            <p className="text-on-surface-variant">完成诊断测评后查看成长轨迹</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-6 mb-6 relative z-10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase mb-1">首次</p>
                <p className="text-3xl font-display font-black text-on-surface-variant">{firstScore}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-12 h-0.5 bg-surface-variant"></div>
                <MaterialIcon icon="chevron_right" className="text-outline-variant" style={{ fontSize: '20px' }} />
                <div className="w-12 h-0.5 bg-surface-variant"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-primary uppercase mb-1">最近</p>
                <p className="text-4xl font-display font-black text-primary">{latestScore}</p>
              </div>
            </div>

            {growth !== null && growth !== 0 && (
              <div className="flex items-center justify-center gap-2 relative z-10">
                <div className={`flex items-center gap-1 px-4 py-2 rounded-full ${
                  growth > 0 ? 'bg-success/20' : 'bg-error/20'
                }`}>
                  <MaterialIcon
                    icon={growth > 0 ? 'trending_up' : 'trending_down'}
                    className={growth > 0 ? 'text-success' : 'text-error'}
                    style={{ fontSize: '18px' }}
                  />
                  <span className={`text-base font-display font-black ${
                    growth > 0 ? 'text-success' : 'text-error'
                  }`}>
                    {growth > 0 ? '+' : ''}{growth}分
                  </span>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-on-surface-variant mt-4">
              测评分数对比 · 真实反映学习进步
            </p>
          </>
        )}
      </>
    );
  })()}
</section>
```

- [ ] **Step 4: 添加"练习统计"卡片**

在"成长故事"卡片之后、"数据可信度"卡片之前添加：

```typescript
{/* 练习统计 */}
<section className="bg-surface-container-lowest rounded-[2rem] p-8">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-xl font-display font-black text-on-surface">练习状态</h3>
    <span className="text-[10px] px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-bold">
      日常巩固
    </span>
  </div>

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
</section>
```

- [ ] **Step 5: 删除旧的 averageScore 引用**

删除或注释掉之前用于计算 currentScore 的 averageScore 相关代码（约第 199-202 行），因为现在用 diagnosticAttempts 计算成长数据。

---

## Task 3: 验证改动

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/seanxx/academic-leap/academic-leap && pnpm dev`

- [ ] **Step 2: 测试 API 返回**

检查 `/api/analytics/overview` 返回的 `diagnosticAttempts` 和 `trainingAvgScore` 字段

- [ ] **Step 3: 手动测试页面**

1. 访问分析页
2. 确认"成长故事"卡片只显示测评数据
3. 确认"练习统计"卡片显示练习数据
4. 确认没有混淆测评和练习分数

---

## 验收清单

- [ ] Overview API 返回 `diagnosticAttempts` 数组
- [ ] Overview API 返回 `trainingAvgScore` 和 `trainingCount`
- [ ] 成长故事卡片只展示测评分数
- [ ] 练习统计卡片展示正确率、题数、时长
- [ ] 提升值计算正确（测评 vs 测评）
- [ ] 页面渲染正常，无 TypeScript 错误
- [ ] API 请求成功，无 console.error

---

## 改动总结

| 改动点 | 文件 | 工作量 |
|--------|------|--------|
| API 扩展 | `overview/route.ts` | 小 |
| 类型更新 | `lib/api.ts` | 微 |
| UI 重构 | `AnalyzePage.tsx` | 中 |
| 测试验证 | - | 微 |
