# 分析页面数据分类修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复分析页面数据分类混乱问题：上段显示 diagnostic 数据，下段显示 training 数据，新增"知识练习分布"

**Architecture:** API 新增 diagnostic 专用统计字段；前端重构为上下两段布局；新增 training 知识点数据

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL

---

## 文件改动清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `app/api/analytics/overview/route.ts` | 修改 | 新增 diagnostic 专用统计字段 |
| `components/AnalyzePage.tsx` | 修改 | 重构布局为上下两段，更新字段引用 |

---

## Task 1: API 层新增 diagnostic 专用统计

**Files:**
- Modify: `app/api/analytics/overview/route.ts`

- [ ] **Step 1: 定位代码位置**

找到 `totalAttempts` 定义位置（约第 17 行）。

- [ ] **Step 2: 添加 diagnostic 专用统计**

在 `totalAttempts` 定义之后（约第 19 行）添加：

```typescript
// ============ 诊断测评专用统计 ============
// 获取诊断测评次数（用于数据可信度和波动范围）
const diagnosticAttemptsCount = await prisma.attempt.count({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'diagnostic',
  },
});

// 计算诊断测评数据可信度（根据诊断测评次数）
const diagnosticDataReliability =
  diagnosticAttemptsCount >= 3 ? "high"
  : diagnosticAttemptsCount >= 2 ? "medium" : "low";

// 获取诊断测评分数（用于波动范围计算）
const diagnosticAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'diagnostic',
  },
  select: { score: true },
  orderBy: { createdAt: 'desc' },
  take: 5,
});

// 计算诊断测评波动范围
const diagnosticScores = diagnosticAttempts.map(a => a.score);
let diagnosticVolatilityRange = 0;
if (diagnosticScores.length > 1) {
  const mean = diagnosticScores.reduce((a, b) => a + b, 0) / diagnosticScores.length;
  diagnosticVolatilityRange = Math.round(
    Math.sqrt(
      diagnosticScores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / diagnosticScores.length
    )
  );
}
```

- [ ] **Step 3: 更新 API 响应**

找到 API 响应中的 `dataReliability` 和 `volatilityRange` 字段（约第 289-290 行），在其后添加：

```typescript
// 诊断测评专用统计
diagnosticAttemptsCount,
diagnosticDataReliability,
diagnosticVolatilityRange,
```

- [ ] **Step 4: 获取 training 知识点数据**

找到获取知识点数据的代码（需要查看完整文件），添加 training 模式的知识掌握数据：

```typescript
// 获取练习知识点掌握情况（training 模式）
const trainingKnowledgeMastery = await prisma.attemptStep.findMany({
  where: {
    attempt: {
      userId,
      mode: 'training',
      completedAt: { not: null },
    },
  },
  include: {
    question: {
      include: {
        knowledgePoints: {
          select: { id: true, name: true },
        },
      },
    },
    isCorrect: true,
  },
});

// 按知识点聚合
const trainingKpMap = new Map<string, { correct: number; total: number; name: string }>();
for (const step of trainingKnowledgeMastery) {
  for (const kp of step.question.knowledgePoints) {
    const existing = trainingKpMap.get(kp.id) || { correct: 0, total: 0, name: kp.name };
    existing.total += 1;
    if (step.isCorrect) existing.correct += 1;
    trainingKpMap.set(kp.id, existing);
  }
}

const trainingKnowledgeMasteryData = Array.from(trainingKpMap.values()).map(kp => ({
  knowledgePoint: kp.name,
  mastery: kp.total > 0 ? Math.round((kp.correct / kp.total) * 100) : 0,
  recentAccuracy: kp.total > 0 ? Math.round((kp.correct / kp.total) * 100) : 0,
  status: kp.total > 0 ? (kp.correct / kp.total >= 0.8 ? 'high' : kp.correct / kp.total >= 0.5 ? 'medium' : 'low') : 'pending',
}));
```

- [ ] **Step 5: 添加到响应**

在 API 响应中添加 `trainingKnowledgeMastery` 字段。

- [ ] **Step 6: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 7: 提交**

```bash
git add app/api/analytics/overview/route.ts
git commit -m "feat: add diagnostic-specific statistics to overview API

- Add diagnosticAttemptsCount, diagnosticDataReliability, diagnosticVolatilityRange
- Add trainingKnowledgeMastery for practice knowledge distribution
- Separate diagnostic and training data"
```

---

## Task 2: 前端布局重构为上下两段

**Files:**
- Modify: `components/AnalyzePage.tsx`

- [ ] **Step 1: 定位现有布局位置**

当前布局顺序（从第 273 行开始）：
1. 成长轨迹 (第 273 行)
2. 练习状态 (第 341 行)
3. 数据可信度 + 波动范围 (第 380 行)
4. 知识掌握矩阵 (第 405 行)
5. 本周练习趋势
6. AI 学习建议

- [ ] **Step 2: 修改数据可信度字段引用**

找到第 388-391 行：
```tsx
{overview?.overview?.dataReliability === 'high' ? '高'
 : overview?.overview?.dataReliability === 'medium' ? '中'
 : overview?.overview?.dataReliability ? '低' : '-'}
{overview?.overview?.dataReliability && ` (${overview.overview.totalAttempts}次练习)`}
```

改为：
```tsx
{overview?.overview?.diagnosticDataReliability === 'high' ? '高'
 : overview?.overview?.diagnosticDataReliability === 'medium' ? '中'
 : overview?.overview?.diagnosticDataReliability ? '低' : '-'}
{overview?.overview?.diagnosticAttemptsCount && ` (${overview.overview.diagnosticAttemptsCount}次诊断测评)`}
```

- [ ] **Step 3: 修改波动范围字段引用**

找到第 399-401 行：
```tsx
±{overview?.overview?.volatilityRange ?? '-'} 分
```

改为：
```tsx
±{overview?.overview?.diagnosticVolatilityRange ?? '-'} 分
```

- [ ] **Step 4: 重构 JSX 布局**

找到 `</section>` 包裹的位置，将整个内容重构为上下两段。

**新布局结构：**

```tsx
{/* 上段：诊断测评数据 */}
<section className="space-y-6">
  {/* 成长轨迹 */}
  <section className="bg-surface-container-lowest rounded-[2rem] p-8 relative overflow-hidden ambient-shadow">
    {/* ... 现有成长轨迹代码 (第 273-338 行) ... */}
  </section>

  {/* 数据可信度和波动范围 */}
  <section className="grid grid-cols-2 gap-6">
    {/* ... 现有代码 (第 382-403 行) ... */}
  </section>

  {/* 知识掌握矩阵 */}
  <section className="space-y-4">
    {/* ... 现有代码 (第 405 行起) ... */}
  </section>
</section>

{/* 下段：练习数据 */}
<section className="space-y-6">
  {/* 练习状态 */}
  <section className="bg-surface-container-lowest rounded-[2rem] p-8">
    {/* ... 现有练习状态代码 (第 341-378 行) ... */}
  </section>

  {/* 本周练习趋势 */}
  <section className="bg-surface-container-lowest rounded-[2rem] p-8">
    {/* ... 现有本周练习趋势代码 ... */}
  </section>

  {/* 知识练习分布（新增） */}
  <section className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-display font-black text-on-surface">知识练习分布</h3>
      <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
    </div>
    {/* 使用 trainingKnowledgeMastery 数据，复制知识掌握矩阵的 UI */}
  </section>

  {/* AI 学习建议 */}
  <section className="bg-surface-container-lowest rounded-[2rem] p-8">
    {/* ... 现有 AI 学习建议代码 ... */}
  </section>
</section>
```

- [ ] **Step 5: 添加知识练习分布组件**

在"本周练习趋势"和"AI 学习建议"之间添加：

```tsx
{/* 知识练习分布（新增） */}
<section className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-xl font-display font-black text-on-surface">知识练习分布</h3>
    <span className="text-xs font-bold text-on-surface-variant">点击查看详情</span>
  </div>

  {/* 空数据状态 */}
  {(!trainingKnowledgeData || trainingKnowledgeData.length === 0) ? (
    <div className="bg-surface-container-low rounded-3xl p-6 text-center">
      <MaterialIcon icon="school" className="text-on-surface-variant mx-auto mb-2" style={{ fontSize: '48px' }} />
      <p className="text-on-surface-variant">开始练习后将显示知识点掌握情况</p>
    </div>
  ) : (
    <>
      <div className="bg-surface-container-low rounded-3xl p-6">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trainingKnowledgeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="knowledgePoint" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, '掌握度']}
                contentStyle={{ borderRadius: '12px', border: 'none' }}
              />
              <Bar
                dataKey="mastery"
                fill="var(--color-secondary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Knowledge Items */}
      <div className="grid grid-cols-2 gap-3">
        {trainingKnowledgeData.map((item, index) => (
          <motion.button
            key={item.knowledgePoint}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedTrainingModule?.(item)}
            className={cn(
              "p-4 rounded-2xl text-left transition-all",
              selectedTrainingModule?.knowledgePoint === item.knowledgePoint
                ? "bg-secondary-container text-on-secondary-container scale-105"
                : "bg-surface-container hover:bg-surface-container-high"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">{item.knowledgePoint}</span>
              <span className="text-lg font-display font-black">{item.mastery}%</span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-1.5">
              <div
                className="bg-secondary rounded-full h-1.5"
                style={{ width: `${item.mastery}%` }}
              />
            </div>
          </motion.button>
        ))}
      </div>
    </>
  )}
</section>
```

- [ ] **Step 6: 添加 training 知识点数据状态**

在组件顶部添加新的 state：

```typescript
const [trainingKnowledgeData, setTrainingKnowledgeData] = useState<KnowledgeData[]>([]);
```

在数据获取部分添加 trainingKnowledgeMastery 的处理逻辑。

- [ ] **Step 7: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 8: 提交**

```bash
git add components/AnalyzePage.tsx
git commit -m "refactor: reorganize analyze page into diagnostic and training sections

- Move practice stats below practice trends
- Update dataReliability and volatilityRange to use diagnostic-specific fields
- Add training knowledge mastery data
- Add knowledge practice distribution section"
```

---

## Task 3: 验证改动

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/seanxx/academic-leap/academic-leap && pnpm dev`

- [ ] **Step 2: 类型检查**

Run: `pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 3: 检查 API 响应**

访问 `/api/analytics/overview`，确认新增字段存在：
- `diagnosticAttemptsCount`
- `diagnosticDataReliability`
- `diagnosticVolatilityRange`
- `trainingKnowledgeMastery`

- [ ] **Step 4: 手动测试布局**

1. 确认上段只显示诊断测评数据
2. 确认下段只显示练习数据
3. 确认"知识练习分布"正确显示

---

## 验收清单

- [ ] 上段只显示 diagnostic 模式数据
- [ ] 下段只显示 training 模式数据
- [ ] 数据可信度显示诊断测评次数（"次诊断测评"）
- [ ] 波动范围基于诊断测评分数
- [ ] 新增"知识练习分布"组件（复制知识掌握矩阵 UI）
- [ ] 布局分为上下两段
- [ ] 无 TypeScript 错误
- [ ] 无控制台错误