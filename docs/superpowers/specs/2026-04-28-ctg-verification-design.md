# CTG 验证设计

**日期**: 2026-04-28
**目标**: 验证 Complexity Transfer 是否有效

---

## 核心问题

> **"简单题 → 复杂题的能力迁移，是否真实存在？"**

**答案判定**: CTG > 0 = 有效，CTG ≤ 0 = 噪声

---

## 指标定义

### Complexity Transfer Gain (CTG)

```typescript
CTG = Acc_with_transfer - Acc_baseline

// 其中：
// - baseline = 纯 MLP 预测
// - with_transfer = MLP + complexity transfer 预测
// - Acc = 准确率（预测概率四舍五入后与真实结果匹配率）
```

### 预测方法

```typescript
// Baseline: 纯 MLP
P_baseline = mlpPredict(studentId, questionId, ctx)

// Transfer: 融合预测
P_transfer = λ * P_baseline + (1 - λ) * P_transfer_mapped

// 准确率判定
isCorrect(prediction, actual) = Math.round(prediction) === actual
```

---

## 数据构造

### 输入：现有日志

从 `state.trace` 和 `state.questions` 提取历史数据。

### 构造方法

对于每个学生：

```
1. 收集所有题目
2. 分类：
   - S (Simple): complexity < threshold
   - C (Complex): complexity >= threshold
3. 取前 N% 的 S 作为训练集
4. 取所有 C 作为测试集
5. 排除：测试集中在训练时有记录的题目
```

**参数**：
- `complexity_threshold = 0.3`（可调）
- `train_ratio = 0.7`（70% 简单题用于训练）
- `min_attempts = 3`（最少尝试次数）

### 伪代码

```typescript
function constructDataset(studentId: string): Dataset {
  const studentHistory = getStudentHistory(studentId);

  // 分类
  const S = studentHistory.filter(q => q.complexity < 0.3);
  const C = studentHistory.filter(q => q.complexity >= 0.3);

  // 训练/测试分割
  const trainCount = Math.floor(S.length * 0.7);
  const trainQuestions = S.slice(0, trainCount);
  const testQuestions = C.filter(q => !trainQuestions.includes(q));

  // 提取训练数据（只保留 attempts >= 3）
  const trainData = trainQuestions
    .filter(q => q.attemptCount >= 3)
    .map(q => ({
      questionId: q.id,
      attempts: q.attempts,  // 历史尝试记录
      correctRate: q.correctCount / q.attemptCount
    }));

  // 提取测试数据
  const testData = testQuestions
    .filter(q => q.attemptCount >= 1)
    .map(q => ({
      questionId: q.id,
      actual: q.correctCount > 0 ? 1 : 0  // 最新一次结果
    }));

  return { studentId, trainData, testData };
}
```

---

## 测试流程

### 步骤 1：准备 UOK 实例

```typescript
const uok = new UOK();

// 用历史数据初始化
for (const question of allQuestions) {
  uok.encodeQuestion({ id: question.id, content: question.content, topics: question.topics });
}

// 模拟训练：用 trainData 训练
for (const { questionId, attempts } of trainData) {
  for (const { correct } of attempts) {
    uok.encodeAnswer(studentId, questionId, correct);
  }
}
```

### 步骤 2：计算 Baseline 准确率

```typescript
let baselineCorrect = 0;
let total = 0;

for (const { questionId, actual } of testData) {
  const ctx = getContext(questionId);
  const prediction = uok.predict(studentId, questionId, ctx);

  if (Math.round(prediction) === actual) {
    baselineCorrect++;
  }
  total++;
}

const Acc_baseline = baselineCorrect / total;
```

### 步骤 3：计算 Transfer 准确率

```typescript
let transferCorrect = 0;
let total = 0;

for (const { questionId, actual } of testData) {
  const ctx = getContext(questionId);
  const prediction = uok.predictWithComplexityTransfer(
    studentId,
    questionId,
    referenceQuestionId  // 需要指定参照题
  );

  if (Math.round(prediction) === actual) {
    transferCorrect++;
  }
  total++;
}

const Acc_transfer = transferCorrect / total;
```

### 步骤 4：计算 CTG

```typescript
const CTG = Acc_transfer - Acc_baseline;
```

---

## 聚合方法

多个学生需要聚合：

```typescript
// 方法 1：简单平均
const CTG_avg = mean(allStudents.map(s => s.CTG));

// 方法 2：加权平均（按测试样本数）
const totalTests = sum(allStudents.map(s => s.testCount));
const CTG_weighted = sum(allStudents.map(s => s.CTG * s.testCount)) / totalTests;

// 方法 3：胜率
const winRate = allStudents.filter(s => s.CTG > 0).length / allStudents.length;
```

---

## 输出格式

```typescript
interface CTGResult {
  summary: {
    CTG: number;              // 加权 CTG
    CTG_avg: number;          // 平均 CTG
    winRate: number;           // CTG > 0 的学生占比
    totalStudents: number;
    totalTests: number;
  };
  perStudent: {
    studentId: string;
    Acc_baseline: number;
    Acc_transfer: number;
    CTG: number;
    testCount: number;
  }[];
  verdict: 'SUCCESS' | 'FAILURE';
}

// 判定
const verdict = CTG > 0 ? 'SUCCESS' : 'FAILURE';
```

---

## 验证实现

### 最小实现：离线脚本

```typescript
// scripts/verify-ctg.ts
import { UOK } from '$lib/qie';

async function verifyCTG(): Promise<CTGResult> {
  // 1. 加载历史数据
  const history = loadHistory();

  // 2. 对每个学生构造数据集
  const datasets = history
    .map(h => constructDataset(h))
    .filter(d => d.trainData.length > 0 && d.testData.length > 0);

  const results = [];

  // 3. 对每个学生计算 CTG
  for (const dataset of datasets) {
    const uok = new UOK();
    // ... 初始化和训练 ...

    const baseline = calculateBaseline(uok, dataset);
    const transfer = calculateTransfer(uok, dataset);
    const ctg = transfer - baseline;

    results.push({ ...dataset, baseline, transfer, ctg });
  }

  // 4. 聚合
  return aggregate(results);
}
```

### 运行方式

```bash
pnpm ts-node scripts/verify-ctg.ts
```

---

## 成功标准

| 指标 | 阈值 | 含义 |
|------|------|------|
| CTG_weighted | > 0 | 整体有效 |
| winRate | > 50% | 多数学生有效 |

---

## 失败处理

### CTG ≤ 0

可能原因：
1. 映射函数错误
2. 特征提取不准确
3. 融合参数不合理

调试步骤：
1. 检查 `w` 权重分布
2. 检查 `λ` 分布
3. 检查失败案例的特征

---

## 实现边界

**做：**
- 离线 CTG 验证脚本
- 数据构造逻辑
- Baseline vs Transfer 对比
- 聚合和输出

**不做：**
- UI 界面
- 在线学习
- act() 推荐验证
- 复杂的可视化
