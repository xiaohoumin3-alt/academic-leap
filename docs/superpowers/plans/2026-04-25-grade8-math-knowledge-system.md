# 人教版八年级下册数学 - 知识点与模板系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人教版八年级下册数学教材转化为系统可用的知识点和模板，支持25个模板覆盖5章内容。

**Architecture:** 双层架构 - 模板绑定概念层(KnowledgeConcept)，知识点实例(KnowledgePoint)绑定教材章节，换教材只需新建实例。

**Tech Stack:** TypeScript, Prisma, Next.js API Routes, SQLite

---

## 文件结构

```
lib/question-engine/
├── protocol.ts                  # StepType 枚举扩展
├── difficulty.ts                # 难度配置扩展
├── templates/
│   ├── index.ts                 # 模板注册表（更新）
│   ├── pythagoras.ts            # 更新难度配置
│   ├── chapter16/               # 新增目录：二次根式
│   ├── chapter17/               # 新增目录：勾股定理
│   ├── chapter18/               # 新增目录：平行四边形
│   ├── chapter19/               # 新增目录：一元二次方程
│   └── chapter20/               # 新增目录：数据分析
prisma/
├── schema.prisma                # 修改 Template 外键
└── migrations/                  # 数据迁移脚本
scripts/
└── init-pep-grade8-data.ts      # 人教版数据初始化
```

---

## P0: Schema 修改与数据迁移

### Task 1: 修改 Prisma Schema - Template 外键改为 KnowledgeConcept

**Files:**
- Modify: `prisma/schema.prisma:300-320`

- [ ] **Step 1: 修改 Template 模型**

```prisma
// 找到 Template 模型（约第300行）
// 将 knowledge 字段的外键从 KnowledgePoint 改为 KnowledgeConcept

// 修改前：
model Template {
  // ...
  knowledge   KnowledgePoint? @relation(fields: [knowledgeId], references: [id])
  // ...
}

// 修改后：
model Template {
  // ...
  knowledge   KnowledgeConcept? @relation("TemplateConcept", fields: [knowledgeId], references: [id])
  // ...
}
```

- [ ] **Step 2: 运行 prisma migrate**

```bash
npx prisma migrate dev --name change_template_foreign_key_to_concept
```

Expected: 创建迁移文件，修改数据库外键约束

- [ ] **Step 3: 生成 Prisma Client**

```bash
npx prisma generate
```

Expected: 重新生成 Prisma Client，更新类型定义

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "refactor(schema): change Template.knowledgeId foreign key to KnowledgeConcept"
```

### Task 2: 数据迁移 - 现有模板关联到概念层

**Files:**
- Create: `scripts/migrate-template-concepts.ts`

- [ ] **Step 1: 创建迁移脚本**

```typescript
// scripts/migrate-template-concepts.ts
import { prisma } from '@/lib/prisma';

async function main() {
  // 1. 获取所有现有模板
  const templates = await prisma.template.findMany({
    where: { knowledgeId: { not: null } },
    include: { knowledge: true }
  });

  console.log(`Found ${templates.length} templates to migrate`);

  // 2. 为每个模板的知识点创建对应的概念
  for (const template of templates) {
    if (!template.knowledge) continue;

    // 检查是否已有概念
    let concept = await prisma.knowledgeConcept.findUnique({
      where: { id: template.knowledgeId }
    });

    if (!concept) {
      // 创建新概念（从知识点复制）
      concept = await prisma.knowledgeConcept.create({
        data: {
          id: template.knowledgeId,
          name: template.knowledge.name,
          category: '迁移数据',
          weight: template.knowledge.weight || 3
        }
      });
      console.log(`Created concept: ${concept.id}`);
    }

    // 模板已经绑定 knowledgeId，无需更新（外键已指向 Concept）
  }

  console.log('Migration complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 运行迁移脚本**

```bash
npx tsx scripts/migrate-template-concepts.ts
```

Expected: 为现有模板的知识点创建对应的概念记录

- [ ] **Step 3: 验证迁移结果**

```bash
# 检查概念数量
echo "SELECT COUNT(*) FROM KnowledgeConcept;" | sqlite3 prisma/dev.db
```

Expected: 概念数量与之前的知识点数量一致

- [ ] **Step 4: 删除迁移脚本**

```bash
rm scripts/migrate-template-concepts.ts
```

- [ ] **Step 5: 提交**

```bash
git add prisma/dev.db
git commit -m "chore: migrate existing templates to concept layer"
```

---

## P0: StepType 枚举扩展

### Task 3: 扩展 StepType 枚举

**Files:**
- Modify: `lib/question-engine/protocol.ts:10-27`

- [ ] **Step 1: 添加新的 StepType 枚举值**

```typescript
// 在 StepType 枚举中添加以下内容（在现有枚举值之后）：

export enum StepType {
  // ... 现有枚举值保持不变

  // 二次根式
  COMPUTE_SQRT = 'compute_sqrt',
  SIMPLIFY_SQRT = 'simplify_sqrt',
  SQRT_PROPERTY = 'sqrt_property',
  SQRT_MIXED = 'sqrt_mixed',

  // 四边形
  VERIFY_PARALLELOGRAM = 'verify_parallelogram',
  VERIFY_RECTANGLE = 'verify_rectangle',
  VERIFY_RHOMBUS = 'verify_rhombus',
  VERIFY_SQUARE = 'verify_square',
  COMPUTE_RECT_PROPERTY = 'compute_rect_property',
  COMPUTE_RHOMBUS_PROPERTY = 'compute_rhombus_property',
  COMPUTE_SQUARE_PROPERTY = 'compute_square_property',

  // 一元二次方程
  IDENTIFY_QUADRATIC = 'identify_quadratic',
  SOLVE_DIRECT_ROOT = 'solve_direct_root',
  SOLVE_COMPLETE_SQUARE = 'solve_complete_square',
  SOLVE_QUADRATIC_FORMULA = 'solve_quadratic_formula',
  SOLVE_FACTORIZE = 'solve_factorize',
  QUADRATIC_APPLICATION = 'quadratic_application',

  // 数据分析
  COMPUTE_MEAN = 'compute_mean',
  COMPUTE_MEDIAN = 'compute_median',
  COMPUTE_MODE = 'compute_mode',
  COMPUTE_VARIANCE = 'compute_variance',
  COMPUTE_STDDEV = 'compute_stddev',

  // 三角形判定
  VERIFY_RIGHT_ANGLE = 'verify_right_angle',
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add lib/question-engine/protocol.ts
git commit -m "feat(protocol): add StepType enums for grade 8 math templates"
```

---

## P1: 第19章 一元二次方程（7个模板）

### Task 4: 创建一元二次方程模板目录

**Files:**
- Create: `lib/question-engine/templates/chapter19/`

- [ ] **Step 1: 创建 chapter19 目录**

```bash
mkdir -p lib/question-engine/templates/chapter19
```

- [ ] **Step 2: 提交**

```bash
git add lib/question-engine/templates/chapter19/
git commit -m "chore: create chapter19 directory for quadratic equation templates"
```

### Task 5: 实现 quadratic_identify 模板

**Files:**
- Create: `lib/question-engine/templates/chapter19/quadratic_identify.ts`
- Modify: `lib/question-engine/difficulty.ts`
- Modify: `lib/question-engine/templates/index.ts`

- [ ] **Step 1: 创建模板文件**

```typescript
// lib/question-engine/templates/chapter19/quadratic_identify.ts
import { QuestionTemplate, StepType } from '../../protocol';
import { generateRandomParams } from '../../difficulty';

export const QuadraticIdentifyTemplate: QuestionTemplate = {
  id: 'quadratic_identify_v1',
  knowledgePoint: 'quadratic_standard',

  generateParams: (level: number) => {
    const configs = {
      1: { a: { type: 'int', min: 1, max: 1 }, b: { type: 'int', min: -5, max: 5 }, c: { type: 'int', min: -5, max: 5 } },
      2: { a: { type: 'int', min: 1, max: 2 }, b: { type: 'int', min: -8, max: 8 }, c: { type: 'int', min: -8, max: 8 } },
    };
    return generateRandomParams(configs[level] || configs[1]);
  },

  buildSteps: (params) => {
    const { a, b, c } = params;
    return [{
      stepId: 's1',
      type: StepType.IDENTIFY_QUADRATIC,
      inputType: 'numeric',
      keyboard: 'numeric',
      answerType: 'number',
      ui: {
        instruction: '识别一元二次方程的标准形式 ax² + bx + c = 0，指出二次项系数 a',
        inputTarget: '二次项系数 a',
        inputHint: '输入数字',
      },
    }];
  },

  render: (params) => {
    const { a, b, c } = params;
    const bStr = b >= 0 ? `+ ${b}x` : `${b}x`;
    const cStr = c >= 0 ? `+ ${c}` : c;
    return {
      title: `方程 ${a}x² ${bStr} ${cStr} = 0 的二次项系数是多少？`,
      description: '一元二次方程标准式',
      context: '一元二次方程标准形式：ax² + bx + c = 0（a ≠ 0）',
    };
  },
};
```

- [ ] **Step 2: 添加难度配置**

```typescript
// 在 lib/question-engine/difficulty.ts 的 DIFFICULTY_CONFIG 中添加：

  // 一元二次方程-识别
  quadratic_identify: {
    1: { a: { type: 'int', min: 1, max: 1 }, b: { type: 'int', min: -5, max: 5 }, c: { type: 'int', min: -5, max: 5 } },
    2: { a: { type: 'int', min: 1, max: 2 }, b: { type: 'int', min: -8, max: 8 }, c: { type: 'int', min: -8, max: 8 } },
  },
```

- [ ] **Step 3: 注册模板**

```typescript
// 在 lib/question-engine/templates/index.ts 中：
import { QuadraticIdentifyTemplate } from './chapter19/quadratic_identify';

export const TEMPLATE_REGISTRY: Record<string, QuestionTemplate> = {
  // ... 现有模板
  quadratic_identify: QuadraticIdentifyTemplate,
};
```

- [ ] **Step 4: 类型检查**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add lib/question-engine/templates/chapter19/quadratic_identify.ts lib/question-engine/difficulty.ts lib/question-engine/templates/index.ts
git commit -m "feat(template): add quadratic_identify template"
```

### Task 6: 实现 quadratic_direct_root 模板

**Files:**
- Create: `lib/question-engine/templates/chapter19/quadratic_direct_root.ts`
- Modify: `lib/question-engine/difficulty.ts`
- Modify: `lib/question-engine/templates/index.ts`

- [ ] **Step 1: 创建模板文件**

```typescript
// lib/question-engine/templates/chapter19/quadratic_direct_root.ts
import { QuestionTemplate, StepType } from '../../protocol';
import { generateRandomParams, formatSigned } from '../../difficulty';

export const QuadraticDirectRootTemplate: QuestionTemplate = {
  id: 'quadratic_direct_root_v1',
  knowledgePoint: 'solve_direct_root',

  generateParams: (level: number) => {
    const configs = {
      1: { a: { type: 'int', min: 1, max: 1 }, c: { type: 'int', min: 1, max: 16 } },
      2: { a: { type: 'int', min: 1, max: 3 }, c: { type: 'int', min: 1, max: 25 } },
      3: { a: { type: 'int', min: 1, max: 4 }, c: { type: 'int', min: 1, max: 36 } },
    };
    return generateRandomParams(configs[level] || configs[1]);
  },

  buildSteps: (params) => {
    return [{
      stepId: 's1',
      type: StepType.SOLVE_DIRECT_ROOT,
      inputType: 'numeric',
      keyboard: 'numeric',
      answerType: 'number',
      tolerance: 0.01,
      ui: {
        instruction: '用直接开平方法求解方程',
        inputTarget: '方程的解',
        inputHint: '输入正数解（如果有两个解，输入较大的）',
      },
    }];
  },

  render: (params) => {
    const { a, c } = params;
    const cStr = c > 0 ? `${c} = 0` : `${c} = 0`;
    return {
      title: `解方程：${a}x² ${cStr}`,
      description: '直接开平方法',
      context: '直接开平方法：将方程化为 x² = a 的形式，然后开方',
    };
  },
};
```

- [ ] **Step 2-5: 同 Task 5，添加配置、注册、检查、提交**

（省略重复步骤，后续模板按同样流程）

### Task 7-10: 实现其余一元二次方程模板

按以下顺序实现，每个模板一个任务：
- quadratic_complete_square（4步，配方法）
- quadratic_formula（3步，公式法）
- quadratic_factorize（2步，因式分解法）
- quadratic_area（3步，面积应用）
- quadratic_growth（3步，增长率应用）

---

## P2: 第20章 数据分析（3个模板）

### Task 11: 创建数据分析模板目录

**Files:**
- Create: `lib/question-engine/templates/chapter20/`

### Task 12: 实现 central_tendency 模板

**Files:**
- Create: `lib/question-engine/templates/chapter20/central_tendency.ts`

```typescript
import { QuestionTemplate, StepType } from '../../protocol';
import { generateRandomParams } from '../../difficulty';

export const CentralTendencyTemplate: QuestionTemplate = {
  id: 'central_tendency_v1',
  knowledgePoint: 'central_tendency',

  generateParams: (level: number) => {
    const configs = {
      1: {
        type: { type: 'int', min: 1, max: 1 }, // 1=mean, 2=median, 3=mode
        count: { type: 'int', min: 3, max: 5 },
        min: { type: 'int', min: 1, max: 10 },
        max: { type: 'int', min: 11, max: 20 },
      },
      2: {
        type: { type: 'int', min: 1, max: 3 },
        count: { type: 'int', min: 5, max: 8 },
        min: { type: 'int', min: 1, max: 20 },
        max: { type: 'int', min: 21, max: 50 },
      },
    };
    return generateRandomParams(configs[level] || configs[1]);
  },

  buildSteps: (params) => {
    const typeNames = ['平均数', '中位数', '众数'];
    const typeName = typeNames[(params.type as number) - 1];
    const stepTypes = [StepType.COMPUTE_MEAN, StepType.COMPUTE_MEDIAN, StepType.COMPUTE_MODE];
    
    return [{
      stepId: 's1',
      type: stepTypes[(params.type as number) - 1],
      inputType: 'numeric',
      keyboard: 'numeric',
      answerType: 'number',
      tolerance: 0.01,
      ui: {
        instruction: `计算这组数据的${typeName}`,
        inputTarget: `${typeName}的值`,
        inputHint: '输入数字（保留两位小数）',
      },
    }];
  },

  render: (params) => {
    const typeNames = ['平均数', '中位数', '众数'];
    const typeName = typeNames[(params.type as number) - 1];
    
    // 生成随机数据
    const data: number[] = [];
    for (let i = 0; i < params.count; i++) {
      data.push(Math.floor(Math.random() * (params.max - params.min + 1)) + params.min);
    }
    
    return {
      title: `数据组：${data.join(', ')}，求${typeName}`,
      description: '集中趋势量',
      context: `平均数=总和/数量，中位数=排序后中间值，众数=出现次数最多的值`,
    };
  },
};
```

### Task 13-14: 实现 data_variance 和 data_stddev 模板

---

## P3: 第16章 二次根式（6个模板）

### Task 15: 创建二次根式模板目录

**Files:**
- Create: `lib/question-engine/templates/chapter16/`

### Task 16-21: 实现6个二次根式模板

按顺序实现：
- sqrt_concept（二次根式有意义的条件）
- sqrt_simplify（最简二次根式化简）
- sqrt_property（√(a²)=|a|性质）
- sqrt_multiply（乘法法则）
- sqrt_divide（除法法则）
- sqrt_add_subtract（加减混合运算，2步）

---

## P4: 第18章 平行四边形（8个模板）

### Task 22: 创建平行四边形模板目录

**Files:**
- Create: `lib/question-engine/templates/chapter18/`

### Task 23-30: 实现8个四边形模板

按顺序实现：
- parallelogram_verify（平行四边形判定，3步）
- rectangle_property（矩形性质计算，2步）
- rectangle_verify（矩形判定，3步）
- rhombus_property（菱形性质计算，2步）
- rhombus_verify（菱形判定，3步）
- square_property（正方形性质计算，2步）
- square_verify（正方形判定，3步）

---

## P5: 第17章 勾股定理新增（2个模板）

### Task 31: 更新 pythagoras 模板难度配置

**Files:**
- Modify: `lib/question-engine/difficulty.ts:83-104`

- [ ] **Step 1: 更新难度配置**

```typescript
// 将 pythagoras 难度配置扩展到5个级别：
  pythagoras: {
    1: { a: { type: 'int', min: 3, max: 6 }, b: { type: 'int', min: 4, max: 8 } },
    2: { a: { type: 'int', min: 3, max: 8 }, b: { type: 'int', min: 4, max: 10 } },
    3: { a: { type: 'int', min: 3, max: 10 }, b: { type: 'int', min: 4, max: 12 } },
    4: { a: { type: 'int', min: 3, max: 12 }, b: { type: 'int', min: 4, max: 15 } },
    5: { a: { type: 'int', min: 3, max: 15 }, b: { type: 'int', min: 4, max: 18 } },
  },
```

### Task 32: 实现 pythagoras_folding 模板

**Files:**
- Create: `lib/question-engine/templates/chapter17/pythagoras_folding.ts`

```typescript
import { QuestionTemplate, StepType } from '../../protocol';
import { generateRandomParams } from '../../difficulty';

export const PythagorasFoldingTemplate: QuestionTemplate = {
  id: 'pythagoras_folding_v1',
  knowledgePoint: 'pythagoras_folding',

  generateParams: (level: number) => {
    const configs = {
      1: { side: { type: 'int', min: 8, max: 12 }, fold: { type: 'int', min: 2, max: 4 } },
      2: { side: { type: 'int', min: 10, max: 16 }, fold: { type: 'int', min: 2, max: 6 } },
      3: { side: { type: 'int', min: 12, max: 20 }, fold: { type: 'int', min: 3, max: 8 } },
    };
    return generateRandomParams(configs[level] || configs[1]);
  },

  buildSteps: (params) => {
    const { side, fold } = params;
    const remaining = side - fold;
    
    return [
      {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.001,
        ui: {
          instruction: '根据折叠形成的直角三角形，求斜边的平方',
          inputTarget: '斜边的平方',
          inputHint: '输入数字',
        },
      },
      {
        stepId: 's2',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '求斜边长度（保留两位小数）',
          inputTarget: '斜边长度',
          inputHint: '输入数字，保留两位小数',
        },
      },
    ];
  },

  render: (params) => {
    const { side, fold } = params;
    return {
      title: `一张边长为 ${side} cm 的正方形纸片，沿一边折叠，折叠部分宽度为 ${fold} cm，求折痕的长度`,
      description: '勾股定理折叠问题',
      context: '折叠后形成的直角三角形，两直角边分别为折痕到边的距离和折叠部分的宽度',
    };
  },
};
```

### Task 33: 实现 triangle_verify 模板

**Files:**
- Create: `lib/question-engine/templates/chapter17/triangle_verify.ts`

```typescript
import { QuestionTemplate, StepType } from '../../protocol';
import { generateRandomParams } from '../../difficulty';

export const TriangleVerifyTemplate: QuestionTemplate = {
  id: 'triangle_verify_v1',
  knowledgePoint: 'right_triangle_verify',

  generateParams: (level: number) => {
    // 使用勾股数生成直角三角形
    const pythagoreanTriples = [
      [3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17],
      [7, 24, 25], [9, 12, 15], [10, 24, 26], [12, 16, 20]
    ];
    const triple = pythagoreanTriples[Math.floor(Math.random() * pythagoreanTriples.length)];
    
    return {
      a: triple[0],
      b: triple[1],
      c: triple[2],
      isRight: Math.random() > 0.3, // 70% 概率是直角三角形
    };
  },

  buildSteps: (params) => {
    return [{
      stepId: 's1',
      type: StepType.VERIFY_RIGHT_ANGLE,
      inputType: 'numeric',
      keyboard: 'numeric',
      answerType: 'number',
      ui: {
        instruction: '验证三条边是否构成直角三角形（输入1=是，0=否）',
        inputTarget: '是否为直角三角形',
        inputHint: '输入1或0',
      },
    }];
  },

  render: (params) => {
    const { a, b, c, isRight } = params;
    const sides = [a, b, c].sort((x, y) => x - y);
    const actualIsRight = (sides[0] ** 2 + sides[1] ** 2) === sides[2] ** 2;
    
    return {
      title: `三角形三边长分别为 ${a}, ${b}, ${c}，是否为直角三角形？`,
      description: '勾股定理逆定理',
      context: '如果三角形三边满足 a² + b² = c²，则它是直角三角形',
    };
  },
};
```

---

## 数据初始化

### Task 34: 创建人教版数据初始化脚本

**Files:**
- Create: `scripts/init-pep-grade8-data.ts`

- [ ] **Step 1: 创建初始化脚本**

```typescript
// scripts/init-pep-grade8-data.ts
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('开始初始化人教版八年级下册数据...');

  // 1. 创建教材版本
  const textbook = await prisma.textbookVersion.upsert({
    where: { grade_subject_name: { grade: 8, subject: '数学', name: '人教版' } },
    update: {},
    create: {
      name: '人教版',
      publisher: '人民教育出版社',
      grade: 8,
      subject: '数学',
      year: '2024版',
      status: 'active',
    }
  });
  console.log('教材版本创建完成:', textbook.id);

  // 2. 创建章节结构
  const chapters = await createChapters(textbook.id);
  
  // 3. 创建概念层
  const concepts = await createConcepts();
  
  // 4. 创建知识点实例
  await createKnowledgePoints(chapters, concepts);
  
  console.log('数据初始化完成！');
}

async function createChapters(textbookId: string) {
  const chapterData = [
    // 第十六章
    { chapter: 16, section: 0, name: '第十六章 二次根式' },
    { chapter: 16, section: 1, name: '16.1 二次根式' },
    { chapter: 16, section: 2, name: '16.2 二次根式的乘除' },
    { chapter: 16, section: 3, name: '16.3 二次根式的加减' },
    // 第十七章
    { chapter: 17, section: 0, name: '第十七章 勾股定理' },
    { chapter: 17, section: 1, name: '17.1 勾股定理' },
    { chapter: 17, section: 2, name: '17.2 勾股定理的逆定理' },
    // 第十八章
    { chapter: 18, section: 0, name: '第十八章 平行四边形' },
    { chapter: 18, section: 1, name: '18.1 平行四边形' },
    { chapter: 18, section: 2, name: '18.2 特殊的平行四边形' },
    // 第十九章
    { chapter: 19, section: 0, name: '第十九章 一元二次方程' },
    { chapter: 19, section: 1, name: '19.1 一元二次方程' },
    { chapter: 19, section: 2, name: '19.2 一元二次方程的解法' },
    { chapter: 19, section: 3, name: '19.3 实际问题与一元二次方程' },
    // 第二十章
    { chapter: 20, section: 0, name: '第二十章 数据的分析' },
    { chapter: 20, section: 1, name: '20.1 数据的集中趋势' },
    { chapter: 20, section: 2, name: '20.2 数据的波动程度' },
  ];

  const created = [];
  for (const data of chapterData) {
    const chapter = await prisma.chapter.create({
      data: {
        textbookId,
        chapterNumber: data.chapter,
        chapterName: data.section === 0 ? data.name : '',
        sectionNumber: data.section || null,
        sectionName: data.section > 0 ? data.name : null,
        sort: data.chapter * 10 + (data.section || 0),
      }
    });
    created.push(chapter);
  }
  return created;
}

async function createConcepts() {
  const conceptData = [
    // 二次根式
    { id: 'sqrt_concept', name: '二次根式有意义的条件', category: '二次根式', weight: 2 },
    { id: 'sqrt_simplify', name: '最简二次根式', category: '二次根式', weight: 3 },
    { id: 'sqrt_property', name: '二次根式的性质', category: '二次根式', weight: 3 },
    { id: 'sqrt_multiply', name: '二次根式乘法法则', category: '二次根式', weight: 4 },
    { id: 'sqrt_divide', name: '二次根式除法法则', category: '二次根式', weight: 4 },
    { id: 'sqrt_add_subtract', name: '二次根式加减', category: '二次根式', weight: 5 },
    // 勾股定理
    { id: 'pythagoras', name: '勾股定理', category: '几何', weight: 4 },
    { id: 'pythagoras_folding', name: '勾股定理折叠问题', category: '几何', weight: 5 },
    { id: 'right_triangle_verify', name: '勾股定理逆定理', category: '几何', weight: 4 },
    // 平行四边形
    { id: 'parallelogram_verify', name: '平行四边形判定', category: '几何', weight: 4 },
    { id: 'rectangle_property', name: '矩形性质', category: '几何', weight: 3 },
    { id: 'rectangle_verify', name: '矩形判定', category: '几何', weight: 4 },
    { id: 'rhombus_property', name: '菱形性质', category: '几何', weight: 3 },
    { id: 'rhombus_verify', name: '菱形判定', category: '几何', weight: 4 },
    { id: 'square_property', name: '正方形性质', category: '几何', weight: 3 },
    { id: 'square_verify', name: '正方形判定', category: '几何', weight: 4 },
    // 一元二次方程
    { id: 'quadratic_standard', name: '一元二次方程标准式', category: '代数', weight: 2 },
    { id: 'solve_direct_root', name: '直接开平方法', category: '代数', weight: 3 },
    { id: 'solve_complete_square', name: '配方法', category: '代数', weight: 5 },
    { id: 'solve_quadratic_formula', name: '公式法', category: '代数', weight: 4 },
    { id: 'solve_factorize', name: '因式分解法', category: '代数', weight: 4 },
    { id: 'quadratic_area', name: '一元二次方程面积应用', category: '代数', weight: 5 },
    { id: 'quadratic_growth', name: '一元二次方程增长率应用', category: '代数', weight: 5 },
    // 数据分析
    { id: 'central_tendency', name: '集中趋势量', category: '统计', weight: 3 },
    { id: 'data_variance', name: '方差', category: '统计', weight: 4 },
    { id: 'data_stddev', name: '标准差', category: '统计', weight: 4 },
  ];

  const created = [];
  for (const data of conceptData) {
    const concept = await prisma.knowledgeConcept.upsert({
      where: { id: data.id },
      update: {},
      create: data,
    });
    created.push(concept);
  }
  return created;
}

async function createKnowledgePoints(chapters: any[], concepts: any[]) {
  // 第十六章映射
  const ch16_1 = chapters.find(c => c.chapterNumber === 16 && c.sectionNumber === 1);
  const ch16_2 = chapters.find(c => c.chapterNumber === 16 && c.sectionNumber === 2);
  const ch16_3 = chapters.find(c => c.chapterNumber === 16 && c.sectionNumber === 3);
  
  // 第十七章映射
  const ch17_1 = chapters.find(c => c.chapterNumber === 17 && c.sectionNumber === 1);
  const ch17_2 = chapters.find(c => c.chapterNumber === 17 && c.sectionNumber === 2);
  
  // 第十八章映射
  const ch18_1 = chapters.find(c => c.chapterNumber === 18 && c.sectionNumber === 1);
  
  // 第十九章映射
  const ch19_1 = chapters.find(c => c.chapterNumber === 19 && c.sectionNumber === 1);
  const ch19_2 = chapters.find(c => c.chapterNumber === 19 && c.sectionNumber === 2);
  
  // 第二十章映射
  const ch20_1 = chapters.find(c => c.chapterNumber === 20 && c.sectionNumber === 1);
  const ch20_2 = chapters.find(c => c.chapterNumber === 20 && c.sectionNumber === 2);

  const kpData = [
    // 第十六章
    { chapter: ch16_1, concept: 'sqrt_concept', name: '二次根式有意义的条件' },
    { chapter: ch16_1, concept: 'sqrt_simplify', name: '最简二次根式' },
    { chapter: ch16_1, concept: 'sqrt_property', name: '二次根式的性质' },
    { chapter: ch16_2, concept: 'sqrt_multiply', name: '二次根式的乘法' },
    { chapter: ch16_2, concept: 'sqrt_divide', name: '二次根式的除法' },
    { chapter: ch16_3, concept: 'sqrt_add_subtract', name: '二次根式的加减' },
    // 第十七章
    { chapter: ch17_1, concept: 'pythagoras', name: '勾股定理' },
    { chapter: ch17_1, concept: 'pythagoras_folding', name: '勾股定理折叠问题' },
    { chapter: ch17_2, concept: 'right_triangle_verify', name: '勾股定理逆定理' },
    // 第十八章
    { chapter: ch18_1, concept: 'parallelogram_verify', name: '平行四边形判定' },
    { chapter: ch18_1, concept: 'rectangle_property', name: '矩形性质' },
    { chapter: ch18_1, concept: 'rectangle_verify', name: '矩形判定' },
    { chapter: ch18_1, concept: 'rhombus_property', name: '菱形性质' },
    { chapter: ch18_1, concept: 'rhombus_verify', name: '菱形判定' },
    { chapter: ch18_1, concept: 'square_property', name: '正方形性质' },
    { chapter: ch18_1, concept: 'square_verify', name: '正方形判定' },
    // 第十九章
    { chapter: ch19_1, concept: 'quadratic_standard', name: '一元二次方程标准式' },
    { chapter: ch19_2, concept: 'solve_direct_root', name: '直接开平方法' },
    { chapter: ch19_2, concept: 'solve_complete_square', name: '配方法' },
    { chapter: ch19_2, concept: 'solve_quadratic_formula', name: '公式法' },
    { chapter: ch19_2, concept: 'solve_factorize', name: '因式分解法' },
    { chapter: ch19_2, concept: 'quadratic_area', name: '一元二次方程面积应用' },
    { chapter: ch19_2, concept: 'quadratic_growth', name: '一元二次方程增长率应用' },
    // 第二十章
    { chapter: ch20_1, concept: 'central_tendency', name: '平均数/中位数/众数' },
    { chapter: ch20_2, concept: 'data_variance', name: '方差' },
    { chapter: ch20_2, concept: 'data_stddev', name: '标准差' },
  ];

  for (const data of kpData) {
    await prisma.knowledgePoint.upsert({
      where: { id: `${data.chapter.id}_${data.concept}` },
      update: {},
      create: {
        id: `${data.chapter.id}_${data.concept}`,
        chapterId: data.chapter.id,
        conceptId: data.concept,
        name: data.name,
        weight: 0,
        inAssess: true,
        status: 'active',
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: 运行初始化脚本**

```bash
npx tsx scripts/init-pep-grade8-data.ts
```

Expected: 创建教材版本、章节、概念、知识点

- [ ] **Step 3: 验证数据**

```bash
# 检查知识点数量
echo "SELECT COUNT(*) FROM KnowledgePoint WHERE status='active';" | sqlite3 prisma/dev.db
```

Expected: 25个知识点

- [ ] **Step 4: 提交**

```bash
git add scripts/init-pep-grade8-data.ts prisma/dev.db
git commit -m "feat(data): initialize PEP grade 8 math textbook data"
```

---

## 验收测试

### Task 35: 端到端测试

**Files:**
- Create: `scripts/test-grade8-templates.ts`

- [ ] **Step 1: 创建测试脚本**

```typescript
// scripts/test-grade8-templates.ts
import { TEMPLATE_REGISTRY } from '@/lib/question-engine/templates';

async function main() {
  console.log('测试模板注册...\n');

  const templates = [
    'quadratic_identify',
    'quadratic_direct_root',
    'quadratic_complete_square',
    'quadratic_formula',
    'quadratic_factorize',
    'quadratic_area',
    'quadratic_growth',
    'central_tendency',
    'data_variance',
    'data_stddev',
    'sqrt_concept',
    'sqrt_simplify',
    'sqrt_property',
    'sqrt_multiply',
    'sqrt_divide',
    'sqrt_add_subtract',
    'parallelogram_verify',
    'rectangle_property',
    'rectangle_verify',
    'rhombus_property',
    'rhombus_verify',
    'square_property',
    'square_verify',
    'pythagoras_folding',
    'triangle_verify',
  ];

  let passed = 0;
  let failed = 0;

  for (const key of templates) {
    const template = TEMPLATE_REGISTRY[key];
    if (!template) {
      console.log(`❌ ${key}: 未注册`);
      failed++;
      continue;
    }

    try {
      // 测试参数生成
      const params = template.generateParams(1);
      // 测试步骤构建
      const steps = template.buildSteps(params);
      // 测试渲染
      const content = template.render(params);

      if (steps.length === 0) {
        console.log(`❌ ${key}: 无步骤定义`);
        failed++;
      } else {
        console.log(`✅ ${key}: OK`);
        passed++;
      }
    } catch (e) {
      console.log(`❌ ${key}: ${e}`);
      failed++;
    }
  }

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
```

- [ ] **Step 2: 运行测试**

```bash
npx tsx scripts/test-grade8-templates.ts
```

Expected: 25个模板全部通过

- [ ] **Step 3: 删除测试脚本**

```bash
rm scripts/test-grade8-templates.ts
```

---

## 验收标准

- [ ] Schema 修改完成：Template 外键指向 KnowledgeConcept
- [ ] 数据迁移完成：现有数据无丢失
- [ ] 25个模板全部实现并注册
- [ ] 每个模板有完整的难度配置（5级或2-3级）
- [ ] StepType 枚举包含所有新增类型
- [ ] 人教版数据初始化完成（25个知识点）
- [ ] TypeScript 编译无错误
- [ ] 端到端测试通过

---

## 关键参考文件

- 模板接口：`lib/question-engine/protocol.ts:108-124`
- 模板示例：`lib/question-engine/templates/pythagoras.ts`
- 难度配置：`lib/question-engine/difficulty.ts`
- Prisma Schema：`prisma/schema.prisma`
