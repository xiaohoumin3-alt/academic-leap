# QIE Layer 2: 题目质量控制引擎设计

**日期**: 2026-04-27
**状态**: 设计 v10.0（极限版）
**优先级**: 高

---

## 核心定位

> 一个函数，三件事

```
P(y=1 | student, question, context) = sigmoid(MLP(embedding(x))))
```

**v10.0 原则**：
1. **模型只做学习**：forward + backward + normalize
2. **观测在外部**：calibration / drift / logging 不进设计文档
3. **可独立部署**：核心模型就是一个 .ts 文件

---

## 架构

```
┌─────────────────────────────────────┐
│      核心模型（一个文件，可独立）       │
│  ┌─────────────────────────────────┐ │
│  │  embed: student, question → vec  │ │
│  │  forward: vec → MLP → P          │ │
│  │  update:  (P, y) → ∇θ → θ'       │ │
│  │  normalize: μ=0, σ=1             │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
           ↓
    ┌─────────────────────────────────────┐
    │     外部观测层（非核心，不进文档）      │
    │  - calibration（监控面板看）           │
    │  - drift（告警系统看）                │
    │  - logging（数据库存）                │
    └─────────────────────────────────────┘
```

---

## 核心模型（100 行）

```typescript
// lib/qie/model.ts

/**
 * QIE 核心模型
 *
 * 只做三件事：
 * 1. embed: 学生/题目 → 向量
 * 2. forward: 向量 → 概率
 * 3. update: 反馈 → 参数更新
 *
 * 删掉所有外部依赖，这个文件仍然能工作。
 */
export class QIEModel {
  // Embedding
  private students: Map<string, Float32Array> = new Map();
  private questions: Map<string, Float32Array> = new Map();
  private readonly dim = 32;

  // MLP（单隐藏层）
  private w1: Float32Array;  // [input_dim * hidden]
  private b1: Float32Array;  // [hidden]
  private w2: Float32Array;  // [hidden]
  private b2: number;

  // 超参数
  private lr = 0.01;
  private updateCounter = 0;

  constructor() {
    const inputDim = this.dim * 2 + 3; // student + question + context
    const hidden = 32;

    this.w1 = new Float32Array(inputDim * hidden);
    this.b1 = new Float32Array(hidden);
    this.w2 = new Float32Array(hidden);

    // Xavier 初始化
    const std1 = Math.sqrt(2 / inputDim);
    const std2 = Math.sqrt(2 / hidden);
    for (let i = 0; i < this.w1.length; i++) this.w1[i] = gaussian() * std1;
    for (let i = 0; i < this.w2.length; i++) this.w2[i] = gaussian() * std2;
  }

  /**
   * 预测
   */
  predict(studentId: string, questionId: string, ctx: Context): number {
    const x = this.embed(studentId, questionId, ctx);
    const h = this.relu(this.matmul(x, this.w1, this.b1, 32));
    const z = this.dot(h, this.w2) + this.b2;
    return this.sigmoid(z);
  }

  /**
   * 学习（收到反馈后调用）
   */
  update(studentId: string, questionId: string, ctx: Context, correct: boolean): void {
    // 前向
    const x = this.embed(studentId, questionId, ctx);
    const h1 = this.matmul(x, this.w1, this.b1, 32);
    const h = this.relu(h1);
    const z = this.dot(h, this.w2) + this.b2;
    const p = this.sigmoid(z);

    // 反向
    const y = correct ? 1 : 0;
    const dz = p - y;  // ∂loss/∂z
    const dh = this.reluGrad(h1, this.mul(this.w2, dz));
    const dx = this.mul(this.w1, dh);

    // 更新
    for (let i = 0; i < this.w2.length; i++) this.w2[i] -= this.lr * dz * h[i];
    this.b2 -= this.lr * dz;
    for (let i = 0; i < this.w1.length; i++) this.w1[i] -= this.lr * x[Math.floor(i / 32)] * dh[i % 32];
    for (let i = 0; i < this.b1.length; i++) this.b1[i] -= this.lr * dh[i];

    // 更新 embedding
    this.updateEmbed(this.students, studentId, dx.subarray(0, this.dim));
    this.updateEmbed(this.questions, questionId, dx.subarray(this.dim, this.dim * 2));

    // 定期标准化（每 1000 次更新）
    if (++this.updateCounter % 1000 === 0) this.normalize();
  }

  /**
   * Embedding
   */
  private embed(studentId: string, questionId: string, ctx: Context): Float32Array {
    const s = this.getEmb(this.students, studentId);
    const q = this.getEmb(this.questions, questionId);
    const c = new Float32Array([ctx.difficulty, ctx.complexity, ctx.difficulty * ctx.complexity]);

    const x = new Float32Array(this.dim * 2 + 3);
    x.set(s, 0);
    x.set(q, this.dim);
    x.set(c, this.dim * 2);
    return x;
  }

  private getEmb(map: Map<string, Float32Array>, id: string): Float32Array {
    let emb = map.get(id);
    if (!emb) {
      emb = new Float32Array(this.dim);
      for (let i = 0; i < this.dim; i++) emb[i] = gaussian() * 0.01;
      map.set(id, emb);
    }
    return emb;
  }

  private updateEmbed(map: Map<string, Float32Array>, id: string, grad: Float32Array): void {
    const emb = map.get(id);
    if (emb) {
      for (let i = 0; i < emb.length; i++) emb[i] -= this.lr * grad[i];
    }
  }

  /**
   * 标准化（防止漂移）
   */
  private normalize(): void {
    // 学生 embedding
    const all = Array.from(this.students.values());
    if (all.length > 10) {
      const mu = 0; // 目标均值
      const sigma = 1; // 目标标准差
      const currentMean = mean(all);
      const currentStd = std(all, currentMean);
      for (const emb of all) {
        for (let i = 0; i < emb.length; i++) {
          emb[i] = (emb[i] - currentMean) / currentStd * sigma + mu;
        }
      }
    }
  }

  // 基础算子
  private matmul(x: Float32Array, w: Float32Array, b: Float32Array, outDim: number): Float32Array {
    const out = new Float32Array(outDim);
    for (let j = 0; j < outDim; j++) {
      for (let i = 0; i < x.length; i++) out[j] += x[i] * w[i * outDim + j];
      out[j] += b[j];
    }
    return out;
  }

  private dot(x: Float32Array, y: Float32Array): number {
    let s = 0;
    for (let i = 0; i < x.length; i++) s += x[i] * y[i];
    return s;
  }

  private mul(w: Float32Array, s: number): Float32Array {
    const out = new Float32Array(w.length);
    for (let i = 0; i < w.length; i++) out[i] = w[i] * s;
    return out;
  }

  private relu(x: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = Math.max(0, x[i]);
    return out;
  }

  private reluGrad(x: Float32Array, dy: Float32Array): Float32Array {
    const out = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) out[i] = x[i] > 0 ? dy[i] : 0;
    return out;
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  // 导出/导入（用于版本管理）
  export(): { students: [string, number[]][], questions: [string, number[]][], weights: any } {
    return {
      students: Array.from(this.students).map(([k, v]) => [k, Array.from(v)]),
      questions: Array.from(this.questions).map(([k, v]) => [k, Array.from(v)]),
      weights: {
        w1: Array.from(this.w1),
        b1: Array.from(this.b1),
        w2: Array.from(this.w2),
        b2: this.b2,
      },
    };
  }

  import(params: ReturnType<typeof this.export>): void {
    this.students = new Map(params.students.map(([k, v]) => [k, new Float32Array(v)]));
    this.questions = new Map(params.questions.map(([k, v]) => [k, new Float32Array(v)]));
    this.w1 = new Float32Array(params.weights.w1);
    this.b1 = new Float32Array(params.weights.b1);
    this.w2 = new Float32Array(params.weights.w2);
    this.b2 = params.weights.b2;
  }
}

function gaussian(): number {
  const u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mean(arr: Float32Array[]): number {
  let sum = 0, count = 0;
  for (const a of arr) for (const v of a) sum += v, count++;
  return sum / count;
}

function std(arr: Float32Array[], mu: number): number {
  let sum = 0, count = 0;
  for (const a of arr) for (const v of a) sum += (v - mu) ** 2, count++;
  return Math.sqrt(sum / count);
}

export interface Context {
  difficulty: number;
  complexity: number;
}
```

**代码量**：~100 行

**依赖**：无（纯 TypeScript，无任何 npm 包）

**验证**：
- ✅ 删掉外部观测层，模型仍可学习
- ✅ Float32Array，内存友好
- ✅ 手动梯度，无自动微分依赖

---

## 外部观测层（非核心）

以下内容**不进入设计文档**，由运维/监控系统实现：

### Calibration（温度缩放）
```typescript
// 在 API 层实现，不在模型里
const calibrated = 1 / (1 + Math.exp(-Math.log(p / (1 - p)) / temperature));
```

### Drift（滑动窗口）
```typescript
// 在监控层实现，不在模型里
const recentAcc = last100.reduce((s, e) => s + (e.pred > 0.5) === e.actual, 0) / 100;
```

### Logging（数据库）
```typescript
// 在 API 层实现，不在模型里
await db.insert('predictions', { studentId, questionId, predicted, actual, timestamp });
```

---

## API 设计

```typescript
// api/qie.ts

import { QIEModel } from '$lib/qie/model';

const model = new QIEModel();

export async function POST({ request }: { request: Request }) {
  const { studentId, questionId, context } = await request.json();

  // 预测
  const p = model.predict(studentId, questionId, context);

  // 外部观测（不影响模型）
  await logPrediction(studentId, questionId, p);

  return Response.json({ probability: p });
}

export async function PUT({ request }: { request: Request }) {
  const { studentId, questionId, context, actual } = await request.json();

  // 学习
  model.update(studentId, questionId, context, actual);

  // 外部观测（不影响模型）
  await logFeedback(studentId, questionId, actual);
  checkDrift();

  return Response.json({ ok: true });
}
```

---

## 实施计划

| Phase | 内容 | 时间 |
|-------|------|------|
| 1 | 核心模型（~100 行） | 1 天 |
| 2 | 单元测试 | 0.5 天 |
| 3 | API 集成 | 0.5 天 |
| 4 | 外部观测层（运维） | 1 天 |

**总计：3 天**

---

## 验收标准

### 核心验证
- [ ] 模型文件可独立运行（无外部依赖）
- [ ] 学习循环收敛（loss 下降）
- [ ] 标准化防止漂移

### 质量验证
- [ ] 单元测试覆盖率 > 80%
- [ ] 预测延迟 < 5ms
- [ ] 内存占用 < 100MB（10k 学生，10k 题目）

---

## 设计原则（v10.0）

1. **极简核心**：一个文件，~100 行，无依赖
2. **观测在外部**：calibration / drift / logging 不进模型
3. **可独立部署**：核心模型就是一个 .ts 文件
4. **Float32Array**：内存友好，性能好

---

**文档版本**: v10.0
**状态**: 待审查
**更新日期**: 2026-04-27
**核心变化**: 从 v9.0 的 3 个辅助模块 → 0 个（全部移到外部观测层）
**代码量**: 核心模型 ~100 行
