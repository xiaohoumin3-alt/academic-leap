# 人教版八年级下册数学 - 知识点与模板系统设计

**日期**: 2026-04-25
**状态**: 设计中

## 概述

将人教版八年级下册数学教材转化为系统可用的知识点和模板，让学生可以直接使用系统进行日常练习和诊断测评。同时设计可扩展架构，支持其他教材版本无需重新设计模板。

**核心原则**：
- 模板绑定概念（抽象层），不绑定具体教材章节
- 知识点是概念的实例（教材相关）
- 换教材只需新建知识点实例，复用现有模板

---

## 架构设计

### 双层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    概念层 (可复用)                          │
│  KnowledgeConcept                                           │
│  - id: "sqrt_multiplication"                               │
│  - name: "二次根式乘法法则"                                 │
│  - category: "二次根式"                                     │
│  - weight: 3                                               │
├─────────────────────────────────────────────────────────────┤
│                    实例层 (教材相关)                        │
│  KnowledgePoint                                             │
│  - id: "pep-ch16-s2-multiply"                              │
│  - conceptId: "sqrt_multiplication"                        │
│  - chapterId: "pep-8th-ch16"                               │
│  - name: "16.2 二次根式的乘法"                              │
├─────────────────────────────────────────────────────────────┤
│                    模板 (绑定概念)                          │
│  Template                                                   │
│  - knowledgeId: "sqrt_multiplication"  ← 绑定概念ID         │
│  - templateKey: "sqrt_multiply"                            │
└─────────────────────────────────────────────────────────────┘
```

### 数据模型关系

```
TextbookVersion (教材)
    ├── Chapter (章/节)
    │     └── KnowledgePoint (知识点实例)
    │             └── conceptId → KnowledgeConcept (概念)
    │                                     └── Template (模板)
```

**关键点**：
- `Template.knowledgeId` 存储 `KnowledgeConcept.id`，不是 `KnowledgePoint.id`
- 换教材时，只需新建 `TextbookVersion` + `Chapter` + `KnowledgePoint`
- `KnowledgeConcept` 和 `Template` 跨教材复用

---

## 教材章节与知识点

### 第十六章 二次根式（6个模板）

| 小节 | 概念ID | 概念名称 | 模板Key | 模板名称 | 步骤 | 难度 |
|------|--------|----------|---------|----------|------|------|
| 16.1 | sqrt_concept | 二次根式定义域 | sqrt_concept | 二次根式有意义的条件 | 1步 | 1-3 |
| 16.1 | sqrt_simplify | 最简二次根式 | sqrt_simplify | 化简最简二次根式 | 1步 | 2-4 |
| 16.1 | sqrt_property | √(a²)=\|a\| | sqrt_property | 二次根式的性质 | 1步 | 2-3 |
| 16.2 | sqrt_multiply | 乘法法则 | sqrt_multiply | 二次根式乘法 | 1步 | 2-4 |
| 16.2 | sqrt_divide | 除法法则 | sqrt_divide | 二次根式除法 | 1步 | 2-4 |
| 16.3 | sqrt_add_subtract | 加减混合运算 | sqrt_add_subtract | 二次根式加减 | 2步 | 3-5 |

### 第十七章 勾股定理（3个模板）

| 小节 | 概念ID | 概念名称 | 模板Key | 模板名称 | 步骤 | 难度 |
|------|--------|----------|---------|----------|------|------|
| 18.1 | pythagoras | 勾股定理 | pythagoras | 已知两边求第三边 | 2步 | 2-4 |
| 18.1 | pythagoras_folding | 折叠问题 | pythagoras_folding | 勾股定理折叠应用 | 3步 | 3-5 |
| 18.2 | right_triangle_verify | 勾股定理逆定理 | triangle_verify | 判定直角三角形 | 2步 | 2-4 |

### 第十八章 平行四边形（8个模板）

| 小节 | 概念ID | 概念名称 | 模板Key | 模板名称 | 步骤 | 难度 |
|------|--------|----------|---------|----------|------|------|
| 19.1 | parallelogram_verify | 平行四边形判定 | parallelogram_verify | 判定平行四边形 | 3步 | 2-4 |
| 19.2 | rectangle_property | 矩形性质 | rectangle_property | 矩形性质计算 | 2步 | 2-4 |
| 19.2 | rectangle_verify | 矩形判定 | rectangle_verify | 判定矩形 | 3步 | 3-5 |
| 19.3 | rhombus_property | 菱形性质 | rhombus_property | 菱形性质计算 | 2步 | 2-4 |
| 19.3 | rhombus_verify | 菱形判定 | rhombus_verify | 判定菱形 | 3步 | 3-5 |
| 19.4 | square_property | 正方形性质 | square_property | 正方形性质计算 | 2步 | 2-4 |
| 19.4 | square_verify | 正方形判定 | square_verify | 判定正方形 | 3步 | 3-5 |

### 第十九章 一元二次方程（7个模板）

| 小节 | 概念ID | 概念名称 | 模板Key | 模板名称 | 步骤 | 难度 |
|------|--------|----------|---------|----------|------|------|
| 21.1 | quadratic_standard | 标准式识别 | quadratic_identify | 识别二次项系数 | 1步 | 1-2 |
| 21.2 | solve_direct_root | 直接开平方法 | quadratic_direct_root | 直接开平方法解方程 | 1步 | 2-3 |
| 21.2 | solve_complete_square | 配方法 | quadratic_complete_square | 配方法解方程 | 4步 | 3-5 |
| 21.2 | solve_quadratic_formula | 公式法 | quadratic_formula | 公式法解方程 | 3步 | 3-5 |
| 21.2 | solve_factorize | 因式分解法 | quadratic_factorize | 因式分解法解方程 | 2步 | 2-4 |
| 21.3 | quadratic_area | 面积应用题 | quadratic_area | 一元二次方程面积应用 | 3步 | 3-5 |
| 21.3 | quadratic_growth | 增长率应用题 | quadratic_growth | 一元二次方程增长率应用 | 3步 | 3-5 |

### 第二十章 数据的分析（3个模板）

| 小节 | 概念ID | 概念名称 | 模板Key | 模板名称 | 步骤 | 难度 |
|------|--------|----------|---------|----------|------|------|
| 20.1 | central_tendency | 集中趋势量 | central_tendency | 平均数/中位数/众数 | 1步 | 1-3 |
| 20.2 | data_variance | 方差 | data_variance | 方差计算 | 2步 | 2-4 |
| 20.2 | data_stddev | 标准差 | data_stddev | 标准差计算 | 1步 | 2-4 |

**合计**: 25个核心概念，25个模板

---

## StepType 枚举扩展

需要在 `lib/question-engine/protocol.ts` 新增：

```typescript
export enum StepType {
  // ... 现有

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

---

## 目录结构

```
lib/question-engine/
├── protocol.ts                  # StepType 枚举扩展
├── difficulty.ts                # 难度配置扩展
├── templates/
│   ├── index.ts                 # 模板注册表（更新）
│   │
│   ├── chapter16/               # 二次根式
│   │   ├── sqrt_concept.ts
│   │   ├── sqrt_simplify.ts
│   │   ├── sqrt_property.ts
│   │   ├── sqrt_multiply.ts
│   │   ├── sqrt_divide.ts
│   │   └── sqrt_add_subtract.ts
│   │
│   ├── chapter17/               # 勾股定理
│   │   ├── pythagoras.ts        # 更新难度配置
│   │   ├── pythagoras_folding.ts
│   │   └── triangle_verify.ts
│   │
│   ├── chapter18/               # 平行四边形
│   │   ├── parallelogram_verify.ts
│   │   ├── rectangle_property.ts
│   │   ├── rectangle_verify.ts
│   │   ├── rhombus_property.ts
│   │   ├── rhombus_verify.ts
│   │   ├── square_property.ts
│   │   └── square_verify.ts
│   │
│   ├── chapter19/               # 一元二次方程
│   │   ├── quadratic_identify.ts
│   │   ├── quadratic_direct_root.ts
│   │   ├── quadratic_complete_square.ts
│   │   ├── quadratic_formula.ts
│   │   ├── quadratic_factorize.ts
│   │   ├── quadratic_area.ts
│   │   └── quadratic_growth.ts
│   │
│   └── chapter20/               # 数据分析
│       ├── central_tendency.ts
│       ├── data_variance.ts
│       └── data_stddev.ts
```

---

## 数据初始化计划

### Phase 1: 人教版八年级下册

**1. 创建教材版本**
```sql
INSERT INTO TextbookVersion (name, publisher, grade, subject, year, status)
VALUES ('人教版', '人民教育出版社', '八年级下册', '数学', 2024, 'ACTIVE');
```

**2. 创建章节结构**
```sql
-- 第十六章
INSERT INTO Chapter (textbookId, chapterNumber, sectionNumber, name) VALUES
('pep-8th', 16, 0, '第十六章 二次根式'),
('pep-8th', 16, 1, '16.1 二次根式'),
('pep-8th', 16, 2, '16.2 二次根式的乘除'),
('pep-8th', 16, 3, '16.3 二次根式的加减');

-- 第十七章~第二十章（类似结构）
```

**3. 创建概念层** (KnowledgeConcept)
```sql
INSERT INTO KnowledgeConcept (id, name, category, weight) VALUES
-- 二次根式
('sqrt_concept', '二次根式有意义的条件', '二次根式', 2),
('sqrt_simplify', '最简二次根式', '二次根式', 3),
('sqrt_property', '二次根式的性质', '二次根式', 3),
('sqrt_multiply', '二次根式乘法法则', '二次根式', 4),
('sqrt_divide', '二次根式除法法则', '二次根式', 4),
('sqrt_add_subtract', '二次根式加减', '二次根式', 5),
-- ... 其他19个概念
```

**4. 创建知识点实例** (KnowledgePoint)
```sql
INSERT INTO KnowledgePoint (chapterId, conceptId, name, weight, inAssessment) VALUES
-- 16.1 二次根式
('pep-16-1', 'sqrt_concept', '二次根式有意义的条件', 2, true),
('pep-16-1', 'sqrt_simplify', '最简二次根式', 3, true),
('pep-16-1', 'sqrt_property', '二次根式的性质', 3, true),
-- 16.2 二次根式的乘除
('pep-16-2', 'sqrt_multiply', '二次根式的乘法', 4, true),
('pep-16-2', 'sqrt_divide', '二次根式的除法', 4, true),
-- ... 其他知识点
```

**5. 配置模板**
```typescript
// templates/index.ts
export const TEMPLATE_REGISTRY: Record<string, QuestionTemplate> = {
  // 绑定概念ID，不绑定具体知识点
  'sqrt_concept': { knowledgePoint: 'sqrt_concept', ... },
  'sqrt_simplify': { knowledgePoint: 'sqrt_simplify', ... },
  // ... 25个模板
};
```

### Phase 2: 北师大版八年级下册（扩展示例）

**1. 创建教材版本**
```sql
INSERT INTO TextbookVersion (name, publisher, grade, subject, year, status)
VALUES ('北师大版', '北京师范大学出版社', '八年级下册', '数学', 2024, 'ACTIVE');
```

**2. 创建北师大章节结构**
```sql
-- 北师大的章节结构与人教版不同
INSERT INTO Chapter (textbookId, chapterNumber, sectionNumber, name) VALUES
('bnup-8th', 1, 0, '第一章 三角形的证明'),
('bnup-8th', 1, 1, '1.1 等腰三角形'),
-- ...
```

**3. 复用现有概念**
```sql
-- 无需新建 KnowledgeConcept
-- 直接使用现有概念：sqrt_concept, sqrt_simplify, ...
```

**4. 创建北师大知识点实例**
```sql
INSERT INTO KnowledgePoint (chapterId, conceptId, name, weight, inAssessment) VALUES
-- 北师大知识点关联相同的概念ID
('bnup-ch3-s1', 'sqrt_multiply', '二次根式的乘法（北师大版）', 4, true),
-- ...
```

**5. 复用现有模板**
```typescript
// 无需修改模板，自动支持北师大版
// 因为模板绑定的是概念ID，不是具体知识点
```

---

## 架构调整

### 唯一需要的修改：Template 外键

**当前状态**：`Template.knowledgeId` → `KnowledgePoint.id`
**目标状态**：`Template.knowledgeId` → `KnowledgeConcept.id`

```prisma
// 修改前
model Template {
  knowledgeId String?
  knowledge   KnowledgePoint? @relation(fields: [knowledgeId], references: [id])
}

// 修改后
model Template {
  knowledgeId String?
  knowledge   KnowledgeConcept? @relation(fields: [knowledgeId], references: [id])
}
```

### 为什么只改这一处？

1. `User.selectedTextbookId` **已存在** - 用户已有教材设置
2. `KnowledgeConcept` **已存在** - 双层架构已有
3. 所有 API 自动继承用户设置 - 无需单独传递参数

**数据流**：
```
用户设置: User.selectedTextbookId → "人教版八下"
         ↓
查询过滤: KnowledgePoint.chapterId → Chapter.textbookId
         ↓
可用知识点: 仅返回人教版八下的知识点实例
         ↓
模板复用: 同一个 KnowledgeConcept 对应多个教材版本
```

### 数据迁移

```sql
-- 1. 修改 Template 外键
-- (具体迁移脚本在实施时创建)
```

---

## 实施批次

| 批次 | 内容 | 优先级 | 说明 |
|------|------|--------|------|
| P0 | Schema 修改 | 最高 | Template 外键改为 KnowledgeConcept |
| P0 | 数据迁移 | 最高 | 迁移现有 Template 关联 |
| P1 | 第19章 一元二次方程 | 高 | 高频考点，7个模板 |
| P2 | 第20章 数据分析 | 高 | 高频考点，3个模板 |
| P3 | 第16章 二次根式 | 中 | 基础知识，6个模板 |
| P4 | 第18章 平行四边形 | 中 | 几何重点，8个模板 |
| P5 | 第17章 勾股定理新增 | 低 | 补充2个模板 |

---

## 验收标准

- [ ] 双层架构实现：模板绑定概念层
- [ ] 25个模板全部实现
- [ ] 每个模板5个难度级别参数正确
- [ ] StepType 枚举扩展完整
- [ ] 人教版数据初始化脚本
- [ ] TypeScript 无编译错误
- [ ] 单元测试覆盖
- [ ] API 验证：可生成各章节题目

---

## 关键参考文件

- 模板接口：`lib/question-engine/protocol.ts:108-124`
- 模板注册：`lib/question-engine/templates/index.ts`
- 难度配置：`lib/question-engine/difficulty.ts`
- 现有模板：`lib/question-engine/templates/pythagoras.ts`
- Prisma Schema：`prisma/schema.prisma`
