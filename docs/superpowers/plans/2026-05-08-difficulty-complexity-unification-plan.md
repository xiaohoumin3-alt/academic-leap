# 实施计划：题目难度与复杂度概念统一

**日期**: 2026-05-08
**状态**: 规划阶段
**文档版本**: 1.0

## 概述

本计划用于执行设计文档中的所有变更，统一题目难度(difficulty)与复杂度(complexity)相关概念，删除无独立信息量的 `complexity` 字段。

## 术语定义

| 术语 | 定义 | 范围 | 状态 |
|------|------|------|------|
| `difficulty` | 题目难度 | 1-12 | 保留 |
| `cognitiveLoad` | 认知负荷 | 0.0-1.0 | 保留 |
| `reasoningDepth` | 推理深度 | 0.0-1.0 | 保留 |
| `reasoningLevel` | 推理深度等级（离散） | 1/2/3 | 重命名（原 reasoningDepth） |
| `complexity` (Float) | 综合复杂度 | 0.0-1.0 | **删除** |

## 变更范围

| 类别 | 文件数 | 主要变更 |
|------|--------|----------|
| 数据库 Schema | 1 | 删除 `complexity` 字段 |
| 类型定义 | 3 | 字段重命名和删除 |
| 核心逻辑 | 6+ | 删除 `complexity` 引用 |
| 前端组件 | 4+ | 删除 `complexity` 显示 |
| 文档 | 1 | 新增概念说明文档 |

---

## 阶段 1：数据库迁移

| Step | Action | Verification |
|------|--------|--------------|
| 1.1 | 备份现有数据（可选） | 确认备份完成 |
| 1.2 | 执行 `pnpm prisma migrate dev --name remove_complexity_field` | 迁移文件生成 |
| 1.3 | 检查生成的迁移文件 | 确认包含 `DROP COLUMN "complexity"` |

---

## 阶段 2：类型定义更新

### 2.1 `lib/rl/mapping/delta-c-to-complexity.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 2.1.1 | 将 `ComplexitySpec.reasoningDepth` 重命名为 `reasoningLevel` (L8) | `pnpm tsc --noEmit` |
| 2.1.2 | 删除 `calculateTargetComplexity()` 函数 (L64-68) | `pnpm tsc --noEmit` |

### 2.2 `lib/qie/types.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 2.2.1 | `ComplexitySpec.reasoningDepth` → `reasoningLevel` (L79) | `pnpm tsc --noEmit` |
| 2.2.2 | `PredictionContext.features.complexity` 删除 (L114) | `pnpm tsc --noEmit` |
| 2.2.3 | `QuestionFeatures.complexity` 删除 (L140) | `pnpm tsc --noEmit` |
| 2.2.4 | `ComplexityTransferWeights.complexity` 删除 (L183) | `pnpm tsc --noEmit` |
| 2.2.5 | `ComplexityDelta.complexity` 删除 (L193) | `pnpm tsc --noEmit` |

---

## 阶段 3：核心逻辑更新

### 3.1 `lib/qie/complexity-extractor.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 3.1.1 | `ComplexityFeatures.complexity` 删除 (L65-69) | 测试通过 |
| 3.1.2 | Few-shot 示例移除 `complexity` (L95-127) | 测试通过 |
| 3.1.3 | Prompt 移除 `complexity` 计算 (L133,152,168) | `grep "complexity" lib/qie/complexity-extractor.ts` 无匹配 |
| 3.1.4 | Prompt 输出格式移除 `complexity` (L198-199) | `grep "complexity" lib/qie/complexity-extractor.ts` 无匹配 |

### 3.2 `lib/qie/uok.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 3.2.1 | `globalTransferWeights.complexity` 删除 (L59-63) | 测试通过 |
| 3.2.2 | `predictWithComplexityTransfer` 删除 `complexity` 引用 | 测试通过 |
| 3.2.3 | `applyTransfer` 删除 `complexity` 权重计算 | 测试通过 |
| 3.2.4 | `encodeAnswer` 删除 `complexity` 引用 | 测试通过 |
| 3.2.5 | `updateTransferWeights` 删除 `complexity` 引用 | 测试通过 |
| 3.2.6 | `findSimplerReferenceQuestion` 删除 `complexity` | 测试通过 |
| 3.2.7 | `extractFeatures` 删除 `complexity` 返回值 (L712) | 测试通过 |
| 3.2.8 | `embedInput` 删除 `complexity` 嵌入 | 测试通过 |

### 3.3 `lib/qie/experiment-validator.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 3.3.1 | `ExperimentRecord.complexity` 替换为 `cognitiveLoad` + `reasoningDepth` | 测试通过 |
| 3.3.2 | Prisma 查询使用两维度计算 | 测试通过 |

### 3.4 `lib/qie/recommendation-service.ts`

| Step | Action | Verification |
|------|--------|--------------|
| 3.4.1 | `ComplexityProfile.complexity` 删除 (L12) | `pnpm tsc --noEmit` |
| 3.4.2 | `calculateMatchScore` 使用两维度计算 (L28-31) | 测试通过 |

---

## 阶段 4：前端组件更新

### 4.1 `components/ComplexityBadge.tsx`

| Step | Action | Verification |
|------|--------|--------------|
| 4.1.1 | 删除 `complexity` badge 显示 (L90-96) | 访问 /admin 确认不显示 |

### 4.2 `components/admin/ComplexityAdminPanel.tsx`

| Step | Action | Verification |
|------|--------|--------------|
| 4.2.1 | 删除 `avgComplexity`，改为分别显示 `avgCognitiveLoad` + `avgReasoningDepth` | 页面正常渲染 |

### 4.3 `components/admin/QuestionList.tsx`

| Step | Action | Verification |
|------|--------|--------------|
| 4.3.1 | 删除 `complexityMin` / `complexityMax` 筛选 | 访问 /admin 确认不显示 |
| 4.3.2 | 删除表格复杂度列 | 访问 /admin 确认列已移除 |

---

## 阶段 5：测试与验证

| Step | Action | Verification |
|------|--------|--------------|
| 5.1 | `pnpm tsc --noEmit` | 无编译错误 |
| 5.2 | `pnpm test` | 所有测试通过 |
| 5.3 | `pnpm build` | 构建成功 |
| 5.4 | 访问 /admin 页面 | 正常渲染 |

---

## 阶段 6：文档编写

| Step | Action | Verification |
|------|--------|--------------|
| 6.1 | 创建 `docs/difficulty-complexity.md` | 文件存在且完整 |

---

## 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 数据库迁移丢失数据 | 高 | 迁移前备份数据库 |
| 遗留引用未清理 | 中 | 全面 grep 搜索 |
| 前端运行时错误 | 中 | 构建验证和 E2E 测试 |
| 权重归一化异常 | 中 | 添加边界检查 |

---

## 验收标准

- [ ] 数据库迁移成功，`complexity` 字段已删除
- [ ] `pnpm tsc --noEmit` 无编译错误
- [ ] `pnpm test` 所有测试通过
- [ ] `pnpm build` 构建成功
- [ ] 前端页面 `/admin` 正常渲染
- [ ] 文档已创建且完整

---

## 执行顺序

```
阶段 1 → 阶段 2 → 阶段 3 → 阶段 4 → 阶段 5 → 阶段 6
  ↑          ↑          ↑          ↑          ↑
数据库    类型定义    核心逻辑    前端组件    测试验证
```

---

## 完整文件清单

### 核心逻辑 (必须修改)

| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | 删除 `complexity` 字段 |
| `lib/qie/types.ts` | 删除 complexity 字段，重命名 reasoningDepth |
| `lib/qie/complexity-extractor.ts` | 删除 complexity 提取和返回 |
| `lib/qie/uok.ts` | 删除 complexity 权重和计算 |
| `lib/qie/experiment-validator.ts` | 删除 complexity 引用 |
| `lib/qie/recommendation-service.ts` | 删除 complexity 引用 |
| `lib/rl/mapping/delta-c-to-complexity.ts` | 删除 calculateTargetComplexity() |

### 前端组件 (必须修改)

| 文件 | 变更 |
|------|------|
| `components/ComplexityBadge.tsx` | 删除 complexity 显示 |
| `components/admin/ComplexityAdminPanel.tsx` | 删除 complexity 统计 |
| `components/admin/QuestionList.tsx` | 删除 complexity 列/筛选 |

### API 路由 (必须修改)

| 文件 | 变更 |
|------|------|
| `app/api/admin/questions/route.ts` | 删除 complexity 筛选参数 |
| `app/api/admin/questions/[id]/complexity/route.ts` | 删除 complexity 更新 |
