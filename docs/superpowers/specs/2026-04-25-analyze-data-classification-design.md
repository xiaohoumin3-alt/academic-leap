# 分析页面数据分类修复设计

## 背景

分析页面存在数据分类混乱问题：
- "练习状态"使用 training 专用字段（显示0）
- "数据可信度"、"波动范围"使用混合数据（显示4次练习）
- 上下布局不符合数据语义分组

## 修复目标

### 数据分类原则

| 指标 | 统计模式 | 说明 |
|------|---------|------|
| 成长轨迹 | diagnostic | 诊断测评分数变化 |
| 数据可信度 | diagnostic | 基于诊断测评次数 |
| 波动范围 | diagnostic | 基于诊断测评分数 |
| 知识掌握矩阵 | diagnostic | 诊断测评涉及的知识点 |
| 练习状态 | training | 练习数据统计 |
| 本周练习趋势 | training | 练习模式的学习趋势 |
| 知识练习分布 | training | 练习涉及的知识点 |
| AI 学习建议 | training | 基于练习数据的建议 |

### 布局调整

**上段 - 诊断测评数据（diagnostic 模式）**
1. 成长轨迹
2. 数据可信度
3. 波动范围
4. 知识掌握矩阵

**下段 - 练习数据（training 模式）**
1. 练习状态
2. 本周练习趋势
3. 知识练习分布（新增）
4. AI 学习建议

---

## 实现方案

### 1. API 层修改

**文件：** `app/api/analytics/overview/route.ts`

**新增字段：**

```typescript
// 诊断测评专用统计
const diagnosticAttemptsCount = await prisma.attempt.count({
  where: {
    userId,
    completedAt: { not: null },
    mode: 'diagnostic',
  },
});

// 诊断测评数据可信度
const diagnosticDataReliability =
  diagnosticAttemptsCount >= 3 ? "high"
  : diagnosticAttemptsCount >= 2 ? "medium" : "low";

// 诊断测评波动范围（基于 diagnostic 分数）
const diagnosticScores = await prisma.attempt.findMany({
  where: { userId, completedAt: { not: null }, mode: 'diagnostic' },
  select: { score: true },
  orderBy: { createdAt: 'desc' },
  take: 5,
});

let diagnosticVolatilityRange = 0;
if (diagnosticScores.length > 1) {
  const scores = diagnosticScores.map(a => a.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  diagnosticVolatilityRange = Math.round(
    Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length)
  );
}
```

**API 响应更新：**
```typescript
return NextResponse.json({
  overview: {
    // ... 现有字段
    // 诊断测评专用统计
    diagnosticAttemptsCount,
    diagnosticDataReliability,
    diagnosticVolatilityRange,
    // ... 其他字段
  },
});
```

### 2. 前端布局调整

**文件：** `components/AnalyzePage.tsx`

**上段：诊断测评数据**

```tsx
{/* 上段：诊断测评数据 */}
<section className="space-y-6">
  {/* 成长轨迹 */}
  <section className="bg-surface-container-low rounded-[2rem] p-6">
    <h3 className="text-xl font-display font-black text-on-surface mb-4">成长轨迹</h3>
    {/* ... 现有代码 */}
  </section>

  {/* 数据可信度和波动范围 */}
  <section className="grid grid-cols-2 gap-6">
    <div className="bg-surface-container-lowest rounded-[2rem] p-6">
      <div className="flex items-center gap-3 mb-3">
        <MaterialIcon icon="verified" className="text-primary" style={{ fontSize: '20px' }} />
        <h4 className="text-sm font-bold text-on-surface-variant">数据可信度</h4>
      </div>
      <p className="text-lg font-display font-black text-primary">
        {overview?.overview?.diagnosticDataReliability === 'high' ? '高'
         : overview?.overview?.diagnosticDataReliability === 'medium' ? '中'
         : overview?.overview?.diagnosticDataReliability ? '低' : '-'}
        {overview?.overview?.diagnosticAttemptsCount && ` (${overview.overview.diagnosticAttemptsCount}次诊断测评)`}
      </p>
    </div>
    <div className="bg-surface-container-lowest rounded-[2rem] p-6">
      <div className="flex items-center gap-3 mb-3">
        <MaterialIcon icon="show_chart" className="text-on-surface-variant" style={{ fontSize: '20px' }} />
        <h4 className="text-sm font-bold text-on-surface-variant">波动范围</h4>
      </div>
      <p className="text-lg font-display font-black text-on-surface">
        ±{overview?.overview?.diagnosticVolatilityRange ?? '-'} 分
      </p>
    </div>
  </section>

  {/* 知识掌握矩阵 */}
  <section className="space-y-4">
    <h3 className="text-xl font-display font-black text-on-surface">知识掌握矩阵</h3>
    {/* ... 现有代码 */}
  </section>
</section>

{/* 下段：练习数据 */}
<section className="space-y-6">
  {/* 练习状态 */}
  <section className="bg-surface-container-low rounded-[2rem] p-6">
    <h3 className="text-lg font-bold text-on-surface mb-4">练习状态</h3>
    {/* ... 现有代码 */}
  </section>

  {/* 本周练习趋势 */}
  <section className="bg-surface-container-low rounded-[2rem] p-6">
    {/* ... 现有代码 */}
  </section>

  {/* 知识练习分布（新增） */}
  <section className="space-y-4">
    <h3 className="text-xl font-display font-black text-on-surface">知识练习分布</h3>
    {/* 复制知识掌握矩阵的 UI 结构，但数据来自 training 模式 */}
    {/* 使用 trainingKnowledgeMastery 数据 */}
  </section>

  {/* AI 学习建议 */}
  <section className="bg-surface-container-low rounded-[2rem] p-6">
    {/* ... 现有代码 */}
  </section>
</section>
```

### 3. 接口类型更新

```typescript
interface OverviewInner {
  // ... 现有字段

  // 诊断测评专用统计
  diagnosticAttemptsCount: number;
  diagnosticDataReliability: 'high' | 'medium' | 'low';
  diagnosticVolatilityRange: number;

  // 知识点数据（两套）
  knowledgeMastery: KnowledgeMastery[];      // diagnostic 模式
  trainingKnowledgeMastery: KnowledgeMastery[]; // training 模式
}
```

---

## 验收标准

- [ ] 上段只显示 diagnostic 模式数据
- [ ] 下段只显示 training 模式数据
- [ ] 数据可信度显示诊断测评次数
- [ ] 波动范围基于诊断测评分数
- [ ] 新增"知识练习分布"组件
- [ ] 布局分为上下两段
- [ ] 无 TypeScript 错误