# 题目难度与复杂度概念统一设计

**状态**：已修复审查问题
**日期**：2026-05-08
**作者**：Claude

## 背景

系统存在难度(difficulty)与复杂度(complexity)相关的技术债务：
1. 概念混乱 —— 不同模块使用不一致的命名
2. 缺少文档 —— 没有地方说明这些概念的关系
3. Deprecated 字段 —— 存在未清理的废弃引用
4. IRT 参数悬空 —— beta_* 定义但未使用

## 术语定义

### 核心概念（保留）

| 术语 | 定义 | 范围 | 用途 |
|------|------|------|------|
| `difficulty` | 题目难度 | 1-12 | 题目生成目标、题库组织、推荐筛选 |
| `cognitiveLoad` | 认知负荷 | 0.0-1.0 | AI 提取，工作记忆占用程度 |
| `reasoningDepth` | 推理深度 | 0.0-1.0 | AI 提取，逻辑推理层次 |

### 生成规范（保留）

```typescript
interface ComplexitySpec {
  reasoningLevel: 1 | 2 | 3;  // 推理深度等级（离散）
  structure: 'linear' | 'nested' | 'multi_equation';  // 结构类型
  distractors: 0 | 1 | 2;  // 干扰项数量
}
```

**说明**：`reasoningLevel` 是生成时的离散目标等级，与 `reasoningDepth` (0.0-1.0 连续值) 是不同概念。

### 删除概念

| 术语 | 删除原因 |
|------|----------|
| `complexity` (Float) | `= 0.5 × cognitiveLoad + 0.5 × reasoningDepth`，无独立信息量 |
| `beta_*` (IRT参数) | 仅定义未使用，暂不实现 |

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         题目数据流                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  生成阶段    │    │   数据库     │    │   推荐阶段   │              │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤              │
│  │ targetLevel  │───▶│ difficulty   │───▶│ difficulty   │              │
│  │  (1-12)     │    │   (1-12)    │    │   范围筛选  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│       ↓                  ↓                    ↓                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │complexitySpec│    │cognitiveLoad │    │  两维度独立  │              │
│  │ (reasoningLevel│  │reasoningDepth│───▶│    权衡     │              │
│  │ +structure  │    │  (连续值)   │    │             │              │
│  │ +distractors│    └──────────────┘    └──────────────┘              │
│  └──────────────┘                                                       │
│       │                                                                │
│       │ complexitySpec → AI 分析 → cognitiveLoad + reasoningDepth      │
│       │   实现位置: lib/rl/mapping/delta-c-to-complexity.ts           │
│       │   函数: complexitySpecToFeatures(spec)                         │
│       ↓                                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**转换逻辑**：
```typescript
// lib/rl/mapping/delta-c-to-complexity.ts
function complexitySpecToFeatures(spec: ComplexitySpec): { cognitiveLoad: number; reasoningDepth: number } {
  return {
    cognitiveLoad: 0.2 + spec.reasoningLevel * 0.2,   // 0.4-0.8
    reasoningDepth: spec.reasoningLevel / 3,             // 0.33-1.0
  };
}
```

## 变更范围

### 1. 数据库 Schema

**文件**：`prisma/schema.prisma`

```diff
model Question {
  id                  String
  type                String
  difficulty          Int
  content             String
  answer              String
  hint                String?
  knowledgePoints     String
  createdBy           String?
  isAI                Boolean
  createdAt           DateTime
  params              String?
  stepTypes           String?
  templateId          String?
  generatedFrom       String?
  complexitySpec      String?
  cognitiveLoad       Float?
  reasoningDepth      Float?
- complexity          Float?      # 删除此行
  extractionStatus    String
  featuresExtractedAt DateTime?
  extractionError     String?
  extractionModel     String?
}
```

### 2. 代码变更清单

#### 2.1 核心类型定义

| 文件 | 行号 | 变更 | 验收标准 |
|------|------|------|----------|
| `lib/qie/types.ts` | 79 | `ComplexitySpec.reasoningDepth` → `reasoningLevel` | tsc --noEmit 通过 |
| `lib/qie/types.ts` | 140 | `QuestionFeatures.complexity` 删除 | tsc --noEmit 通过 |
| `lib/qie/types.ts` | 183 | `ComplexityTransferWeights.complexity` 删除 | tsc --noEmit 通过 |
| `lib/qie/types.ts` | 193 | `ComplexityDelta.complexity` 删除 | tsc --noEmit 通过 |

#### 2.2 核心逻辑

| 文件 | 行号 | 变更 | 验收标准 |
|------|------|------|----------|
| `lib/qie/complexity-extractor.ts` | 65-69 | `ComplexityFeatures.complexity` 删除 | 运行测试通过 |
| `lib/qie/complexity-extractor.ts` | 95-127 | Few-shot 示例移除 complexity | 运行测试通过 |
| `lib/qie/complexity-extractor.ts` | 133,152,168,189,199 | Prompt 移除 complexity 计算 | 手动验证输出 |
| `lib/qie/uok.ts` | 59-63 | `globalTransferWeights.complexity` 删除 | 运行测试通过 |
| `lib/qie/uok.ts` | 245,253,268,504-518,546-555 | 移除 complexity 权重计算 | 运行测试通过 |
| `lib/rl/mapping/delta-c-to-complexity.ts` | 64-68 | 删除 `calculateTargetComplexity()` | tsc --noEmit 通过 |
| `lib/qie/experiment-validator.ts` | 27,126,133,169,198,246,259,343,358,451-461 | 移除 complexity 引用 | 运行测试通过 |

#### 2.3 前端组件

| 文件 | 行号 | 变更 | 验收标准 |
|------|------|------|----------|
| `components/ComplexityBadge.tsx` | 90-96 | 移除 complexity 显示 | 页面正常渲染 |
| `components/admin/ComplexityAdminPanel.tsx` | - | 移除 complexity 统计列 | 页面正常渲染 |

**注意**：`ComplexityOverview.tsx` 文件不存在，跳过此变更。

### 3. 类型定义变更

```diff
// lib/qie/types.ts

interface ComplexitySpec {
- reasoningDepth: 1 | 2 | 3;  // 改为
+ reasoningLevel: 1 | 2 | 3;  // 推理深度等级（生成目标）
  structure: 'linear' | 'nested' | 'multi_equation';
  distractors: 0 | 1 | 2;
}

interface QuestionFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
- complexity: number;    // 删除
  difficulty: number;
}
```

## 数据迁移策略

### 现有数据处理

```sql
-- Prisma 迁移脚本
-- 新增迁移：删除 complexity 字段

ALTER TABLE "Question" DROP COLUMN IF EXISTS "complexity";
```

**风险评估**：
- 现有数据的 `complexity` 值会被删除
- 这些值可以由 `cognitiveLoad` 和 `reasoningDepth` 重新计算
- 迁移前建议备份数据

### 回滚方案

```sql
-- 如需回滚，执行：
ALTER TABLE "Question" ADD COLUMN "complexity" Float;
-- 注意：回滚后数据为空，需重新运行 AI 分析填充
```

## 实施计划

### 阶段 1：数据库迁移

| 步骤 | 操作 | 验证 |
|------|------|------|
| 1.1 | 创建 Prisma 迁移 | `pnpm prisma migrate dev --name remove_complexity` |
| 1.2 | 运行 generate | `pnpm prisma generate` |
| 1.3 | 验证 schema | `npx prisma db pull --force` 确认字段已删除 |

### 阶段 2：核心逻辑

| 步骤 | 操作 | 验证 |
|------|------|------|
| 2.1 | 更新 complexity-extractor.ts | `pnpm test lib/qie/__tests__/complexity-extractor.test.ts` |
| 2.2 | 更新 uok.ts | `pnpm test lib/qie/__tests__/rl-uok-integration.test.ts` |
| 2.3 | 更新 delta-c-to-complexity.ts | `pnpm test lib/rl/mapping/__tests__/delta-c-to-complexity.test.ts` |
| 2.4 | 更新 experiment-validator.ts | `pnpm test lib/qie/__tests__/` |
| 2.5 | 更新 types.ts | `pnpm tsc --noEmit` |
| 2.6 | 全量测试 | `pnpm test` |

### 阶段 3：前端和文档

| 步骤 | 操作 | 验收标准 |
|------|------|----------|
| 3.1 | 更新 ComplexityBadge.tsx | 访问 /admin 页面，complexity badge 不显示 |
| 3.2 | 更新 ComplexityAdminPanel.tsx | complexity 列已移除 |
| 3.3 | 编写文档 | docs/difficulty-complexity.md 存在且完整 |
| 3.4 | 端到端测试 | 题目生成 → AI 分析 → 推荐流程正常 |

## 文档结构

```
docs/
├── difficulty-complexity.md      # 核心概念说明
└── reference/
    ├── generation-flow.md        # 生成流程（ComplexitySpec 如何转换为特征）
    ├── recommendation-flow.md   # 推荐流程
    └── extraction-flow.md        # AI 分析流程
```

## 待确认事项

- [x] 术语定义
- [x] 数据流
- [x] 变更范围
- [x] 实施计划
- [x] 数据迁移策略
- [x] 验收标准

## 后续工作（不在本次范围内）

1. IRT 参数落地（需要数据积累）
2. beta_* 参数实现
3. 推荐引擎的精细化
