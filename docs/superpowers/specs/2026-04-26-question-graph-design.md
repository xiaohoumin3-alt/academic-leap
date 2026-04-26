# Question Graph 架构设计文档 v2.0

**日期**: 2026-04-26
**状态**: 架构评审后修订
**作者**: AI + 用户头脑风暴 + 架构评审

---

## 系统第一原则（Principle #1）

> **诊断能力来自覆盖认知节点，而不是步骤数。**

所有设计决策必须服从这一原则。

---

## 一、背景与问题

### 1.1 当前系统问题

| 问题 | 说明 |
|------|------|
| 步骤 ≠ 思维过程 | 现实中学生有多种解题路径，系统强加唯一顺序 |
| 公平性问题 | 学生A用10步，学生B用2步，答案都对，系统能给B扣分吗？ |
| 诊断矛盾 | 选择题只有1步，如何诊断学生卡在哪里？ |
| 步骤划分争议 | 什么该拆，什么不该拆，没有清晰标准 |

**核心矛盾**：系统试图用"线性结构"去约束"非线性思维"。

---

## 二、新范式：Question Graph

### 2.1 范式升级

```
旧范式（Step-based）:
一个题 → 多个步骤 → 强制顺序

新范式（Question Graph）:
一个知识点 → 多个子问题 → 弱依赖关系（DAG）→ 调度引擎
```

### 2.2 子问题定义 + 强约束

**子问题（SubQuestion）**：一个"最小可判定的认知单元"

必须满足三个条件：
1. 学生必须输出（不是看/想）
2. 系统可以判对错
3. 对应一个独立认知动作

| 示例 | 是否子问题 | 原因 |
|------|-----------|------|
| "理解题意" | ❌ | 不可判定 |
| "判断是否直角三角形" | ✅ | yes/no 输出 |
| "计算 c²" | ✅ | 数值输出 |
| "计算 c" | ✅ | 数值输出 |

---

### 2.3 子问题数量强约束（新增）

**为防止模板质量失控，强制限制**：

```typescript
const SUB_QUESTION_LIMITS = {
  MAX_PER_GROUP: 5,      // 每组最多5个子问题
  RECOMMENDED: 3,        // 推荐数量
  DAG_MAX_DEPTH: 2,      // DAG最大深度
} as const;
```

**按题型分类**：

| 题型 | 子问题数 | 理由 |
|------|---------|------|
| 选择/填空 | 1 | 本身就是单步输入 |
| 基础计算 | 2-3 | 按运算层级拆分 |
| 应用题 | 3-5 | 按建模路径拆分 |
| 证明题 | 4-6 | 未来扩展 |

**超出限制的模板必须人工审查**。

---

## 三、系统架构（完整版）

### 3.1 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Question Graph System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐                  │
│  │ Question Graph  │───→│ Student State   │                  │
│  │   (结构层)       │    │   (状态层)       │                  │
│  └─────────────────┘    └─────────────────┘                  │
│                                ↓                              │
│                       ┌─────────────────┐                     │
│                       │ Diagnosis Engine│ ← 核心缺失模块      │
│                       │   (决策层)       │   (新增)            │
│                       └─────────────────┘                     │
│                                ↓                              │
│                       ┌─────────────────┐                     │
│                       │       UI        │                     │
│                       │   (展示层)       │                     │
│                       └─────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据结构（更新版）

```typescript
// 知识点
interface KnowledgeUnit {
  id: string;
  name: string;
  chapter: string;
}

// 问题组（一个练习）
interface QuestionGroup {
  groupId: string;
  knowledge: KnowledgeUnit;
  difficulty: number;  // 0-5，控制出题
  questions: SubQuestion[];

  // 新增：强约束
  validate(): boolean {
    return this.questions.length <= SUB_QUESTION_LIMITS.MAX_PER_GROUP;
  }
}

// 子问题
interface SubQuestion {
  questionId: string;
  type: AnswerMode;
  description: string;
  hint?: string;
  expectedAnswer: ExpectedAnswer;
  dependsOn?: string[];  // 依赖的其他问题ID

  // 新增：三个维度的统一
  difficultyWeight: number;    // 评分权重（0-1）
  coverageFactor: number;      // 覆盖因子（表示覆盖的认知节点数）
  cognitiveLevel: number;      // 认知层级（1-4，按布鲁姆分类法）
}

// 答题记录
interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  duration: number;
  skipped: boolean;
  timestamp: number;
}

// 学生状态（新增）
interface StudentState {
  // 当前题目的答题状态
  results: Map<string, QuestionResult>;

  // 每个认知节点的不确定性（0-1）
  uncertainty: Map<string, number>;

  // 推荐路径
  recommendedPath: string[];
}
```

### 3.3 依赖关系图（DAG）+ 推荐路径

```
示例：勾股定理应用题

Q1: 判断是否直角三角形 (boolean)
        ↓
Q2: 计算 c² (number)
        ↓
Q3: 计算 c (number)
        ↓
Q4: 应用到实际问题 (number)

推荐路径: Q1 → Q2 → Q3 → Q4
允许跳转: 学生可直接做 Q3，但系统会标记 Q1, Q2 未验证
```

---

## 四、核心模块：诊断决策引擎（新增）

### 4.1 Question Scheduler（问题调度器）

**这是系统最核心的缺失模块，负责决策"下一个问题是什么"**。

```typescript
interface QuestionScheduler {
  // 根据当前学生状态，选择下一个问题
  pickNext(state: StudentState): NextQuestionDecision;
}

interface NextQuestionDecision {
  action: 'progress' | 'validate' | 'gap_fill' | 'complete';
  questionId?: string;
  reason: string;
}
```

#### 三种调度策略

| 策略 | 触发条件 | 行为 |
|------|---------|------|
| **推进策略** | 当前问题完成，依赖已满足 | 进入推荐路径的下一题 |
| **验证策略** | 跳过了高影响的基础问题 | 回头补问未验证的基础 |
| **补洞策略** | 某节点不确定性过高 | 主动补问验证 |

#### 示例决策逻辑

```typescript
function pickNext(state: StudentState): NextQuestionDecision {
  // 策略1：检查是否有未验证的高影响节点
  const unvalidatedHighImpact = findUnvalidatedHighImpact(state);
  if (unvalidatedHighImpact) {
    return {
      action: 'validate',
      questionId: unvalidatedHighImpact,
      reason: '验证基础是否掌握'
    };
  }

  // 策略2：检查是否有高不确定性的节点
  const highUncertainty = findHighUncertainty(state, threshold = 0.6);
  if (highUncertainty) {
    return {
      action: 'gap_fill',
      questionId: highUncertainty,
      reason: '补问以降低不确定性'
    };
  }

  // 策略3：正常推进
  const nextInPath = getNextInRecommendedPath(state);
  if (nextInPath) {
    return {
      action: 'progress',
      questionId: nextInPath,
      reason: '继续推荐路径'
    };
  }

  return { action: 'complete', reason: '所有问题完成' };
}
```

### 4.2 动态补问机制（重构版）

**从"规则驱动"升级为"信息增益驱动"**。

#### 旧版本（❌ 规则驱动）
```typescript
// ❌ 不好：硬编码次数
if (directAnswerCount >= 2) {
  triggerFollowUp();
}
```

#### 新版本（✅ 信息增益驱动）
```typescript
// ✅ 好：基于不确定性
function shouldTriggerFollowUp(
  state: StudentState,
  questionId: string
): boolean {
  const uncertainty = state.uncertainty.get(questionId) ?? 1.0;

  // 信息增益 = 当前不确定性 - 预期事后不确定性
  const informationGain = uncertainty - expectedPosteriorUncertainty;

  // 只有当信息增益足够大时才补问
  return informationGain > GAIN_THRESHOLD;
}
```

**触发条件**：
1. 某节点未验证（uncertainty = 1.0）
2. 该节点影响后续问题（高coverageFactor）
3. 补问能显著降低不确定性（informationGain > threshold）

### 4.3 掌握度计算（统一公式）

**三个维度的统一**：

```typescript
function calculateMastery(
  results: QuestionResult[],
  questions: SubQuestion[]
): MasteryProfile {
  // 统一公式
  const mastery = questions.reduce((sum, q) => {
    const result = results.find(r => r.questionId === q.questionId);
    if (!result || result.skipped) return sum;

    const score = result.isCorrect ? 1 : 0;
    const contribution = score * q.difficultyWeight * q.coverageFactor;

    return sum + contribution;
  }, 0) / normalizeFactor;

  return {
    overall: mastery,
    nodes: calculateNodeMastery(results, questions),
    recommended: generateRecommendations(mastery, uncertainty)
  };
}
```

**三个概念的明确分工**：

| 概念 | 作用 | 使用场景 |
|------|------|---------|
| difficulty | 控制出题 | 决定给学生的题目难度 |
| weight | 控制评分 | 计算最终得分 |
| coverageFactor | 控制诊断 | 影响掌握度和补问决策 |

---

## 五、UI/UX 设计（更新版）

### 5.1 问题卡片展示 + 推荐路径

```
┌─────────────────────────────────────────────┐
│  勾股定理 - 问题 2 / 4                       │
├─────────────────────────────────────────────┤
│                                             │
│  在直角三角形中，a=3, b=4，求 c²           │
│                                             │
│  [ 输入框 ]                                 │
│                                             │
│  [ 提交 ]  [ 跳过 ]  [ 查看推荐路径 → ]     │
└─────────────────────────────────────────────┘
```

**关键变化**：
- ✅ 显示"推荐路径"按钮（不是强制，但默认引导）
- ✅ 跳题时给出警告："跳过此题可能影响诊断精度"

### 5.2 进度展示 + DAG可视化

```
总进度: 2/4 问题完成

推荐路径: Q1 → Q2 → Q3 → Q4

● ● ○ ○
Q1 Q2 Q3 Q4
✓  ✓  ?  ?

未完成:
○ Q3 (推荐下一题)
○ Q4 (依赖: Q3)

已跳过:
⊘ Q1 (基础未验证，建议补问)
```

---

## 六、评估模型（更新版）

### 6.1 诊断规则表（保留作为参考，但不是核心）

| 场景 | 判断 | 不确定性 |
|------|------|---------|
| Q1正确, Q2正确, Q3正确 | 完全掌握 | 低 |
| Q1跳过, Q2正确, Q3正确 | 可能掌握 | 中（Q1未验证） |
| Q1错误, Q2跳过, Q3正确 | 部分掌握 | 高（基础不牢） |
| Q1跳过, Q2跳过, Q3正确 | 直接答题者 | 极高（需补问） |

### 6.2 诊断一致性指标（新增）

**系统护城河指标**：

| 指标 | 定义 | 目标 |
|------|------|------|
| **诊断一致性** | 同一学生多次测试结果的相关系数 | >0.8 |
| **预测能力** | 用前N题预测第N+1题的准确率 | >0.75 |
| **信息增益** | 平均每题降低的不确定性 | >0.3 |

---

## 七、实现路线图（重构版 - 分4步收敛）

### Step 1: 固定结构（1周）- 先做能上线的

**目标**：快速验证核心假设，不追求完整功能

```typescript
// 强约束
const STEP_1_LIMITS = {
  MAX_QUESTIONS: 3,      // 每组最多3个问题
  DAG_DEPTH: 1,          // DAG最大深度1（只有顺序依赖）
  SKIP_ENABLED: false,   // 暂时禁用跳题
} as const;
```

- [ ] 定义 `QuestionGroup`, `SubQuestion` 接口
- [ ] 实现简单的顺序依赖（Q1→Q2→Q3）
- [ ] 迁移5个核心模板到新结构
- [ ] 不允许跳题，只有"下一题"

### Step 2: 简单调度器（1周）

**目标**：加入基础决策能力

```typescript
// 规则版调度器
function simpleScheduler(state: StudentState): NextQuestionDecision {
  // 规则1：有未完成的依赖 → 补基础
  if (hasUnmetDependency(state)) {
    return { action: 'validate', questionId: findDependency(state) };
  }

  // 规则2：推进新问题
  return { action: 'progress', questionId: getNextQuestion(state) };
}
```

- [ ] 实现 StudentState
- [ ] 实现简单调度器（2条规则）
- [ ] 加入"跳过"功能（但给出警告）

### Step 3: 智能补问（1周）

**目标**：从规则驱动升级到信息增益驱动

```typescript
function shouldFollowUp(state: StudentState, questionId: string): boolean {
  const unvalidated = state.uncertainty.get(questionId) ?? 1.0;
  const impact = questions.find(q => q.id === questionId)!.coverageFactor;

  // 规则：未验证 + 高影响 → 补问
  return unvalidated > 0.8 && impact > 0.7;
}
```

- [ ] 实现不确定性计算
- [ ] 实现基于影响力的补问决策
- [ ] UI显示补问提示

### Step 4: 完整系统（2周）- 最后才做

**目标**：完全非线性 + 自适应

- [ ] 完全自由跳题
- [ ] 信息增益优化
- [ ] 自适应推荐路径
- [ ] DAG可视化

---

## 八、风险与缓解（更新版）

| 风险 | 缓解措施 | 对应Step |
|------|---------|----------|
| 模板质量失控 | 强约束（MAX=5）+ 人工审查 | Step 1 |
| 学生乱跳题 | 推荐路径 + 跳题警告 | Step 2 |
| 调度器过于复杂 | 从规则版开始，逐步升级 | Step 2-4 |
| 诊断失真 | 加入一致性指标监控 | Step 3 |
| 数据迁移困难 | 保留旧API，双轨运行 | 全程 |

---

## 九、成功指标（更新版）

### 产品指标

| 指标 | 目标 |
|------|------|
| 学生完成率 | >85% |
| 平均答题时间 | 减少20% |
| 学生满意度 | >4.0/5.0 |

### 系统指标（护城河）

| 指标 | 定义 | 目标 |
|------|------|------|
| **诊断一致性** | 同一学生多次测试结果相关系数 | >0.8 |
| **预测能力** | 用前N题预测第N+1题准确率 | >0.75 |
| **信息增益** | 平均每题降低的不确定性 | >0.3 |

---

## 十、待确认问题（更新版）

### 架构级决策

1. **Step 1 上线时间**：是否接受2周内上线简化版？（推荐：是）

2. **子问题数量上限**：确认 MAX=5？（推荐：是）

3. **跳题策略**：
   - A) 完全自由跳
   - B) 跳题需确认
   - C) 只能跳过，不能跳回

4. **补问触发阈值**：informationGain > 0.5？（推荐：0.5）

### 向后兼容

5. **旧模板迁移**：
   - A) 自动1:1映射（快速但有风险）
   - B) 人工审查5个核心模板后批量迁移
   - C) 双轨运行，逐步迁移

---

## 附录：关键决策记录

| 决策 | 理由 | 日期 |
|------|------|------|
| 废除步骤概念，改用Question Graph | 步骤是伪问题，诊断靠覆盖节点 | 2026-04-26 |
| 允许非线性答题 | 公平性 + 现实性 | 2026-04-26 |
| 补问从规则驱动改为信息增益驱动 | 诊断系统需要智能决策 | 2026-04-26 |
| 分4步收敛，先做简化版 | 避免理论完美、工程失败 | 2026-04-26 |
| 强约束子问题数量（MAX=5） | 防止模板质量失控 | 2026-04-26 |

---

**文档版本**: v2.0 (架构评审后修订)
**最后更新**: 2026-04-26
**审查状态**: 待最终确认
