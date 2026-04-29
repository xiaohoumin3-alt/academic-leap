# 改造影响评估：v1.0 Production Architecture

**日期**: 2026-04-26
**问题**: 按新架构改造是否颠覆性？

---

## 结论先说

**不是颠覆性改造，是渐进式升级**

原因：现有系统是**模板生成 + 规则判题**，新架构是**预测服务**，两者是**互补关系**，不是替换关系。

---

## 现有系统分析

### 当前架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Next.js    │────▶│  Question   │────▶│  Database   │
│  (Frontend) │     │  Engine     │     │  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  Judge V2   │
                     │  (规则判题)  │
                     └─────────────┘
```

### 核心模块

| 模块 | 文件 | 行数 | 职责 |
|------|------|------|------|
| 题目生成 | `question-engine/` | ~500 | 模板生成题目 |
| 难度计算 | `difficulty.ts` | ~800 | 难度评估 |
| 判题系统 | `judge-v2.ts` | ~300 | 步骤判题 |
| 数据模型 | `prisma/schema` | ~400 | 26个表 |
| 前端组件 | `components/` | 36个 | UI交互 |

### 关键发现

✅ **好消息**：
1. 前端/组件**没有使用任何因果模型**
2. 现有系统是**规则驱动**，不是模型驱动
3. 数据模型**已经存在**（User, Attempt, UserKnowledge等）
4. 判题逻辑**独立**，易于解耦

❌ **风险点**：
1. 无统一的**预测服务**
2. 难度计算是**静态规则**，不是数据驱动
3. 学生能力估计**分散**在多处

---

## 改造方案：渐进式升级

### Phase 1: 添加 Prediction Service（不破坏现有）

```
现有系统                    新增服务
┌─────────────┐           ┌─────────────┐
│  Next.js    │           │ Prediction  │
│  (Frontend) │           │  Service    │
└─────────────┘           └─────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐           ┌─────────────┐
│  Question   │    ──▶    │  Predict    │
│  Engine     │           │  Ability    │
└─────────────┘           └─────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐           ┌─────────────┐
│  Judge V2   │           │  Database   │
└─────────────┘           └─────────────┘
```

**改动范围**：
- ✅ 不修改现有判题逻辑
- ✅ 不修改现有数据模型
- ✅ Prediction Service 作为**独立服务**
- ✅ 前端**可选**调用预测API

**工作量**：1-2周
- Prediction Service 实现（已完成）
- API Gateway 配置
- 前端调用封装（可选）

---

### Phase 2: 数据驱动优化（渐进替换）

**目标**：用预测服务逐步替换静态规则

| 现有逻辑 | 替换为 | 风险 |
|---------|--------|------|
| 静态难度公式 | Prediction Service | 低（可A/B测试） |
| 简单能力估计 | 预测概率 | 低（可并行运行） |
| 规则推荐 | 预测推荐 | 中（需验证） |

**工作量**：2-4周
- 数据管道建设
- A/B测试框架
- 监控告警

---

### Phase 3: 完整迁移（可选）

**如果** Prediction Service 验证有效：
- 逐步移除静态规则
- 统一数据流
- 完整监控

**工作量**：4-6周

---

## 详细影响分析

### 1. 数据层（低风险）

**现有**：
```prisma
model UserKnowledge {
  userId    Int
  knowledgeId Int
  level     Float
}
```

**新增**（可选）：
```prisma
model PredictionLog {
  id        Int @id
  studentId Int
  questionId Int
  predicted Float
  actual   Boolean?
  timestamp DateTime
}
```

**影响**：✅ 不破坏现有表，只添加日志

---

### 2. API层（低风险）

**现有**：
```typescript
// /api/questions/generate
await generateQuestion({ knowledgeId: 123 })
```

**新增**（并行）：
```typescript
// /api/predict (新端点)
await predictionService.predict({ studentId, questionFeatures })
```

**影响**：✅ 新端点，不影响现有

---

### 3. 前端层（低风险）

**现有**：
```typescript
// 直接显示题目
<QuestionPage question={question} />
```

**新增**（可选）：
```typescript
// 显示预测概率（UI增强）
<QuestionPage
  question={question}
  prediction={prediction} // 可选
/>
```

**影响**：✅ props可选，不影响现有

---

### 4. 判题层（零风险）

**现有**：Judge V2 完全不变

**影响**：✅ 不触碰判题逻辑

---

## 风险评估矩阵

| 模块 | 改造风险 | 回滚难度 | 建议 |
|------|---------|---------|------|
| Prediction Service | 低 | 易 | ✅ 先做 |
| 前端调用 | 低 | 易 | ✅ 可选添加 |
| 数据模型 | 低 | 易 | ✅ 只加不减 |
| 判题逻辑 | 无 | 无 | ❌ 不改 |
| 难度计算 | 中 | 中 | ⚠️ A/B测试后替换 |

---

## 工作量估算

### 最小可行版本（2周）

```
Week 1:
├── Prediction Service 部署 (1天)
├── 数据管道搭建 (2天)
├── API Gateway 配置 (1天)
└── 前端调用封装 (1天)

Week 2:
├── 数据验证 (2天)
├── 监控告警 (1天)
├── 文档更新 (1天)
└── 测试验证 (1天)
```

### 完整迁移（8-12周）

```
Month 1: MVP上线
Month 2: 数据验证
Month 3: A/B测试
```

---

## 关键原则

### 1. 双轨运行（Dual-Track）

```
旧系统 ────────┐
              ├─── 用户流量
新系统 ────────┘

先并行，验证后再切换
```

### 2. 特性开关（Feature Flag）

```typescript
const usePrediction = featureFlag('prediction-service');
const difficulty = usePrediction
  ? await predictDifficulty(...)
  : calculateDifficultyStatic(...);
```

### 3. 灰度发布

```
Week 1-2:  5% 流量
Week 3-4:  20% 流量
Week 5-6:  50% 流量
Week 7-8:  100% 流量
```

---

## 不改的部分（明确保留）

### ❌ 不改的模块

1. **Judge V2** - 判题逻辑完全保留
2. **Question Engine** - 题目生成保留
3. **现有数据模型** - 只增不减
4. **前端组件** - 只加可选props

### ✅ 只新增的部分

1. **Prediction Service** - 新服务
2. **API Gateway** - 新路由
3. **监控日志** - 新观测

---

## 总结

### 是颠覆性改造吗？

**不是**。原因：

1. **现有系统是规则驱动**，不是模型驱动
2. **Prediction Service 是增量**，不是替换
3. **可以双轨运行**，风险可控
4. **前端改动可选**，不影响现有功能

### 改造策略

```
保守策略（推荐）:
  → 先做 Prediction Service
  → 只用于数据分析和内部测试
  → 验证有效后再考虑生产使用

激进策略:
  → 直接替换难度计算
  → 需要2周灰度发布
  → 风险可控，但需要密切监控
```

### 建议

1. **Week 1-2**: 部署 Prediction Service，只做数据记录
2. **Week 3-4**: 分析预测准确率，与现有规则对比
3. **Week 5-6**: 如果准确率更高，开始A/B测试
4. **Week 7+**: 逐步切换

---

**一句话**：这不是推倒重来，而是在现有基础上**加装智能引擎**。
