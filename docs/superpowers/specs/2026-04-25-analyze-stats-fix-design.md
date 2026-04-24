# 分析页面统计数据修复设计

## 背景

分析页面"练习状态"卡片显示数据混乱：
- 总题数 93：实际包含诊断测评的题目（不应计入）
- 正确率 100：显示的是 `trainingAvgScore`（平均分），标签误导
- 分钟 0：数据为空但显示不友好

## 根因分析

### API层 (`app/api/analytics/overview/route.ts`)

1. **`totalQuestions` 计算 (line 220-224)**
   - 统计所有已完成 attempt 的 steps
   - 没有按 `mode` 过滤，导致诊断测评题目被计入

2. **`correctRate` 计算 (line 226-233)**
   - 同样统计所有已完成 attempt 的正确率
   - 计算了但前端没有使用

3. **`trainingAvgScore` 计算 (line 164-177)**
   - 正确按 `mode='training'` 过滤
   - 但前端将其显示为"正确率"（标签错误）

### 前端层 (`components/AnalyzePage.tsx`)

1. **"正确率"显示 (line 346-351)**
   - 显示 `trainingAvgScore`（练习平均分）
   - 标签写的是"正确率"（应改为"平均分"或显示真正的正确率）

## 修复目标

### 数据分离原则

| 指标 | 诊断测评 (diagnostic) | 练习 (training) |
|------|----------------------|----------------|
| 首次/最近分数 | ✓ 使用 | - |
| 总题数 | ✗ 不计入 | ✓ 只计 training |
| 正确率 | ✗ 不计入 | ✓ 只计 training |
| 练习时长 | ✗ 不计入 | ✓ 只计 training |
| 练习次数 | ✗ 不计入 | ✓ 只计 training |

### 修复内容

#### 1. API层修改

**新增字段：练习专用统计**
```typescript
// 只统计 mode='training' 的 attempt
const trainingAttemptIds = await prisma.attempt.findMany({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'training',
  },
  select: { id: true },
});

const trainingAttemptIdList = trainingAttemptIds.map(a => a.id);

// 练习总题数
const trainingQuestionsCount = await prisma.attemptStep.count({
  where: { attemptId: { in: trainingAttemptIdList } },
});

// 练习正确率
const trainingCorrectStepsCount = await prisma.attemptStep.count({
  where: {
    attemptId: { in: trainingAttemptIdList },
    isCorrect: true,
  },
});

const trainingCorrectRate = trainingQuestionsCount > 0
  ? Math.round((trainingCorrectStepsCount / trainingQuestionsCount) * 100)
  : 0;

// 练习时长
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

**API响应更新：**
```typescript
return NextResponse.json({
  overview: {
    // ... 现有字段
    // 新增：练习专用统计
    trainingQuestions: trainingQuestionsCount,
    trainingCorrectRate,
    trainingMinutes,
    // 保留原字段用于"我的"页面（包含所有模式）
    totalQuestions: allStepsCount,
    correctRate,
    totalMinutes,
  },
  // ...
});
```

#### 2. 前端修改

**AnalyzePage.tsx**

1. **更新接口类型 (line 56-63)**
```typescript
interface OverviewInner {
  // ... 现有字段
  // 新增练习专用字段
  trainingQuestions: number;
  trainingCorrectRate: number;
  trainingMinutes: number;
  // 保留原有字段
  totalQuestions: number;
  correctRate: number;
  totalMinutes: number;
}
```

2. **更新 `getPracticeStats` 函数 (line 149-155)**
```typescript
const getPracticeStats = (overview: OverviewData['overview']) => {
  return {
    avgScore: overview?.trainingAvgScore || 0,      // 练习平均分
    correctRate: overview?.trainingCorrectRate || 0, // 练习正确率（新增）
    totalQuestions: overview?.trainingQuestions || 0, // 练习总题数
    totalMinutes: overview?.trainingMinutes || 0,    // 练习时长
  };
};
```

3. **更新显示 (line 343-365)**
```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.avgScore > 0 ? stats.avgScore : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">平均分</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.totalQuestions > 0 ? stats.totalQuestions : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.totalMinutes > 0 ? stats.totalMinutes : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
  </div>
</div>
```

或者，如果用户想要显示正确率而不是平均分：
```tsx
<div className="grid grid-cols-3 gap-4">
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.correctRate > 0 ? stats.correctRate + '%' : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">正确率</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.totalQuestions > 0 ? stats.totalQuestions : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">总题数</p>
  </div>
  <div className="text-center p-4 bg-surface-container rounded-2xl">
    <p className="text-2xl font-display font-black text-secondary">
      {stats.totalMinutes > 0 ? stats.totalMinutes : '-'}
    </p>
    <p className="text-[10px] text-on-surface-variant mt-1">分钟</p>
  </div>
</div>
```

## 边界情况处理

1. **没有练习数据时**
   - 所有数值显示 `-` 而不是 `0`
   - 添加提示："开始练习后查看统计数据"

2. **只有诊断测评时**
   - 练习状态卡片显示空状态或 `-`
   - 不计入诊断测评数据

## 验收标准

- [ ] 练习统计只包含 `mode='training'` 的数据
- [ ] 诊断测评数据不计入练习统计
- [ ] 标签与显示内容一致（"正确率"显示正确率，"平均分"显示平均分）
- [ ] 无练习数据时显示 `-`
- [ ] 无 TypeScript 错误
