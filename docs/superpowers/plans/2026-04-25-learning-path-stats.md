# 学习路径统计改进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改进学习路径概览中的"本周学习"统计，改为"本周练习知识点"，使用自然周和更准确的数据口径

**Architecture:** 修改 API 层的统计逻辑，查询本周完成的练习及其题目步骤，统计答题次数>=3的唯一知识点数量

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `app/api/learning-path/route.ts` | 修改 | 改进本周统计逻辑：自然周 + 知识点统计 |
| `components/LearningPathOverview.tsx` | 修改 | 更新显示标签和字段名 |

---

## Task 1: 修改 API 统计逻辑

**Files:**
- Modify: `app/api/learning-path/route.ts`

- [ ] **Step 1: 定位原统计代码位置**

在 `app/api/learning-path/route.ts` 中找到第 196-229 行的 `// 7. Calculate weekly summary` 部分。

原代码：
```typescript
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const recentAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    startedAt: {
      gte: sevenDaysAgo,
    },
  },
  select: {
    startedAt: true,
  },
});

const practicedCount = recentAttempts.length;
```

- [ ] **Step 2: 替换为自然周计算逻辑**

将第 196-213 行替换为：

```typescript
// 7. Calculate weekly summary

// 计算本周一 00:00:00（自然周开始）
const now = new Date();
const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
const startOfWeek = new Date(now);
// 如果是周日(0)，往前推6天到周一；否则减去(dayOfWeek-1)天到周一
startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
startOfWeek.setHours(0, 0, 0, 0);

// 查询本周完成的练习及其题目步骤
const recentAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    startedAt: {
      gte: startOfWeek,
    },
    // 只统计完成的练习
    status: 'completed',
  },
  include: {
    steps: {
      include: {
        questionStep: {
          include: {
            question: {
              select: {
                knowledgePoints: true,
              },
            },
          },
        },
      },
    },
  },
});

// 统计每个知识点的答题次数
const knowledgePointPracticeCount = new Map<string, number>();
for (const attempt of recentAttempts) {
  for (const step of attempt.steps) {
    if (step.questionStep?.question) {
      try {
        const kps = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
        for (const kp of kps) {
          knowledgePointPracticeCount.set(
            kp,
            (knowledgePointPracticeCount.get(kp) || 0) + 1
          );
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
}

// 筛选答题次数 >= 3 的知识点，返回唯一数量
const practicedKnowledgePoints = Array.from(knowledgePointPracticeCount.entries())
  .filter(([_, count]) => count >= 3)
  .map(([kp]) => kp);

const practicedCount = new Set(practicedKnowledgePoints).size;
```

- [ ] **Step 3: 更新 API 响应字段名**

将第 225-229 行的 `weeklySummary` 对象中的字段名从 `practicedCount` 改为 `practicedKnowledgePoints`：

```typescript
const weeklySummary = {
  practicedKnowledgePoints: practicedCount,  // 本周练习的知识点数
  masteredCount,
  weakCount,
};
```

- [ ] **Step 4: 更新 debug 日志**

将第 234-240 行的 debug 日志更新为：

```typescript
console.log('[learning-path] Response:', {
  userId,
  roadmapLength: roadmap.length,
  completedCount: masteredCount,
  practicedKnowledgePoints: practicedCount,  // 新字段
  roadmapItems: roadmap.map(r => ({ name: r.name, status: r.status, mastery: r.mastery }))
});
```

- [ ] **Step 5: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

---

## Task 2: 更新前端显示

**Files:**
- Modify: `components/LearningPathOverview.tsx`

- [ ] **Step 1: 更新接口类型定义**

在 `components/LearningPathOverview.tsx` 中找到第 21-25 行的 `WeeklySummary` 接口：

将：
```typescript
interface WeeklySummary {
  practicedCount: number;
  masteredCount: number;
  weakCount: number;
}
```

改为：
```typescript
interface WeeklySummary {
  practicedKnowledgePoints: number;
  masteredCount: number;
  weakCount: number;
}
```

- [ ] **Step 2: 更新显示标签和字段名**

将第 180-182 行：
```tsx
<p className="text-2xl font-bold text-primary">{weeklySummary.practicedCount}</p>
<p className="text-xs text-on-surface-variant">本周练习</p>
```

改为：
```tsx
<p className="text-2xl font-bold text-primary">{weeklySummary.practicedKnowledgePoints}</p>
<p className="text-xs text-on-surface-variant">本周练习知识点</p>
```

- [ ] **Step 3: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

---

## Task 3: 验证改动

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/seanxx/academic-leap/academic-leap && pnpm dev`

- [ ] **Step 2: 手动测试统计逻辑**

1. 访问 `/me` 页面
2. 确认"本周练习知识点"显示正确
3. 在数据库中验证：
   - 本周有完成练习且某知识点答题>=3次，应该计入
   - 本周答题<3次的知识点，不应该计入
   - 上周的练习，不应该计入
   - 未完成的练习，不应该计入

- [ ] **Step 3: 检查控制台日志**

打开浏览器控制台，确认 `[learning-path] Response:` 日志中包含 `practicedKnowledgePoints` 字段

- [ ] **Step 4: 测试边界情况**

1. 本周没有练习 → 应显示 0
2. 本周有练习但答题都<3次 → 应显示 0
3. 周一早上测试 → 应只统计周一的练习

---

## 验收清单

- [ ] 标签改为"本周练习知识点"
- [ ] 使用自然周（周一到周日）计算
- [ ] 只统计完成的练习
- [ ] 只统计答题次数 >= 3 的知识点
- [ ] 同一知识点只计数一次
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误
