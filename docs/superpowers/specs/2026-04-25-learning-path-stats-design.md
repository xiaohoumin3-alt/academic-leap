# 学习路径统计改进设计

## 背景

当前"本周练习"统计存在问题：
- 标签混淆：显示"本周练习"，实际是"尝试次数"（attempt 计数）
- 时间范围：使用滚动 7 天，不符合用户对"本周"的认知
- 数据口径：包含未完成的尝试，水分较大

## 目标

重新定义"本周学习"的统计口径，使其更准确、更有意义。

## 新的统计口径

### 显示标签
**"本周练习知识点"**

### 计算逻辑

```
1. 确定自然周范围（本周一 00:00:00 到当前时间）
2. 查询本周内所有已完成的 attempt（状态为 completed）
3. 从 attempt.steps 中提取 questionStep，获取题目关联的知识点
4. 统计每个知识点的答题次数
5. 筛选答题次数 >= 3 的知识点
6. 返回唯一知识点数量
```

### 为什么是 3 次？
- 1 次：可能是偶然点击，不算真正练习
- 3 次：表明用户有意识地练习了这个知识点
- 避免重复刷同一题目（可以通过去重知识点处理）

## 数据流

### API 修改
**文件：** `app/api/learning-path/route.ts`

**原逻辑：**
```typescript
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const recentAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    startedAt: { gte: sevenDaysAgo },
  },
});

const practicedCount = recentAttempts.length;
```

**新逻辑：**
```typescript
// 1. 计算本周一 00:00:00
const now = new Date();
const dayOfWeek = now.getDay();
const startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
startOfWeek.setHours(0, 0, 0, 0);

// 2. 查询本周完成的练习及其题目步骤
const recentAttempts = await prisma.attempt.findMany({
  where: {
    userId,
    startedAt: { gte: startOfWeek },
    status: 'completed', // 只统计完成的练习
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

// 3. 统计每个知识点的答题次数
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

// 4. 筛选答题次数 >= 3 的知识点
const practicedKnowledgePoints = Array.from(knowledgePointPracticeCount.entries())
  .filter(([_, count]) => count >= 3)
  .map(([kp]) => kp);

// 5. 返回唯一知识点数量
const practicedCount = new Set(practicedKnowledgePoints).size;
```

### 前端修改
**文件：** `components/LearningPathOverview.tsx`

**第 180-182 行：**
```tsx
// 原代码
<p className="text-2xl font-bold text-primary">{weeklySummary.practicedCount}</p>
<p className="text-xs text-on-surface-variant">本周练习</p>

// 新代码
<p className="text-2xl font-bold text-primary">{weeklySummary.practicedKnowledgePoints}</p>
<p className="text-xs text-on-surface-variant">本周练习知识点</p>
```

## API 响应格式变更

**原响应：**
```json
{
  "success": true,
  "data": {
    "path": {...},
    "roadmap": [...],
    "weeklySummary": {
      "practicedCount": 37,        // 尝试次数
      "masteredCount": 2,          // 已掌握
      "weakCount": 4               // 待加强
    }
  }
}
```

**新响应：**
```json
{
  "success": true,
  "data": {
    "path": {...},
    "roadmap": [...],
    "weeklySummary": {
      "practicedKnowledgePoints": 12,  // 本周练习的知识点数
      "masteredCount": 2,               // 已掌握
      "weakCount": 4                    // 待加强
    }
  }
}
```

## 边界情况

1. **本周还没有练习**：返回 0
2. **知识点解析失败**：跳过该题目，继续统计其他题目
3. **题目没有关联知识点**：不计入统计
4. **跨周练习**：只统计本周一开始后的练习

## 测试要点

1. 验证自然周计算正确（周一 00:00:00 开始）
2. 验证只统计完成的练习
3. 验证答题次数 < 3 的知识点不计入
4. 验证同一知识点多次练习只计数一次
5. 验证知识点为空的题目被跳过
