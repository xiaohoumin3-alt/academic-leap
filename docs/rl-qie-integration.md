# RL-QIE 集成设计方案

> **目标**: 让RL推荐引擎驱动QIE动态生成，达成PRODUCT.md核心指标
> **日期**: 2026-04-30
> **状态**: 设计中

## 问题陈述

### 当前架构断点

```
RL推荐引擎(/api/rl/next-question)
    ↓ selectedDeltaC (1-10)
    [断点] 查数据库 → 返回null（题库为空）

QIE生成器(/api/questions/generate)
    ↓ difficulty (1-5) + 随机参数
    生成题目 → 保存（无complexity字段）
```

### 关键约束

1. **必须基于复杂度推荐** - 不能用简单的本地生成
2. **数据库为空** - 需要QIE动态生成
3. **必须达成核心指标** - LE > 15%, CS > 85%, DFI > 99%

## 解决方案

### 架构设计

```
RL推荐 → DeltaC → 映射器 → ComplexitySpec → QIE生成 → 复杂度计算 → 保存 → 返回
                              ↓
                         DFI链路追踪
```

### 1. DeltaC → ComplexitySpec 映射器

**映射规则**：

| DeltaC | 推理深度 | 结构 | 干扰项 | 目标复杂度 |
|--------|----------|------|--------|------------|
| 1-3 | 1 | linear | 0 | 0.2-0.4 |
| 4-6 | 2 | linear/nested | 1 | 0.4-0.6 |
| 7-8 | 2 | nested | 1 | 0.6-0.7 |
| 9-10 | 3 | multi_equation | 2 | 0.7-0.9 |

**映射函数**：

```typescript
// lib/rl/mapping/delta-c-to-complexity.ts

export interface ComplexitySpec {
  reasoningDepth: 1 | 2 | 3;
  structure: 'linear' | 'nested' | 'multi_equation';
  distractors: 0 | 1 | 2;
}

export function deltaCToComplexitySpec(deltaC: number): ComplexitySpec {
  const clamped = Math.max(1, Math.min(10, deltaC));

  if (clamped <= 3) {
    return {
      reasoningDepth: 1,
      structure: 'linear',
      distractors: 0,
    };
  } else if (clamped <= 6) {
    return {
      reasoningDepth: 2,
      structure: clamped <= 5 ? 'linear' : 'nested',
      distractors: 1,
    };
  } else if (clamped <= 8) {
    return {
      reasoningDepth: 2,
      structure: 'nested',
      distractors: 1,
    };
  } else {
    return {
      reasoningDepth: 3,
      structure: 'multi_equation',
      distractors: 2,
    };
  }
}

export function calculateTargetComplexity(deltaC: number): number {
  // DeltaC (1-10) → Complexity (0-1)
  // 使用非线性映射让高难度区分更明显
  const normalized = (deltaC - 1) / 9; // 0-1
  return 0.2 + normalized * 0.7; // 0.2-0.9
}
```

### 2. 复杂度计算函数

**基于ComplexitySpec估算**：

```typescript
// lib/rl/complexity/calculator.ts

export interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}

export function calculateComplexity(
  spec: ComplexitySpec,
  difficulty: number
): QuestionFeatures {
  // 推理深度贡献
  const depthWeight = spec.reasoningDepth / 3;

  // 结构复杂度贡献
  const structureWeight: Record<ComplexitySpec['structure'], number> = {
    linear: 0.3,
    nested: 0.6,
    multi_equation: 1.0,
  };

  // 干扰项贡献
  const distractorWeight = spec.distractors / 2;

  // 综合复杂度 (0-1)
  const complexity = (
    depthWeight * 0.4 +
    structureWeight[spec.structure] * 0.4 +
    distractorWeight * 0.2
  );

  // 认知负荷 (推理深度 + 步骤数估算)
  const cognitiveLoad = complexity * 0.8 + (difficulty / 5) * 0.2;

  return {
    cognitiveLoad,
    reasoningDepth: spec.reasoningDepth,
    complexity: Math.max(0, Math.min(1, complexity)),
  };
}
```

### 3. 集成API端点

**新建** `/api/rl/next-question-with-generation`:

```typescript
// app/api/rl/next-question-with-generation/route.ts

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { knowledgePointId } = await request.json();

  // 1. 获取RL推荐
  const rlResponse = await fetch(`${origin}/api/rl/next-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgePointId }),
  });

  const { selectedDeltaC, theta, recommendationId, preAccuracy } = await rlResponse.json();

  // 2. 转换为ComplexitySpec
  const complexitySpec = deltaCToComplexitySpec(selectedDeltaC);
  const targetComplexity = calculateTargetComplexity(selectedDeltaC);

  // 3. 调用QIE生成
  const generateResponse = await fetch(`${origin}/api/questions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      knowledgePoint: knowledgePointId,
      difficulty: Math.round(selectedDeltaC / 2), // 1-5
      complexitySpec, // 传递复杂度规范
      count: 1,
    }),
  });

  const { questions } = await generateResponse.json();

  // 4. 计算并保存复杂度
  const features = calculateComplexity(complexitySpec, selectedDeltaC / 2);

  await prisma.question.update({
    where: { id: questions[0].id },
    data: {
      complexity: features.complexity,
      cognitiveLoad: features.cognitiveLoad,
      reasoningDepth: features.reasoningDepth,
      complexitySpec: JSON.stringify(complexitySpec),
    },
  });

  // 5. 生成DFI追踪ID
  const eventId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();

  return NextResponse.json({
    question: questions[0],
    features,
    selectedDeltaC,
    targetComplexity,
    theta,
    recommendationId,
    preAccuracy,
    eventId,
    attemptId,
    knowledgePointId,
  });
}
```

### 4. DFI链路追踪

**前端调用流程**：

```typescript
// 1. 获取题目（带DFI ID）
const { question, eventId, attemptId, selectedDeltaC, ... } =
  await fetch('/api/rl/next-question-with-generation', {
    method: 'POST',
    body: JSON.stringify({ knowledgePointId: '二次函数' }),
  }).then(r => r.json());

// 2. 学生答题
const correct = await studentAnswer(question);

// 3. 记录响应（带完整DFI链路）
await fetch('/api/rl/record-response', {
  method: 'POST',
  body: JSON.stringify({
    questionId: question.id,
    correct,
    eventId,      // 链路追踪
    attemptId,    // 链路追踪
    knowledgePointId,
    recommendationId,
    preAccuracy,
    selectedDeltaC,
    responseTimestamp: Date.now(),
  }),
});
```

### 5. 修改生成API支持ComplexitySpec

**更新** `/api/questions/generate` 接收 `complexitySpec` 参数：

```typescript
export async function POST(req: NextRequest) {
  const { knowledgePoint, difficulty, complexitySpec, count } = await req.json();

  // 使用传入的complexitySpec，或基于difficulty生成
  const spec = complexitySpec || defaultComplexitySpec(difficulty);

  // 传递给模板引擎...
}
```

## 实施计划

### Phase 1: 核心集成
1. 创建 `lib/rl/mapping/delta-c-to-complexity.ts`
2. 创建 `lib/rl/complexity/calculator.ts`
3. 新建 `/api/rl/next-question-with-generation/route.ts`
4. 更新 `/api/questions/generate` 支持 complexitySpec

### Phase 2: 前端改造
1. 修改前端调用新的集成API
2. 确保DFI参数正确传递

### Phase 3: 验证
1. 验证 DFI ≥ 0.99
2. 验证 LE > 0.15（需要积累数据）
3. 验证 CS ≥ 0.85

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 复杂度映射不准确 | 迭代优化映射规则 |
| 生成速度慢 | 预生成+缓存 |
| 题目质量不稳定 | LQM Phase 3组件 |
| DFI链路断裂 | 强制校验，CI门禁 |

## 附录：DeltaC到难度等级的映射

当前系统的 `difficulty` 是1-5，RL推荐是1-10。

```typescript
function deltaCToDifficulty(deltaC: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.round(deltaC / 2))) as 1 | 2 | 3 | 4 | 5;
}
```
