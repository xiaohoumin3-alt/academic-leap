# QuestionGenerator 设计文档

**日期**: 2026-04-29
**目标**: 生成可控复杂度的题目，验证 ΔC 信号有效性
**知识点**: 一元一次方程（实验级 A + 强化版）

---

## 1. 系统概述

### 1.1 核心目标

构造一个"能力测量空间"，通过生成可控复杂度的题目，让 UOK 推荐系统能形成有效的 ΔC（复杂度变化）信号并收敛。

### 1.2 三轴复杂性定义（Generative Control Space）

```
🔷 STRUCTURE（结构轴）: 题目拓扑结构
  - linear:        ax + b = c
  - nested:        a(x + b) = c
  - multi_equation: { ax + b = c, dx + e = f }
  - constraint_chain: x > a AND x < b AND x + y = c

🔷 DEPTH（推理轴）: 解题步骤长度
  - 1: 直接求解
  - 2: 需要 1 次变换
  - 3: 需要 2 次变换
  - 4+: 需要 3+ 次变换

🔷 DISTRACTION（干扰轴）: 信息污染程度
  - 0: clean（无干扰）
  - 1: noise（额外信息但不误导）
  - 2: misleading structure（误导性结构）
  - 3: adversarial trap（对抗性陷阱）
```

### 1.3 成功标准（三阶段）

```
Stage 0（实验合法性）
  → A: Generator Validity
     三轴 manipulation ≠ noise
     统计检验: p < 0.05

Stage 1（现象存在性）
  → B: Behavioral effect
     complexity ↑ → accuracy ↓（单调变化）
     相关性检验: r < -0.7

Stage 2（理论成立性）
  → C: Model convergence
     UOK / ΔC parameters converge
     prediction error 稳定下降
```

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    输入: ComplexitySpec                      │
│  { STRUCTURE, DEPTH, DISTRACTION }                          │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Controller (路由选择，不影响复杂度)                │
│                                                             │
│  IF STRUCTURE=linear AND DEPTH≤2 → Template Engine          │
│  ELSE → AST Engine                                          │
│                                                             │
│  约束: 输出必须符合 ComplexitySpec，Engine 是实现方式非隐变量   │
└───────────────┬─────────────────────────┬───────────────────┘
                ↓                         ↓
    ┌───────────────────┐     ┌───────────────────┐
    │  Template Engine   │     │   AST Engine       │
    │  预定义模板库        │     │  表达式 AST 组合    │
    │  参数化生成          │     │  结构变换           │
    └─────────┬─────────┘     └─────────┬─────────┘
              ↓                         ↓
              └─────────────┬───────────┘
                            ↓
              ┌─────────────────────────┐
              │  Renderer (Gemma-4-31b)  │
              │  严格文本渲染，不越界      │
              │  只做语言转换，不生成数学  │
              └─────────────┬───────────┘
                            ↓
              ┌─────────────────────────┐
              │   GeneratedQuestion      │
              │   - content              │
              │   - answer               │
              │   - complexitySpec        │
              │   - metadata             │
              └─────────────┬───────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌───────────────────────┐           ┌───────────────────────┐
│   Promotion Pipeline   │           │   UOK Experiment       │
│   (独立流程)            │           │   (独立流程)            │
│                        │           │                        │
│ Stage 0: ΔC gradient   │           │ 使用生成的题目         │
│   - 单调性检验          │           │ 训练 UOK              │
│   - 统计显著性          │           │                       │
│                        │           │ Stage 2: Convergence  │
│ Stage 1: Behavior      │           │   - 参数收敛           │
│   - complexity/acc     │           │   - 预测误差下降        │
│   - 单调相关性          │           │                       │
│                        │           │                       │
│ P(promote) = f(        │           │ 实验结果不影响 Promotion │
│   ΔC, stability, var   │           │                        │
│ )                      │           │                        │
│                        │           │                        │
│ ┌────────┬─────────┐   │           └───────────────────────┘
│ │P>0.95  │0.7-0.95 │   │
│ │auto    │audit    │   │
│ └───┬────┴────┬────┘   │
│     ↓         ↓        │
└─────┼─────────┼────────┘
      ↓         ↓
┌─────────────────────────┐
│     Question            │
│     (生产态)             │
└─────────────────────────┘
```

### 2.2 关键原则

1. **Engine ≠ complexity 隐变量**: Template/AST 只是实现方式，不影响复杂度
2. **Promotion ≠ Model convergence**: 题目质量认证 ≠ 系统训练效果，两者独立
3. **LLM Renderer 严格边界**: 只做文本渲染，绝不生成数学内容

---

## 3. 数据结构设计

### 3.1 ComplexitySpec

```typescript
interface ComplexitySpec {
  // 结构轴
  structure: 'linear' | 'nested' | 'multi_equation' | 'constraint_chain';

  // 推理轴
  depth: 1 | 2 | 3 | 4;

  // 干扰轴
  distraction: 0 | 1 | 2 | 3;
}
```

### 3.2 GeneratedQuestion（实验态）

```prisma
model GeneratedQuestion {
  id          String   @id @default(cuid())
  batchId     String   // 生成批次

  // 题目内容
  type        String   // 'calculation'
  content     String   @default("{}")  // JSON
  answer      String
  hint        String?

  // 复杂度规范（生成目标）
  complexitySpec String  // JSON: ComplexitySpec

  // 生成元数据
  engine      String   // 'template' | 'ast'
  generatedAt DateTime @default(now())

  // 质量指标
  extractionStatus String @default("PENDING")
  extractionError  String?

  // Promotion 状态
  promotionStatus  String @default("PENDING")  // PENDING | PASSED | FAILED | AUDIT
  promotionScore   Float?                     // P(promote)
  promotedAt       DateTime?
  auditReason      String?

  @@index([batchId])
  @@index([promotionStatus])
}
```

### 3.3 Question（生产态，扩展）

```prisma
model Question {
  // ... 现有字段 ...

  // 生成来源
  generatedFrom  String?  // GeneratedQuestion.id
  complexitySpec String?  // 生成时的复杂度规范
}
```

---

## 4. 组件设计

### 4.1 Controller

**职责**: 路由选择，决定用哪个 Engine

```typescript
class GeneratorController {
  decide(spec: ComplexitySpec): GeneratorEngine {
    // 结构优先 + depth 约束
    if (spec.structure === 'linear' && spec.depth <= 2) {
      return new TemplateEngine();
    }
    return new ASTEngine();
  }
}
```

**约束**: 输出必须符合 ComplexitySpec，Engine 不引入额外复杂度

### 4.2 Template Engine

**职责**: 使用预定义模板生成低复杂度题目

```typescript
class TemplateEngine {
  private templates: Map<string, QuestionTemplate>;

  generate(spec: ComplexitySpec): GeneratedQuestion {
    const template = this.getTemplate(spec);
    const params = this.sampleParameters(spec);
    return this.render(template, params);
  }

  private getTemplate(spec: ComplexitySpec): QuestionTemplate {
    // 按 (structure, depth, distraction) 索引
    const key = `${spec.structure}_${spec.depth}_${spec.distraction}`;
    return this.templates.get(key);
  }

  private sampleParameters(spec: ComplexitySpec): Record<string, number> {
    // 确保解的存在性和合理性
    // 例如: a != 0, discriminant >= 0
    return {
      a: randomInt(1, 10),
      b: randomInt(-10, 10),
      c: randomInt(-20, 20),
    };
  }
}
```

**模板示例**:

```typescript
// linear_1_0: ax + b = c, 直接求解
{
  template: "解方程: {a}x {b:+d} = {c}",
  answer: "x = {x}",
  params: { a: "1..10", b: "-10..10", c: "-20..20" },
  constraint: "x = (c - b) / a != 0",
}

// nested_2_1: a(x + b) = c, 需要展开
{
  template: "解方程: {a}(x {b:+d}) = {c}",
  hint: "先展开括号",
  params: { a: "2..5", b: "-5..5", c: "10..30" },
  constraint: "a != 0",
}
```

### 4.3 AST Engine

**职责**: 组合表达式 AST 生成高结构题目

```typescript
type ExprAST =
  | { type: 'const', value: number }
  | { type: 'var', name: string }
  | { type: 'add', left: ExprAST, right: ExprAST }
  | { type: 'sub', left: ExprAST, right: ExprAST }
  | { type: 'mul', left: ExprAST, right: ExprAST }
  | { type: 'div', left: ExprAST, right: ExprAST }
  | { type: 'neg', expr: ExprAST }
  | { type: 'group', expr: ExprAST };

class ASTEngine {
  generate(spec: ComplexitySpec): GeneratedQuestion {
    let ast: ExprAST;

    // 按 STRUCTURE 生成
    switch (spec.structure) {
      case 'nested':
        ast = this.generateNested(spec.depth);
        break;
      case 'multi_equation':
        ast = this.generateMultiEquation(spec.depth);
        break;
      case 'constraint_chain':
        ast = this.generateConstraintChain(spec.depth);
        break;
      default:
        // fallback
        ast = this.generateLinear(spec.depth);
    }

    // 添加 DISTRACTION
    ast = this.addDistraction(ast, spec.distraction);

    // 生成参数（确保可解）
    const params = this.solveAndSample(ast);

    return { ast, params, spec };
  }

  private generateNested(depth: number): ExprAST {
    // a(b(x + c) + d) = e
    // 根据 depth 控制嵌套层数
    let expr: ExprAST = { type: 'var', name: 'x' };

    for (let i = 0; i < depth; i++) {
      expr = {
        type: 'add',
        left: { type: 'mul', left: { type: 'const', value: 1 }, right: expr },
        right: { type: 'const', value: 0 },
      };
    }

    return { type: 'group', expr };
  }

  private addDistraction(ast: ExprAST, level: number): ExprAST {
    if (level === 0) return ast;

    switch (level) {
      case 1:  // noise: 额外信息
        return ast;  // Renderer 会添加
      case 2:  // misleading structure
        // 添加干扰项如 + 0
        return { type: 'add', left: ast, right: { type: 'const', value: 0 } };
      case 3:  // adversarial trap
        // 添加误导性结构
        return { type: 'add', left: ast, right: { type: 'mul', left: ast, right: { type: 'const', value: 0 } } };
      default:
        return ast;
    }
  }
}
```

### 4.4 Renderer (Gemma-4-31b)

**职责**: 纯文本渲染，将 AST/模板转换成自然语言

```typescript
class LLMRenderer {
  private client: Anthropic;  // Gemma-4-31b

  render(input: RenderInput): string {
    const prompt = this.buildPrompt(input);
    const response = await this.client.messages.create({
      model: 'gemma-4-31b-it',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    return this.extractText(response);
  }

  private buildPrompt(input: RenderInput): string {
    if (input.type === 'ast') {
      return `将以下数学表达式转换成题目文本，不要改变任何数学结构：

表达式: ${this.serializeAST(input.ast)}
要求: 纯文本转换，不添加额外内容`;
    } else {
      return `以下是一个数学题模板，填充参数后生成题目文本：

模板: ${input.template}
参数: ${JSON.stringify(input.params)}
要求: 纯文本转换，不添加额外内容`;
    }
  }

  private serializeAST(ast: ExprAST): string {
    // 简单的 AST 序列化
    // { type: 'add', left: { type: 'var', name: 'x' }, right: { type: 'const', value: 3 } }
    // → "x + 3"
    // ...
  }
}
```

**约束**: 严格边界，只做文本转换，不生成数学内容

---

## 5. Promotion Pipeline

### 5.1 三阶段验证

```typescript
class PromotionPipeline {
  async evaluate(question: GeneratedQuestion): Promise<PromotionResult> {
    // Stage 0: Generator Validity
    const stage0 = await this.validateStage0(question);
    if (!stage0.passed) {
      return { status: 'FAILED', reason: 'Stage 0 failed', score: 0 };
    }

    // Stage 1: Behavioral effect
    const stage1 = await this.validateStage1(question);
    if (!stage1.passed) {
      return { status: 'FAILED', reason: 'Stage 1 failed', score: 0 };
    }

    // 计算 Promotion Score
    const score = this.computePromotionScore(stage0, stage1);

    if (score >= 0.95) {
      return { status: 'PASSED', score, action: 'auto_promote' };
    } else if (score >= 0.7) {
      return { status: 'AUDIT', score, action: 'human_review' };
    } else {
      return { status: 'FAILED', score, reason: 'Score below threshold' };
    }
  }

  private async validateStage0(q: GeneratedQuestion): StageResult {
    const spec = JSON.parse(q.complexitySpec);

    // ΔC 单调性检验
    const monotonicity = await this.testMonotonicity(spec);

    // 统计显著性
    const significance = await this.testSignificance(spec);

    return {
      passed: monotonicity.p < 0.05 && significance.p < 0.05,
      metrics: { monotonicity, significance },
    };
  }

  private async validateStage1(q: GeneratedQuestion): StageResult {
    // complexity vs accuracy 相关性
    const correlation = await this.testComplexityAccuracyCorrelation();

    return {
      passed: correlation.r < -0.7 && correlation.p < 0.05,
      metrics: { correlation },
    };
  }

  private computePromotionScore(stage0: StageResult, stage1: StageResult): number {
    // P(promote) = f(ΔC, behavior, stability, variance)
    const w1 = 0.3;  // ΔC 权重
    const w2 = 0.4;  // behavior 权重
    const w3 = 0.2;  // stability 权重
    const w4 = 0.1;  // variance 权重

    return w1 * stage0.score + w2 * stage1.score +
           w3 * this.stability + w4 * (1 - this.variance);
  }
}
```

### 5.2 人工审查（Level 2）

```typescript
class AuditService {
  async selectForAudit(batchId: string): GeneratedQuestion[] {
    // 每 100 题抽 1 题
    const sample1 = await this.randomSample(batchId, 0.01);

    // extreme cases
    const sample2 = await this.extremeCases(batchId);

    return [...sample1, ...sample2];
  }

  async extremeCases(batchId: string): GeneratedQuestion[] {
    // 选取边界情况
    return await prisma.generatedQuestion.findMany({
      where: {
        batchId,
        OR: [
          { promotionScore: { lt: 0.75 } },  // 低分
          { promotionScore: { gte: 0.99 } }, // 高分边界
        ],
      },
      take: 5,
    });
  }
}
```

**人工职责**: 偏差检测器（不是决策者）

---

## 6. UOK 实验（独立流程）

### 6.1 实验设计

```typescript
class UOKExperiment {
  async run(batchId: string): ExperimentResult {
    // 1. 获取生成的题目
    const questions = await prisma.generatedQuestion.findMany({
      where: { batchId, promotionStatus: 'PASSED' },
    });

    // 2. 模拟学生答题
    const results = await this.simulateStudents(questions);

    // 3. 训练 UOK
    const uok = new UOK();
    await this.trainUOK(uok, results);

    // 4. Stage 2: Model convergence
    const convergence = await this.validateConvergence(uok);

    return {
      stage2: convergence,
      metrics: {
        finalLoss: uok.getLoss(),
        transferWeights: uok.getComplexityTransferWeights(),
        predictionError: this.computePredictionError(uok, results),
      },
    };
  }

  private async validateConvergence(uok: UOK): ConvergenceResult {
    // 参数收敛性
    const weights = uok.getComplexityTransferWeights();
    const converged = this.checkWeightsConvergence(weights);

    // 预测误差下降
    const errorHistory = uok.getErrorHistory();
    const decreasing = this.checkErrorDecreasing(errorHistory);

    return {
      passed: converged && decreasing,
      metrics: { weights, errorHistory },
    };
  }
}
```

**注意**: UOK 实验结果不影响 Promotion，两者独立

---

## 7. 实施计划

### Phase 1: 核心生成器 (Day 1-3)
- [ ] 实现 ComplexitySpec 类型
- [ ] 实现 GeneratorController
- [ ] 实现 TemplateEngine（linear + low depth）
- [ ] 实现 ASTEngine（nested + multi_equation）
- [ ] 实现 LLM Renderer（Gemma-4-31b）
- [ ] 单元测试：生成 10 道题，人工验证

### Phase 2: 数据库与存储 (Day 4)
- [ ] 创建 GeneratedQuestion 表
- [ ] 扩展 Question 表（generatedFrom, complexitySpec）
- [ ] 实现批量生成脚本

### Phase 3: Promotion Pipeline (Day 5-6)
- [ ] 实现 Stage 0 验证（ΔC 单调性 + 显著性）
- [ ] 实现 Stage 1 验证（complexity/accuracy 相关性）
- [ ] 实现 Promotion Score 计算
- [ ] 实现自动/人工晋升逻辑

### Phase 4: UOK 实验 (Day 7-8)
- [ ] 实现学生模拟器
- [ ] 实现训练循环
- [ ] 实现 Stage 2 验证（收敛性）
- [ ] 运行完整实验

### Phase 5: 验证与调优 (Day 9-10)
- [ ] 运行 192 道题完整流程
- [ ] 分析 Stage 0/1/2 结果
- [ ] 调优生成参数
- [ ] 文档与交付

---

## 8. 验证清单

### 8.1 生成质量
- [ ] 每道题可解且有唯一解
- [ ] 三轴各水平间有显著差异（p < 0.05）
- [ ] 复杂度单调性成立

### 8.2 Promotion
- [ ] Stage 0 通过率 > 80%
- [ ] Stage 1 通过率 > 70%
- [ ] Promotion Score 分布合理

### 8.3 UOK 实验
- [ ] Stage 2 收敛成立
- [ ] ΔC 权重稳定
- [ ] 预测误差下降

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Gemma-4-31b 不可达 | 阻塞 | 使用 MiniMax 代理或本地部署 |
| 生成题目质量差 | Stage 0/1 失败 | 调优模板和 AST 约束 |
| ΔC 信号弱 | Stage 2 失败 | 扩大三轴范围或增加样本量 |
| UOK 不收敛 | 实验失败 | 检查学习率和数据质量 |

---

## 10. 交付物

1. **代码**
   - `lib/qie/generator/` 目录
   - `lib/qie/generator/controller.ts`
   - `lib/qie/generator/template-engine.ts`
   - `lib/qie/generator/ast-engine.ts`
   - `lib/qie/generator/renderer.ts`
   - `lib/qie/promotion/pipeline.ts`
   - `lib/qie/experiment/uok-runner.ts`

2. **数据**
   - GeneratedQuestion 表
   - 生成的 192 道题目
   - Promotion 结果
   - UOK 实验结果

3. **文档**
   - 本设计文档
   - 实验报告
   - API 文档
