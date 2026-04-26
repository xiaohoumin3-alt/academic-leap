# Cognitive Node Registry 设计

**日期**: 2026-04-26
**状态**: 核心模块设计
**依赖**: Question Graph v2.0

---

## 一、为什么需要 Cognitive Node Registry

### 问题：没有统一节点，诊断不可比

当前问题：
- 同一知识点，不同人拆出不同的"节点"
- 诊断结果不可比较、不可复用、不可累计
- 系统只是"题目系统"，不是真正的"诊断系统"

### 解决方案：Cognitive Node Registry

```
认知节点注册表 = 知识点的"原子化"分解

每个知识点 → 一组标准化的认知节点
每个子问题 → 绑定到具体的认知节点
```

---

## 二、认知节点定义

### 2.1 什么是认知节点

**认知节点（Cognitive Node）**：知识点分解后的最小可诊断单元

**必须满足**：
1. 可观察：学生在此节点的表现可以被测量
2. 可诊断：正确/错误能反映特定的认知状态
3. 可复用：跨题目、跨场景使用
4. 独立性：尽可能减少与其他节点的逻辑依赖

### 2.2 节点类型分类

```typescript
enum CognitiveNodeType {
  // 识别类 - 判断/识别
  RECOGNITION = 'recognition',

  // 概念理解 - 理解定义/性质
  CONCEPT = 'concept',

  // 计算类 - 执行运算
  COMPUTATION = 'computation',

  // 应用类 - 应用到实际问题
  APPLICATION = 'application',

  // 推理类 - 逻辑推理/证明
  REASONING = 'reasoning',
}
```

### 2.3 数据结构

```typescript
interface CognitiveNode {
  // 唯一标识
  id: string;                    // 格式: {knowledge_unit}_{type}_{sequence}
                                // 例如: pythagoras_computation_001

  // 归属
  knowledgeUnit: string;         // 归属知识点，如 "pythagoras"
  chapter: string;               // 归属章节，如 "chapter17"

  // 类型与描述
  type: CognitiveNodeType;
  description: string;           // 人类可读的描述

  // 诊断属性
  difficulty: number;            // 0-1，节点本身的基础难度
  importance: number;            // 0-1，该节点在知识点中的重要性

  // 依赖关系
  prerequisites: string[];       // 前置节点ID列表
  dependentNodes: string[];      // 后续节点ID列表

  // 元数据
  examples?: string[];           // 典型例题
  commonMistakes?: string[];    // 常见错误类型

  // 统计（运行时）
  stats?: {
    attemptCount: number;
    correctRate: number;
    avgTime: number;
  };
}
```

---

## 三、知识点分解示例

### 3.1 勾股定理节点分解

```typescript
const PYTHAGORAS_NODES: CognitiveNode[] = [
  // 1. 识别类节点
  {
    id: 'pythagoras_recognition_001',
    knowledgeUnit: 'pythagoras',
    chapter: 'chapter17',
    type: CognitiveNodeType.RECOGNITION,
    description: '识别直角三角形',
    difficulty: 0.3,
    importance: 0.8,
    prerequisites: [],
    dependentNodes: ['pythagoras_concept_001'],
    examples: ['判断三角形是否为直角三角形'],
    commonMistakes: ['混淆直角与钝角', '忽略直角标识'],
  },

  // 2. 概念理解节点
  {
    id: 'pythagoras_concept_001',
    knowledgeUnit: 'pythagoras',
    chapter: 'chapter17',
    type: CognitiveNodeType.CONCEPT,
    description: '理解勾股定理的内容',
    difficulty: 0.4,
    importance: 0.9,
    prerequisites: ['pythagoras_recognition_001'],
    dependentNodes: ['pythagoras_computation_001'],
    examples: ['陈述勾股定理的内容'],
    commonMistakes: ['记错公式', '混淆直角边与斜边'],
  },

  // 3. 计算类节点 - 求平方和
  {
    id: 'pythagoras_computation_001',
    knowledgeUnit: 'pythagoras',
    chapter: 'chapter17',
    type: CognitiveNodeType.COMPUTATION,
    description: '计算两边的平方和（a² + b²）',
    difficulty: 0.5,
    importance: 0.9,
    prerequisites: ['pythagoras_concept_001'],
    dependentNodes: ['pythagoras_computation_002'],
    examples: ['已知a=3, b=4，求a² + b²'],
    commonMistakes: ['计算错误', '漏掉平方'],
  },

  // 4. 计算类节点 - 开方
  {
    id: 'pythagoras_computation_002',
    knowledgeUnit: 'pythagoras',
    chapter: 'chapter17',
    type: CognitiveNodeType.COMPUTATION,
    description: '计算平方根（√c²）',
    difficulty: 0.6,
    importance: 0.9,
    prerequisites: ['pythagoras_computation_001'],
    dependentNodes: ['pythagoras_application_001'],
    examples: ['已知c²=25，求c'],
    commonMistakes: ['算错平方根', '忽略正负'],
  },

  // 5. 应用类节点
  {
    id: 'pythagoras_application_001',
    knowledgeUnit: 'pythagoras',
    chapter: 'chapter17',
    type: CognitiveNodeType.APPLICATION,
    description: '应用勾股定理解决实际问题',
    difficulty: 0.8,
    importance: 0.7,
    prerequisites: ['pythagoras_computation_002'],
    dependentNodes: [],
    examples: ['梯子靠墙问题', '最短路径问题'],
    commonMistakes: ['建模错误', '单位混淆'],
  },
];
```

### 3.2 节点依赖图

```
识别直角三角形 (recognition_001)
        ↓
理解勾股定理内容 (concept_001)
        ↓
计算平方和 (computation_001)
        ↓
计算平方根 (computation_002)
        ↓
实际应用 (application_001)
```

---

## 四、子问题与节点的绑定

### 4.1 子问题结构更新

```typescript
interface SubQuestion {
  questionId: string;
  type: AnswerMode;
  description: string;
  hint?: string;
  expectedAnswer: ExpectedAnswer;
  dependsOn?: string[];  // 依赖的其他问题ID

  // ❌ 删除（之前的设计）
  // difficultyWeight: number;
  // coverageFactor: number;
  // cognitiveLevel: number;

  // ✅ 新增：绑定到认知节点
  nodeId: string;              // 绑定的认知节点ID
  nodeWeight: number;          // 该问题在节点中的权重（默认1.0）

  // 其他
  difficulty: number;          // 题目展示难度（0-5，控制出题）
}
```

### 4.2 绑定示例

```typescript
// 勾股定理选择题
{
  questionId: 'pyth_q1',
  type: AnswerMode.MULTIPLE_CHOICE,
  description: '在直角三角形中，a=3, b=4，求c',
  nodeId: 'pythagoras_computation_002',  // 绑定到"计算平方根"节点
  nodeWeight: 1.0,
  difficulty: 2,
  expectedAnswer: { type: 'number', value: 5 },
}

// 勾股定理应用题（拆分）
{
  questionId: 'pyth_word_q1',
  type: AnswerMode.YES_NO,
  description: '这个问题可以用勾股定理解决吗？',
  nodeId: 'pythagoras_recognition_001',  // 绑定到"识别"节点
  nodeWeight: 0.5,
  difficulty: 3,
  expectedAnswer: { type: 'boolean', value: true },
}

{
  questionId: 'pyth_word_q2',
  type: AnswerMode.NUMBER,
  description: '列出勾股定理方程（c² = ?）',
  nodeId: 'pythagoras_computation_001',  // 绑定到"计算平方和"节点
  nodeWeight: 0.8,
  difficulty: 3,
  expectedAnswer: { type: 'number', value: 25 },
}

{
  questionId: 'pyth_word_q3',
  type: AnswerMode.NUMBER,
  description: '计算最终答案',
  nodeId: 'pythagoras_application_001',  // 绑定到"应用"节点
  nodeWeight: 1.0,
  difficulty: 3,
  expectedAnswer: { type: 'number', value: 5 },
}
```

---

## 五、节点诊断模型

### 5.1 节点掌握状态

```typescript
interface NodeMastery {
  nodeId: string;

  // 掌握程度（0-1）
  level: number;

  // 置信度（0-1）
  confidence: number;

  // 最近表现
  recentAttempts: {
    timestamp: number;
    correct: boolean;
    questionId: string;
  }[];

  // 时间衰减
  lastAttempt: number;
  decayedLevel: number;  // 考虑遗忘后的掌握度
}

// 计算公式
function calculateNodeMastery(
  attempts: Attempt[],
  node: CognitiveNode
): NodeMastery {
  // 基础正确率
  const correctRate = attempts.filter(a => a.correct).length / attempts.length;

  // 时间衰减（指数衰减）
  const now = Date.now();
  const daysSinceLastAttempt = (now - lastAttempt(attempts)) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.exp(-0.1 * daysSinceLastAttempt);  // 10天衰减到37%

  // 加权最近表现
  const recentWeight = attempts.slice(-5).length / attempts.length;

  const level = correctRate * decayFactor;
  const confidence = Math.min(attempts.length / 10, 1.0);  // 10次尝试达到满置信

  return {
    nodeId: node.id,
    level,
    confidence,
    recentAttempts: attempts.slice(-5),
    lastAttempt: lastAttempt(attempts),
    decayedLevel: level,
  };
}
```

### 5.2 依赖惩罚机制

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
    if (!prereqMastery || prereqMastery.level < 0.7) {
      // 前置节点未掌握，降低置信度
      penalty *= 0.7;
    }
  }

  return {
    ...baseMastery,
    level: baseMastery.level * penalty,  // 应用惩罚
    confidence: baseMastery.confidence * penalty,
  };
}
```

### 5.3 知识点综合掌握度

```typescript
function calculateKnowledgeMastery(
  knowledgeUnit: string,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): KnowledgeMastery {
  const nodes = nodeRegistry.getByKnowledgeUnit(knowledgeUnit);

  // 加权平均（按重要性）
  let totalWeight = 0;
  let weightedSum = 0;

  for (const node of nodes) {
    const mastery = nodeMasteries.get(node.id);
    if (mastery && mastery.confidence > 0.5) {  // 只计算有足够置信度的
      const effectiveLevel = calculateNodeMasteryWithPenalty(
        node.id,
        nodeMasteries,
        nodeRegistry
      ).level;

      weightedSum += effectiveLevel * node.importance;
      totalWeight += node.importance;
    }
  }

  const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // 诊断结果
  const diagnosis = diagnoseKnowledgeState(overall, nodeMasteries, nodes);

  return {
    knowledgeUnit,
    overall,
    nodes: nodeMasteries,
    diagnosis,
    recommended: generateRecommendations(diagnosis, nodes),
  };
}
```

---

## 六、启发式信息增益（简化版）

### 6.1 不使用贝叶斯，使用启发式

```typescript
// ❌ 伪实现（避免）
// informationGain = uncertainty - expectedPosteriorUncertainty

// ✅ 启发式实现
function heuristicGain(
  state: StudentState,
  nodeId: string,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const node = nodeRegistry.get(nodeId)!;
  const currentMastery = state.nodeMasteries.get(nodeId);

  // 如果已掌握，增益低
  if (currentMastery && currentMastery.level > 0.8) {
    return 0.1;
  }

  // 如果未掌握且重要，增益高
  const importance = node.importance;
  const uncertainty = currentMastery ? (1 - currentMastery.confidence) : 1.0;

  return uncertainty * importance;
}
```

### 6.2 补问决策

```typescript
function shouldTriggerFollowUp(
  state: StudentState,
  nodeId: string,
  nodeRegistry: CognitiveNodeRegistry
): boolean {
  const gain = heuristicGain(state, nodeId, nodeRegistry);

  // 简单阈值（不是AI，是规则）
  return gain > 0.5;
}
```

---

## 七、节点注册表管理

### 7.1 注册表结构

```typescript
class CognitiveNodeRegistry {
  private nodes: Map<string, CognitiveNode>;
  private byKnowledgeUnit: Map<string, CognitiveNode[]>;
  private byType: Map<CognitiveNodeType, CognitiveNode[]>;

  constructor() {
    this.nodes = new Map();
    this.byKnowledgeUnit = new Map();
    this.byType = new Map();
  }

  // 注册节点
  register(node: CognitiveNode): void {
    this.nodes.set(node.id, node);

    // 按知识点索引
    if (!this.byKnowledgeUnit.has(node.knowledgeUnit)) {
      this.byKnowledgeUnit.set(node.knowledgeUnit, []);
    }
    this.byKnowledgeUnit.get(node.knowledgeUnit)!.push(node);

    // 按类型索引
    if (!this.byType.has(node.type)) {
      this.byType.set(node.type, []);
    }
    this.byType.get(node.type)!.push(node);
  }

  // 查询
  get(id: string): CognitiveNode | undefined {
    return this.nodes.get(id);
  }

  getByKnowledgeUnit(unit: string): CognitiveNode[] {
    return this.byKnowledgeUnit.get(unit) || [];
  }

  getByType(type: CognitiveNodeType): CognitiveNode[] {
    return this.byType.get(type) || [];
  }

  // 验证节点依赖完整性
  validateDependencies(): ValidationResult {
    const errors: string[] = [];

    for (const [id, node] of this.nodes) {
      for (const prereqId of node.prerequisites) {
        if (!this.nodes.has(prereqId)) {
          errors.push(`节点 ${id} 的前置节点 ${prereqId} 不存在`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
```

### 7.2 初始化节点

```typescript
// 初始化注册表
const registry = new CognitiveNodeRegistry();

// 注册勾股定理节点
PYTHAGORAS_NODES.forEach(node => registry.register(node));

// 验证
const validation = registry.validateDependencies();
if (!validation.valid) {
  console.error('节点依赖验证失败:', validation.errors);
}
```

---

## 八、模板校验工具

### 8.1 子问题节点绑定校验

```typescript
function validateQuestionGroup(
  group: QuestionGroup,
  nodeRegistry: CognitiveNodeRegistry
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查数量限制
  if (group.questions.length > SUB_QUESTION_LIMITS.MAX_PER_GROUP) {
    errors.push(
      `子问题数量 ${group.questions.length} 超过限制 ${SUB_QUESTION_LIMITS.MAX_PER_GROUP}`
    );
  }

  // 检查节点绑定
  for (const q of group.questions) {
    if (!q.nodeId) {
      errors.push(`问题 ${q.questionId} 未绑定认知节点`);
      continue;
    }

    const node = nodeRegistry.get(q.nodeId);
    if (!node) {
      errors.push(`问题 ${q.questionId} 绑定的节点 ${q.nodeId} 不存在`);
      continue;
    }

    // 检查知识点匹配
    if (node.knowledgeUnit !== group.knowledge.id) {
      warnings.push(
        `问题 ${q.questionId} 的节点 ${q.nodeId} 不属于知识点 ${group.knowledge.id}`
      );
    }
  }

  // 检查DAG深度
  const dagDepth = calculateDAGDepth(group.questions);
  if (dagDepth > SUB_QUESTION_LIMITS.DAG_MAX_DEPTH) {
    warnings.push(`DAG深度 ${dagDepth} 超过推荐值 ${SUB_QUESTION_LIMITS.DAG_MAX_DEPTH}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

---

## 九、实现优先级

### Phase 1: 核心节点定义（1周）
- [ ] 定义前5个知识点的节点（勾股定理、梯形、四边形等）
- [ ] 实现 CognitiveNodeRegistry
- [ ] 实现节点依赖验证

### Phase 2: 子问题绑定（1周）
- [ ] 更新 SubQuestion 接口（添加 nodeId）
- [ ] 迁移现有模板到新结构
- [ ] 实现模板校验工具

### Phase 3: 诊断模型（1周）
- [ ] 实现节点掌握度计算
- [ ] 实现依赖惩罚机制
- [ ] 实现启发式信息增益

### Phase 4: UI与集成（1周）
- [ ] 节点诊断结果展示
- [ ] 节点依赖图可视化
- [ ] 补问推荐UI

---

## 十、待确认问题

1. **节点粒度**：每个知识点拆5-10个节点是否合适？
2. **节点标准化**：是否需要建立"节点标准库"供所有模板使用？
3. **衰减参数**：时间衰减的半衰期设为多少天？（建议：10天）
4. **补问阈值**：heuristicGain > 0.5 是否合适？

---

**文档版本**: v1.0
**最后更新**: 2026-04-26
**状态**: 待审查
