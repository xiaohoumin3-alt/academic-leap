# 多节点归因机制设计

**日期**: 2026-04-26
**状态**: 核心机制设计
**依赖**: Question Graph v2.1 + Cognitive Node Registry

---

## 一、问题：1:1 绑定的致命缺陷

### 1.1 当前设计的假设

```typescript
// ❌ 当前假设：一个问题 = 一个认知节点
interface SubQuestion {
  nodeId: string;  // 单节点绑定
}
```

### 1.2 现实情况

**一个题目往往同时涉及多个认知节点**

| 题目类型 | 实际涉及的节点 |
|---------|---------------|
| 选择题 | 可能1个节点 |
| 计算题 | 2-3个节点（识别+计算） |
| 应用题 | 3-5个节点（建模+计算+验证） |

### 1.3 例子：勾股定理应用题

```
题目：梯子靠墙，梯子长5米，底部离墙3米，求梯子顶部离地多高？

学生做错了，系统需要判断：
- 是不会识别直角三角形？
- 是不会计算？
- 是不会建模（把实际问题转成数学模型）？
```

**当前1:1绑定的问题**：只能绑定一个节点，无法区分真正的问题所在。

---

## 二、多节点归因架构

### 2.1 核心概念

**归因（Attribution）**：将答题结果分解到多个认知节点，判断每个节点的贡献。

### 2.2 数据结构（重新设计）

```typescript
// ============ 节点贡献度 ============
interface NodeContribution {
  nodeId: string;
  weight: number;           // 该节点在此题中的权重（0-1）
  required: boolean;        // 是否必需（必需节点失败则整题失败）
}

// ============ 子问题（多节点版本）============
interface SubQuestion {
  questionId: string;
  type: AnswerMode;
  description: string;
  hint?: string;
  expectedAnswer: ExpectedAnswer;
  dependsOn?: string[];

  // ✅ 多节点归因
  nodeContributions: NodeContribution[];  // 涉及的所有节点及其贡献

  // 题目属性
  difficulty: number;        // 0-5，题目难度

  // ✅ 题目区分度（新增）
  discrimination: number;    // 0-1，题目区分能力（区分会与不会的学生）
}

// ============ 节点依赖强度（新增）============
interface NodeDependency {
  nodeId: string;
  prerequisiteId: string;
  strength: 'strong' | 'weak';  // 依赖强度

  // 强依赖：前置不会，必错
  // 弱依赖：前置不会，可能对但不确定
}

// ============ 认知节点（更新版）============
interface CognitiveNode {
  id: string;
  knowledgeUnit: string;
  type: NodeType;
  description: string;

  difficulty: number;        // 节点基础难度
  importance: number;        // 在知识点中的重要性

  // ✅ 依赖强度（不再是简单列表）
  dependencies: NodeDependency[];

  // ✅ 衰减率（基于节点类型）
  decayRate: number;         // 每日衰减率

  // ✅ 结构影响（新增）
  structuralImpact: number;  // 影响的下游节点数（自动计算）

  examples?: string[];
  commonMistakes?: string[];
}

enum NodeType {
  RECOGNITION = 'recognition',
  CONCEPT = 'concept',
  COMPUTATION = 'computation',
  APPLICATION = 'application',
  REASONING = 'reasoning',
}
```

---

## 三、归因计算模型

### 3.1 答题结果归因

```typescript
interface AttributedResult {
  questionId: string;
  isCorrect: boolean;
  nodeId: string;          // 主要节点（用于向后兼容）
  attributions: Map<string, NodeAttribution>;  // 每个节点的归因
}

interface NodeAttribution {
  nodeId: string;
  contribution: number;     // 该节点在答案中的贡献（0-1）
  confidence: number;      // 对该节点掌握的置信度更新
  penalty: number;         // 依赖惩罚因子
  effectiveScore: number;  // 有效得分（考虑惩罚后）
}

// ============ 归因计算 ============
function attributeResult(
  question: SubQuestion,
  result: QuestionResult,
  nodeMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): AttributedResult {
  const attributions = new Map<string, NodeAttribution>();

  for (const contrib of question.nodeContributions) {
    const node = nodeRegistry.get(contrib.nodeId)!;
    const mastery = nodeMasteries.get(contrib.nodeId);

    // 基础贡献：题目难度 × 节点权重
    let baseScore = result.isCorrect ? 1.0 : 0.0;

    // ✅ 考虑题目区分度
    baseScore *= question.discrimination;

    // ✅ 依赖惩罚
    let penalty = 1.0;
    for (const dep of node.dependencies) {
      const prereqMastery = nodeMasteries.get(dep.prerequisiteId);
      if (!prereqMastery || prereqMastery.decayedLevel < 0.7) {
        if (dep.strength === 'strong') {
          // 强依赖：直接压制
          penalty *= 0.3;
        } else {
          // 弱依赖：轻微惩罚
          penalty *= 0.8;
        }
      }
    }

    const effectiveScore = baseScore * penalty * contrib.weight;

    // 置信度更新
    let confidenceUpdate = 0.1 * contrib.weight;
    if (result.isCorrect) {
      confidenceUpdate *= question.discrimination;  // 简单题对置信度提升少
    } else {
      confidenceUpdate *= 0.5;  // 错题对置信度影响大
    }

    attributions.set(contrib.nodeId, {
      nodeId: contrib.nodeId,
      contribution: contrib.weight,
      confidence: confidenceUpdate,
      penalty,
      effectiveScore,
    });
  }

  return {
    questionId: question.questionId,
    isCorrect: result.isCorrect,
    nodeId: question.nodeContributions[0].nodeId,  // 主节点
    attributions,
  };
}
```

### 3.2 节点掌握度更新（多节点归因版）

```typescript
function updateNodeMasteries(
  attributedResults: AttributedResult[],
  currentMasteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): Map<string, NodeMastery> {
  const newMasteries = new Map(currentMasteries);

  for (const result of attributedResults) {
    for (const [nodeId, attribution] of result.attributions) {
      const node = nodeRegistry.get(nodeId)!;
      let mastery = newMasteries.get(nodeId);

      if (!mastery) {
        mastery = {
          nodeId,
          level: 0.5,  // 初始假设
          confidence: 0.1,
          recentAttempts: [],
          lastAttempt: Date.now(),
          decayedLevel: 0.5,
        };
        newMasteries.set(nodeId, mastery);
      }

      // 更新掌握度（指数移动平均）
      const alpha = 0.3;  // 学习率
      const targetLevel = result.isCorrect ? 1.0 : 0.0;

      mastery.level = alpha * targetLevel + (1 - alpha) * mastery.level;
      mastery.confidence = Math.min(1.0, mastery.confidence + attribution.confidence);
      mastery.lastAttempt = Date.now();

      // 应用时间衰减
      mastery.decayedLevel = applyDecay(mastery, node);
    }
  }

  return newMasteries;
}

// ============ 时间衰减（基于节点类型）============
function applyDecay(mastery: NodeMastery, node: CognitiveNode): NodeMastery {
  const now = Date.now();
  const daysSinceLastAttempt = (now - mastery.lastAttempt) / (1000 * 60 * 60 * 24);

  // 基于节点类型的衰减率
  const decayRate = node.decayRate;
  const decayFactor = Math.exp(-decayRate * daysSinceLastAttempt);

  return {
    ...mastery,
    decayedLevel: mastery.level * decayFactor,
  };
}
```

---

## 四、节点粒度控制规则

### 4.1 单一认知动作原则

**每个节点必须满足**：对应一个单一、不可再分的认知动作。

```typescript
interface NodeValidationRule {
  // 必须是单一动作
  isSingleAction(node: CognitiveNode): boolean;

  // 必须是可观测的
  isObservable(node: CognitiveNode): boolean;

  // 必须有明确的输入输出
  hasClearIO(node: CognitiveNode): boolean;
}
```

### 4.2 合法与非法示例

| 节点描述 | 是否合法 | 理由 |
|---------|---------|------|
| 计算两数平方和 | ✅ 合法 | 单一计算动作 |
| 用勾股定理求斜边 | ❌ 非法 | 涉及多个动作（识别+计算） |
| 判断是否直角三角形 | ✅ 合法 | 单一判断动作 |
| 理解勾股定理概念 | ✅ 合法 | 单一理解动作（可通过选择题测） |
| 应用勾股定理解决实际问题 | ❌ 非法 | 太大，需拆分 |

### 4.3 自动校验规则

```typescript
function validateNode(node: CognitiveNode): ValidationResult {
  const errors: string[] = [];

  // 规则1：描述必须包含动词
  if (!hasActionVerb(node.description)) {
    errors.push(`节点 ${node.id} 描述缺少动作动词`);
  }

  // 规则2：不能是组合动作
  if (hasConjunction(node.description)) {
    errors.push(`节点 ${node.id} 描述包含连接词，可能是组合动作`);
  }

  // 规则3：类型必须匹配描述
  if (!typeMatchesDescription(node)) {
    errors.push(`节点 ${node.id} 类型与描述不匹配`);
  }

  return { valid: errors.length === 0, errors };
}

// 辅助函数
function hasActionVerb(description: string): boolean {
  const verbs = ['判断', '计算', '识别', '理解', '应用', '推理', '证明'];
  return verbs.some(v => description.includes(v));
}

function hasConjunction(description: string): boolean {
  const conjunctions = ['和', '与', '并', '然后', '之后', '接着'];
  return conjunctions.some(c => description.includes(c));
}
```

---

## 五、改进的启发式增益（含结构权重）

### 5.1 结构影响计算

```typescript
// 节点注册表维护结构影响
function calculateStructuralImpact(
  nodeId: string,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const node = nodeRegistry.get(nodeId)!;

  // 直接影响的下游节点数
  let downstreamCount = node.dependentNodes.length;

  // 递归计算间接影响
  for (const depId of node.dependentNodes) {
    downstreamCount += calculateStructuralImpact(depId, nodeRegistry);
  }

  return downstreamCount;
}

// 归一化到 [0, 1]
function normalizeStructuralImpact(count: number, maxCount: number): number {
  return Math.min(count / maxCount, 1.0);
}
```

### 5.2 改进的启发式增益

```typescript
function improvedHeuristicGain(
  state: StudentState,
  nodeId: string,
  nodeRegistry: CognitiveNodeRegistry
): number {
  const node = nodeRegistry.get(nodeId)!;
  const mastery = state.nodeMasteries.get(nodeId);

  // 如果已掌握，增益低
  if (mastery && mastery.decayedLevel > 0.8) {
    return 0.1;
  }

  // 三维增益计算
  const importance = node.importance;              // 重要性
  const uncertainty = mastery ? (1 - mastery.confidence) : 1.0;  // 不确定性
  const structuralImpact = node.structuralImpact; // 结构影响

  // 综合增益
  return uncertainty * importance * (1 + structuralImpact);
}
```

---

## 六、Pattern-level 诊断

### 6.1 认知模式识别

```typescript
interface CognitivePattern {
  patternId: string;
  name: string;
  description: string;
  condition: (masteries: Map<string, NodeMastery>) => boolean;
  recommendation: string;
}

// ============ 预定义模式 ============
const COGNITIVE_PATTERNS: CognitivePattern[] = [
  {
    patternId: 'compute_but_no_apply',
    name: '会算不会用',
    description: '计算节点掌握，但应用节点薄弱',
    condition: (masteries) => {
      const computationAvg = averageByType(mastery, 'computation');
      const applicationAvg = averageByType(mastery, 'application');
      return computationAvg > 0.7 && applicationAvg < 0.5;
    },
    recommendation: '增加应用题练习，将计算能力迁移到实际问题',
  },
  {
    patternId: 'recognition_weak',
    name: '识别能力薄弱',
    description: '基础识别节点未掌握',
    condition: (masteries) => {
      const recognitionAvg = averageByType(mastery, 'recognition');
      return recognitionAvg < 0.5;
    },
    recommendation: '巩固基础概念，多做识别类题目',
  },
  {
    patternId: 'strong_foundation_weak_extension',
    name: '基础扎实但延伸不足',
    description: '基础节点掌握，依赖节点薄弱',
    condition: (masteries) => {
      // 检查是否有基础节点强但依赖节点弱的情况
      for (const [nodeId, mastery] of masteries) {
        if (mastery.level > 0.8) {
          const node = nodeRegistry.get(nodeId)!;
          for (const depId of node.dependentNodes) {
            const depMastery = masteries.get(depId);
            if (depMastery && depMastery.level < 0.5) {
              return true;
            }
          }
        }
      }
      return false;
    },
    recommendation: '基础已掌握，尝试更有挑战性的延伸问题',
  },
];

function diagnoseCognitivePattern(
  masteries: Map<string, NodeMastery>,
  nodeRegistry: CognitiveNodeRegistry
): CognitivePattern | null {
  for (const pattern of COGNITIVE_PATTERNS) {
    if (pattern.condition(masteries)) {
      return pattern;
    }
  }
  return null;
}
```

---

## 七、题目模板示例（多节点归因）

### 7.1 勾股定理应用题

```typescript
{
  questionId: 'pyth_app_001',
  type: AnswerMode.NUMBER,
  description: '梯子长5米，底部离墙3米，求顶部离地多高？',
  difficulty: 3,
  discrimination: 0.8,  // 高区分度

  // 多节点归因
  nodeContributions: [
    {
      nodeId: 'pythagoras_recognition_001',  // 识别直角三角形
      weight: 0.2,
      required: true,
    },
    {
      nodeId: 'pythagoras_modeling_001',     // 建模（实际问题→数学模型）
      weight: 0.3,
      required: true,
    },
    {
      nodeId: 'pythagoras_computation_001',  // 计算平方和
      weight: 0.3,
      required: true,
    },
    {
      nodeId: 'pythagoras_computation_002',  // 计算平方根
      weight: 0.2,
      required: false,  // 可选，可能用其他方法
    },
  ],

  expectedAnswer: { type: 'number', value: 4, tolerance: 0.1 },
}
```

### 7.2 答题归因示例

```
学生答案：错误

归因分析：
- recognition_001: 贡献0.2，未掌握（confidence: 0.3）
- modeling_001:   贡献0.3，未掌握（confidence: 0.2）← 主要问题
- computation_001: 贡献0.3，已掌握（confidence: 0.8）
- computation_002: 贡献0.2，已掌握（confidence: 0.7）

诊断：学生会计算，但不会建模
推荐：增加建模类题目练习
```

---

## 八、实现路线图

### Phase 1: 数据结构升级（3天）
- [ ] 更新 SubQuestion 接口（nodeContributions 替代 nodeId）
- [ ] 更新 CognitiveNode 接口（依赖强度、衰减率、结构影响）
- [ ] 实现 AttributedResult

### Phase 2: 归因计算（3天）
- [ ] 实现多节点归因算法
- [ ] 实现依赖惩罚（强/弱）
- [ ] 实现时间衰减（基于节点类型）

### Phase 3: 模式诊断（2天）
- [ ] 实现认知模式识别
- [ ] 实现Pattern-level诊断
- [ ] 实现推荐生成

### Phase 4: 模板迁移（5天）
- [ ] 迁移5个核心模板到多节点归因
- [ ] 实现节点粒度校验工具
- [ ] 实现覆盖唯一性检查

---

## 九、待确认问题

1. **节点贡献度权重**：谁来设定？（A. 模板作者 B. 算法自动 C. 混合）
2. **依赖强度阈值**：强依赖的压制系数（0.3）是否合适？
3. **题目区分度**：如何获取？（A. 专家设定 B. 统计计算 C. IRT模型）
4. **衰减率参数**：
   - RECOGNITION: 0.05
   - CONCEPT: 0.03
   - COMPUTATION: 0.02
   - APPLICATION: 0.08
   - REASONING: 0.1
5. **模式库**：是否需要可扩展的模式定义语言？

---

**文档版本**: v1.0
**最后更新**: 2026-04-26
**状态**: 待审查
