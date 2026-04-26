# Question Graph 架构设计文档 v2.2

**日期**: 2026-04-26
**状态**: 第三轮架构评审后修订（多节点归因）
**作者**: AI + 用户头脑风暴 + 架构评审

---

## 系统第一原则（Principle #1）

> **诊断能力来自覆盖认知节点，而不是步骤数。**

所有设计决策必须服从这一原则。

**关键推论**：
- 认知节点必须标准化、可复用、可比较
- 子问题必须绑定到具体的认知节点
- 诊断结果是节点级别的，不是题目级别的

---

## 一、背景与问题

### 1.1 当前系统问题

| 问题 | 说明 |
|------|------|
| 步骤 ≠ 思维过程 | 现实中学生有多种解题路径，系统强加唯一顺序 |
| 公平性问题 | 学生A用10步，学生B用2步，答案都对，系统能给B扣分吗？ |
| 诊断矛盾 | 选择题只有1步，如何诊断学生卡在哪里？ |
| 步骤划分争议 | 什么该拆，什么不该拆，没有清晰标准 |
| **节点未标准化** | 同一知识点，不同人拆出不同的"节点"，诊断不可比 |

**核心矛盾**：系统试图用"线性结构"去约束"非线性思维"，且缺少统一的认知节点体系。

---

## 二、新范式：Question Graph + Cognitive Node Registry

### 2.1 范式升级

```
旧范式（Step-based）:
一个题 → 多个步骤 → 强制顺序

新范式:
一个知识点 → 认知节点注册表 → 子问题绑定节点 → 诊断引擎
```

### 2.2 核心概念关系

```
Cognitive Node（认知节点）
    ↓
SubQuestion（子问题，绑定到节点）
    ↓
QuestionGroup（问题组）
    ↓
Diagnosis（节点级诊断）
```

### 2.3 子问题定义 + 强约束

**子问题（SubQuestion）**：一个"最小可判定的认知单元"

必须满足三个条件：
1. 学生必须输出（不是看/想）
2. 系统可以判对错
3. **绑定到标准化的认知节点**（新增）

| 示例 | 是否子问题 | 绑定节点 |
|------|-----------|---------|
| "理解题意" | ❌ | 无（不可判定） |
| "判断是否直角三角形" | ✅ | pythagoras_recognition_001 |
| "计算 c²" | ✅ | pythagoras_computation_001 |
| "计算 c" | ✅ | pythagoras_computation_002 |

### 2.4 子问题数量强约束

```typescript
const SUB_QUESTION_LIMITS = {
  MAX_PER_GROUP: 5,      // 每组最多5个子问题
  RECOMMENDED: 3,        // 推荐数量
  DAG_MAX_DEPTH: 2,      // DAG最大深度
} as const;
```

---

## 三、系统架构（完整版）

### 3.1 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Question Graph System                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │ Cognitive Node   │───→│  Question Graph  │                  │
│  │   Registry       │    │    (结构层)       │                  │
│  │  (节点定义层)     │    │                  │                  │
│  └──────────────────┘    └──────────────────┘                  │
│                                   ↓                            │
│                          ┌──────────────────┐                  │
│                          │  Student State   │                  │
│                          │   (状态层)        │                  │
│                          │  - 节点掌握度     │                  │
│                          │  - 时间衰减       │                  │
│                          └──────────────────┘                  │
│                                   ↓                            │
│                          ┌──────────────────┐                  │
│                          │ Diagnosis Engine │                  │
│                          │   (决策层)        │                  │
│                          │  - 启发式增益     │                  │
│                          │  - 依赖惩罚       │                  │
│                          └──────────────────┘                  │
│                                   ↓                            │
│                          ┌──────────────────┐                  │
│                          │       UI        │                   │
│                          │   (展示层)        │                  │
│                          └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据结构（v2.1 修订版）

```typescript
// ============ 认知节点（详见 Cognitive Node Registry 文档）============
interface CognitiveNode {
  id: string;                    // 唯一标识
  knowledgeUnit: string;         // 归属知识点
  type: 'recognition' | 'concept' | 'computation' | 'application' | 'reasoning';
  description: string;
  difficulty: number;            // 0-1，节点基础难度
  importance: number;            // 0-1，在知识点中的重要性
  prerequisites: string[];       // 前置节点ID
  dependentNodes: string[];      // 后续节点ID
}

// ============ 知识点 ============
interface KnowledgeUnit {
  id: string;
  name: string;
  chapter: string;
}

// ============ 问题组 ============
interface QuestionGroup {
  groupId: string;
  knowledge: KnowledgeUnit;
  difficulty: number;            // 0-5，控制出题
  questions: SubQuestion[];

  validate(): boolean;           // 校验数量限制
}

// ============ 子问题（v2.1 重大修订）============
interface SubQuestion {
  questionId: string;
  type: AnswerMode;
  description: string;
  hint?: string;
  expectedAnswer: ExpectedAnswer;
  dependsOn?: string[];          // 依赖的其他问题ID

  // ✅ 新增：绑定到认知节点
  nodeId: string;                // 绑定的认知节点ID（必需）
  nodeWeight: number;            // 该问题在节点中的权重（默认1.0）

  // 题目展示难度
  difficulty: number;            // 0-5，控制出题

  // ❌ v2.0 已删除
  // - difficultyWeight（由 nodeWeight 代替）
  // - coverageFactor（由 nodeId + importance 代替）
  // - cognitiveLevel（装饰字段，已删除）
}

// ============ 节点掌握状态 ============
interface NodeMastery {
  nodeId: string;

  // 掌握程度（0-1）
  level: number;

  // 置信度（0-1，基于尝试次数）
  confidence: number;

  // 时间衰减后的掌握度
  decayedLevel: number;

  // 最近表现
  recentAttempts: Attempt[];

  // 最后尝试时间
  lastAttempt: number;
}

// ============ 学生状态 ============
interface StudentState {
  // 节点级掌握度
  nodeMasteries: Map<string, NodeMastery>;

  // 题目级结果（用于统计）
  questionResults: Map<string, QuestionResult>;

  // 推荐路径（动态生成）
  recommendedPath: string[];
}

// ============ 答题记录 ============
interface QuestionResult {
  questionId: string;
  nodeId: string;                // 绑定的节点ID
  isCorrect: boolean;
  duration: number;
  skipped: boolean;
  timestamp: number;
}
```

### 3.3 依赖关系图（DAG）+ 节点依赖

```
示例：勾股定理应用题

问题级 DAG:
Q1: 判断是否直角三角形 → 绑定节点: pythagoras_recognition_001
        ↓
Q2: 计算 c² → 绑定节点: pythagoras_computation_001
        ↓
Q3: 计算 c → 绑定节点: pythagoras_computation_002
        ↓
Q4: 应用到实际问题 → 绑定节点: pythagoras_application_001

节点级依赖（来自 Cognitive Node Registry）:
recognition_001 → concept_001 → computation_001 → computation_002 → application_001
```

---

## 四、核心模块：诊断决策引擎（v2.1 修订）

### 4.1 Question Scheduler（问题调度器）

```typescript
interface QuestionScheduler {
  pickNext(state: StudentState): NextQuestionDecision;
}

interface NextQuestionDecision {
  action: 'progress' | 'validate' | 'gap_fill' | 'complete';
  questionId?: string;
  reason: string;
}
```

#### 调度策略（基于节点诊断）

```typescript
function pickNext(state: StudentState): NextQuestionDecision {
  // 策略1：检查未掌握的高重要性节点
  const unmasteredHighImportance = findUnmasteredHighImportance(state);
  if (unmasteredHighImportance) {
    return {
      action: 'gap_fill',
      questionId: selectQuestionForNode(unmasteredHighImportance),
      reason: `补问重要节点: ${unmasteredHighImportance}`
    };
  }

  // 策略2：检查未验证的前置节点
  const unvalidatedPrereq = findUnvalidatedPrerequisite(state);
  if (unvalidatedPrereq) {
    return {
      action: 'validate',
      questionId: selectQuestionForNode(unvalidatedPrereq),
      reason: `验证前置节点: ${unvalidatedPrereq}`
    };
  }

  // 策略3：正常推进（动态推荐路径）
  const nextInPath = generateDynamicRecommendedPath(state)[0];
  if (nextInPath) {
    return {
      action: 'progress',
      questionId: nextInPath,
      reason: '继续推荐路径'
    };
  }

  return { action: 'complete', reason: '所有节点已验证' };
}
```

### 4.2 启发式信息增益（v2.1 降级版）

**重要变更**：从"伪贝叶斯"降级为"启发式"

```typescript
// ❌ v2.0 伪实现（避免）
// informationGain = uncertainty - expectedPosteriorUncertainty

// ✅ v2.1 启发式实现
function heuristicGain(
  state: StudentState,
  nodeId: string,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const node = nodeRegistry.get(nodeId)!;
  const mastery = state.nodeMasteries.get(nodeId);

  // 如果已掌握（level > 0.8），增益低
  if (mastery && mastery.decayedLevel > 0.8) {
    return 0.1;
  }

  // 如果未掌握且重要，增益高
  const importance = node.importance;
  const uncertainty = mastery ? (1 - mastery.confidence) : 1.0;

  // 启发式公式（不是AI，是规则）
  return uncertainty * importance;
}

function shouldTriggerFollowUp(
  state: StudentState,
  nodeId: string,
  threshold: number = 0.5
): boolean {
  return heuristicGain(state, nodeId) > threshold;
}
```

### 4.3 依赖惩罚机制（v2.1 新增）

**问题**：如果前置节点未掌握，后续节点的正确性不可信

```typescript
function calculateNodeMasteryWithPenalty(
  nodeId: string,
  allMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): NodeMastery {
  const baseMastery = allMasteries.get(nodeId)!;
  const node = nodeRegistry.get(nodeId)!;

  // 检查前置节点
  let penalty = 1.0;
  for (const prereqId of node.prerequisites) {
    const prereqMastery = allMasteries.get(prereqId);
    if (!prereqMastery || prereqMastery.decayedLevel < 0.7) {
      // 前置节点未掌握，降低置信度
      penalty *= 0.7;
    }
  }

  return {
    ...baseMastery,
    level: baseMastery.level * penalty,      // 应用惩罚
    confidence: baseMastery.confidence * penalty,
  };
}
```

### 4.4 掌握度计算（v2.1 修订版）

```typescript
function calculateKnowledgeMastery(
  knowledgeUnit: string,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): KnowledgeMastery {
  const nodes = nodeRegistry.getByKnowledgeUnit(knowledgeUnit);

  // 加权平均（按重要性，考虑依赖惩罚）
  let totalWeight = 0;
  let weightedSum = 0;

  for (const node of nodes) {
    const mastery = calculateNodeMasteryWithPenalty(
      node.id,
      nodeMasteries,
      nodeRegistry
    );

    if (mastery.confidence > 0.5) {  // 只计算有足够置信度的
      weightedSum += mastery.decayedLevel * node.importance;
      totalWeight += node.importance;
    }
  }

  const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    knowledgeUnit,
    overall,
    nodes: nodeMasteries,
    diagnosis: diagnoseKnowledgeState(overall, nodeMasteries, nodes),
    recommended: generateRecommendations(nodeMasteries, nodes),
  };
}
```

### 4.5 时间衰减（v2.1 新增）

```typescript
function applyTimeDecay(mastery: NodeMastery, now: number): NodeMastery {
  const daysSinceLastAttempt = (now - mastery.lastAttempt) / (1000 * 60 * 60 * 24);

  // 指数衰减，半衰期10天
  const decayFactor = Math.exp(-0.069 * daysSinceLastAttempt);  // ln(0.5)/10 ≈ -0.069

  return {
    ...mastery,
    decayedLevel: mastery.level * decayFactor,
  };
}
```

---

## 五、动态推荐路径（v2.1 修订）

### 5.1 推荐路径生成（动态，非固定）

```typescript
function generateDynamicRecommendedPath(
  state: StudentState,
  nodeRegistry: CognitiveNodeRegistry
): string[] {
  const path: string[] = [];

  // 获取当前知识点的所有节点
  const nodes = nodeRegistry.getByKnowledgeUnit(state.currentKnowledge);
  
  // 按依赖排序
  const sortedNodes = topologicalSort(nodes);

  // 动态生成：跳过已掌握的节点
  for (const node of sortedNodes) {
    const mastery = state.nodeMasteries.get(node.id);
    
    if (!mastery || mastery.decayedLevel < 0.8) {
      // 未掌握，找对应的问题加入路径
      const questionId = selectQuestionForNode(node.id);
      if (questionId) {
        path.push(questionId);
      }
    }
  }

  return path;
}
```

**关键变化**：
- ✅ 路径是动态生成的，基于当前学生状态
- ✅ 已掌握节点被跳过
- ❌ 不再是固定的 Q1→Q2→Q3

---

## 六、UI/UX 设计

### 6.1 问题卡片 + 节点信息

```
┌─────────────────────────────────────────────┐
│  勾股定理 - 问题 2 / 4                       │
│  节点: 计算平方和 (pythagoras_computation_001)│
├─────────────────────────────────────────────┤
│                                             │
│  在直角三角形中，a=3, b=4，求 a² + b²      │
│                                             │
│  [ 输入框 ]                                 │
│                                             │
│  [ 提交 ]  [ 跳过 ]  [ 查看诊断 → ]         │
└─────────────────────────────────────────────┘
```

### 6.2 节点级进度展示

```
知识点: 勾股定理
掌握度: 75% (置信度: 高)

认知节点进度:
┌─────────────────────────────────────────┐
│ ✓ 识别直角三角形     [掌握]  ████████░░ │
│ ✓ 理解勾股定理       [掌握]  ████████░░ │
│ ○ 计算平方和         [未验证] ░░░░░░░░░░ │
│ ○ 计算平方根         [未验证] ░░░░░░░░░░ │
│ ○ 实际应用           [未验证] ░░░░░░░░░░ │
└─────────────────────────────────────────┘

推荐下一步: 计算平方和
```

---

## 七、实现路线图（v2.1 修订）

### Step 1: 认知节点定义（1周）- 最核心

- [ ] 定义前5个知识点的节点（勾股定理、梯形、四边形等）
- [ ] 实现 CognitiveNodeRegistry
- [ ] 实现节点依赖验证
- [ ] 输出: `cognitive-nodes.json`

### Step 2: 子问题绑定（1周）

- [ ] 更新 SubQuestion 接口（添加 nodeId）
- [ ] 删除旧字段（difficultyWeight, coverageFactor, cognitiveLevel）
- [ ] 迁移现有模板到新结构
- [ ] 实现模板校验工具

### Step 3: 诊断模型（1周）

- [ ] 实现节点掌握度计算（含时间衰减）
- [ ] 实现依赖惩罚机制
- [ ] 实现启发式信息增益
- [ ] 实现动态推荐路径

### Step 4: UI与集成（1周）

- [ ] 节点诊断结果展示
- [ ] 节点级进度可视化
- [ ] 补问推荐UI
- [ ] A/B测试准备

---

## 八、风险与缓解（v2.1 修订）

| 风险 | 缓解措施 | 对应Step |
|------|---------|----------|
| 节点定义不统一 | Cognitive Node Registry + 标准化流程 | Step 1 |
| 节点数量失控 | 每知识点5-10个节点，人工审查 | Step 1 |
| 模板绑定错误 | 模板校验工具 | Step 2 |
| 依赖惩罚过重 | 调整惩罚系数（0.7可调） | Step 3 |
| 时间衰减过快 | 调整半衰期（10天可调） | Step 3 |
| 诊断失真 | 加入一致性指标监控 | Step 4 |

---

## 九、成功指标（v2.1 修订）

### 产品指标

| 指标 | 目标 |
|------|------|
| 学生完成率 | >85% |
| 平均答题时间 | 减少20% |
| 学生满意度 | >4.0/5.0 |

### 系统指标（护城河）

| 指标 | 定义 | 目标 |
|------|------|------|
| **诊断一致性** | 同一学生多次测试节点掌握度的相关系数 | >0.8 |
| **预测能力** | 用节点掌握度预测新题准确率 | >0.75 |
| **节点覆盖率** | 知识点节点被测试的比例 | >90% |

---

## 十、待确认问题（v2.1 修订）

### 节点设计

1. **节点粒度**：每个知识点拆5-10个节点是否合适？
2. **节点标准化**：是否需要建立"节点标准库"供所有模板使用？
3. **节点类型**：5种类型（recognition, concept, computation, application, reasoning）是否足够？

### 参数调优

4. **依赖惩罚系数**：0.7是否合适？（可调参数）
5. **时间衰减半衰期**：10天是否合适？（可调参数）
6. **补问增益阈值**：0.5是否合适？（可调参数）

### 向后兼容

7. **旧模板迁移**：
   - A) 自动1:1映射到默认节点
   - B) 人工审查5个核心模板后批量迁移
   - C) 双轨运行，逐步迁移

---

## 附录：v2.2 主要变更（多节点归因）

| 变更 | 说明 | 理由 |
|------|------|------|
| **多节点归因** | nodeId → nodeContributions[] | 一个题目涉及多个认知节点 |
| **依赖强度** | dependencies.strength: strong/weak | 强依赖：不会必错；弱依赖：可能对 |
| **题目区分度** | 新增 discrimination 参数 | 简单题对置信度提升少 |
| **基于类型的衰减率** | decayRate 基于节点类型 | 不同类型衰减速度不同 |
| **结构影响权重** | heuristicGain 加入 structuralImpact | 影响下游节点多的更重要 |
| **单一认知动作规则** | 节点粒度控制规则 | 防止节点定义失控 |
| **Pattern级诊断** | 认知模式识别（会算不会用等） | 提供洞察而非数据堆 |
| **覆盖唯一性检查** | 模板校验增加节点覆盖唯一性 | 防止重复覆盖同一节点 |

**核心升级**：从 1:1 绑定升级为多节点归因，实现真正的认知诊断。

**关联文档**：
- `2026-04-26-cognitive-node-registry.md`（认知节点注册表）
- `2026-04-26-multi-node-attribution.md`（多节点归因机制）

---

## 附录：v2.1 主要变更

| 变更 | 说明 | 理由 |
|------|------|------|
| 引入 Cognitive Node Registry | 统一认知节点定义 | 解决诊断不可比问题 |
| 删除 cognitiveLevel | 装饰字段，无实际用途 | 避免数据污染 |
| 删除 coverageFactor | 改用 nodeId + importance | 避免主观评分 |
| 新增 nodeId | 子问题绑定到节点 | 实现节点级诊断 |
| 新增 nodeWeight | 问题在节点中的权重 | 替代 difficultyWeight |
| 降级为启发式增益 | 不用伪贝叶斯 | 避免伪AI |
| 新增依赖惩罚 | 前置未掌握，后续打折 | 避免高估 |
| 新增时间衰减 | 考虑遗忘因素 | 提高诊断准确性 |
| 推荐路径改为动态 | 基于学生状态生成 | 避免伪装的步骤 |

---

**文档版本**: v2.2
**最后更新**: 2026-04-26
**审查状态**: 待最终确认
**关联文档**: 
- `2026-04-26-cognitive-node-registry.md`（认知节点注册表）
- `2026-04-26-multi-node-attribution.md`（多节点归因机制）
