# 分析页成长故事组件重构设计

## 1. 背景与问题

### 当前问题
- 分析页的"成绩提升"模块混淆了测评分数和练习分数
- `averageScore` 包含 diagnostic（测评）+ training（练习）的混合数据
- 用户看到"提升了11分"实际是：测评79分 vs 练习平均90分的错误对比

### 数据库已有资产
- `Attempt.mode` 字段：`'diagnostic'`=测评，`'training'`=练习
- `User.initialAssessmentScore`：首次测评分数
- 数据已分离，只需前端按 mode 过滤

---

## 2. 设计目标

1. **成长故事只展示测评数据** — 首次测评 vs 最近测评的真实进步
2. **练习统计单独展示** — 正确率、总题数、练习时长
3. **最小改动原则** — 不新建 API，不改数据库，充分利用现有资产

---

## 3. 数据结构

### 成长故事数据源
| 指标 | 数据来源 |
|------|----------|
| 首次测评分数 | `User.initialAssessmentScore` 或最早的 diagnostic attempt |
| 最近测评分数 | 最新的 diagnostic attempt 的 score |
| 提升值 | 最近 - 首次 |

### 练习统计数据源
| 指标 | 数据来源 |
|------|----------|
| 平均正确率 | 从 overview 数据过滤 mode='training' 计算 |
| 总题数 | `overview.totalQuestions` |
| 练习时长 | `overview.totalMinutes` |

---

## 4. UI 改造

### 模块1：成长故事（测评）

```
┌─────────────────────────────────────────┐
│  测评成长                      [真实水平] │
│                                         │
│     首次              →            最近   │
│     79        ━━━━━━           82      │
│                                         │
│            ┌──────────┐                  │
│            │  +3分 ↑  │                  │
│            └──────────┘                  │
│                                         │
│     测评分数提升 · 真实反映学习进步        │
└─────────────────────────────────────────┘
```

### 模块2：练习统计（练习）

```
┌─────────────────────────────────────────┐
│  练习状态                    [日常巩固] │
│                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐   │
│  │   90   │  │   156  │  │   45   │   │
│  │正确率  │  │ 总题数  │  │  分钟   │   │
│  └────────┘  └────────┘  └────────┘   │
└─────────────────────────────────────────┘
```

---

## 5. 前端改动清单

### AnalyzePage.tsx 改动点

1. **获取测评数据**
   - 从 `/api/analytics/overview` 获取数据（已有）
   - 从数据中提取 diagnostic attempts（mode='diagnostic'）

2. **改造"成绩提升"卡片**
   - 显示首次测评分数（initialAssessmentScore）
   - 显示最近测评分数（最新 diagnostic attempt）
   - 计算提升值 = 最近 - 首次
   - 标签改为"测评成长轨迹"

3. **新增"练习统计"卡片**
   - 显示正确率（过滤 training 模式后计算）
   - 显示总题数（overview.totalQuestions）
   - 显示练习时长（overview.totalMinutes）
   - 从"成绩提升"卡片移除练习数据

---

## 6. 关键代码伪代码

```typescript
// 从 overview 数据中提取测评信息
const assessmentAttempts = allAttempts.filter(a => a.mode === 'diagnostic');
const firstScore = user.initialAssessmentScore || assessmentAttempts[0]?.score;
const latestScore = assessmentAttempts[assessmentAttempts.length - 1]?.score;
const growth = latestScore - firstScore;

// 从 overview 数据中提取练习统计
const trainingAttempts = allAttempts.filter(a => a.mode === 'training');
const trainingAvg = trainingAttempts.reduce((sum, a) => sum + a.score, 0) / trainingAttempts.length;
```

---

## 7. 验收标准

1. 成长故事卡片只显示测评分数，不包含练习数据
2. 练习统计卡片清晰展示练习相关指标
3. 提升值计算正确（测评 vs 测评）
4. 改动最小化，不新建 API 接口
5. 页面渲染正常，无类型错误
