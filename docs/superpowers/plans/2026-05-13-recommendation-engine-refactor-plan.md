# 推荐引擎重构详细实施计划

**日期**: 2026-05-13
**状态**: 待审核
**依赖**: `docs/superpowers/specs/2026-05-13-recommendation-engine-refactor-design.md`

---

## Overview

基于已批准的设计文档，对推荐引擎进行激进重构，解决知识点语义不一致（ID vs Name）、JSON 字段无法索引、DeepTutor 生成题目未触发复杂度提取、UOK 职责耦合、错误消息不区分原因等核心问题。

**激进重构约束**：
- 不允许保留任何 id-name 映射，必须全部使用 ID
- 不允许保留老的，直接采用新方法
- 必须保持全功能

---

## 架构变更概览

| 文件 | 变更类型 | 描述 |
|------|----------|------|
| `prisma/schema.prisma` | 新增字段 | Question 表新增 `knowledgePointIds String[]` |
| `prisma/migrations/` | 新增迁移 | 数据迁移脚本 |
| `lib/qie/question-repository.ts` | 新建 | 基于 ID 的题库查询 |
| `lib/qie/recommendation-engine.ts` | 新建 | 推荐服务编排 |
| `lib/qie/errors.ts` | 新建 | 统一错误响应类型 |
| `lib/qie/uok.ts` | 重构 | 移除持久化逻辑 |
| `lib/ai/complexity-queue.ts` | 新建 | 复杂度提取队列 |
| `app/api/practice/recommend/route.ts` | 适配 | 统一错误响应 |
| `app/api/questions/generate/route.ts` | 适配 | 触发复杂度提取 |

---

## Phase 1: 数据模型迁移

**目标**: 新增 `knowledgePointIds` 字段，双写保持向后兼容，验证 Name→ID 转换

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 1.1 | 创建 Prisma 迁移文件 `xxx_add_knowledge_point_ids` | `ls prisma/migrations/ | grep knowledge_point_ids` → 有结果 |
| 1.2 | 在 `prisma/schema.prisma` Question 模型新增 `knowledgePointIds String[] @default([])` | `grep -n "knowledgePointIds" prisma/schema.prisma` → 有结果 |
| 1.3 | 添加 `@@index([knowledgePointIds])` 索引 | `grep -n "@@index.*knowledgePointIds" prisma/schema.prisma` → 有结果 |
| 1.4 | 运行 `npx prisma generate` 生成客户端 | `pnpm prisma generate` → exit code 0 |
| 1.5 | 运行 `npx prisma db push` 应用 schema 变更 | `pnpm prisma db push` → exit code 0 |
| 1.6 | 创建数据迁移脚本 `scripts/migrate-kp-name-to-id.ts` | `ls scripts/migrate-kp-name-to-id.ts` → 文件存在 |
| 1.7 | 实现脚本：从 `knowledgePoints` (Name) 解析，通过 KnowledgePoint 表查找对应 ID，写入 `knowledgePointIds` | 脚本代码包含 `findMany` + `knowledgePointId` 映射逻辑 |
| 1.8 | 运行迁移脚本 | `pnpm tsx scripts/migrate-kp-name-to-id.ts` → 输出迁移记录数 |
| 1.9 | 验证数据正确性：比对 `knowledgePoints` 和 `knowledgePointIds` 数量 | 脚本输出显示转换成功率 >= 95% |
| 1.10 | 添加双写逻辑：在 Question 创建/更新时同时写入两个字段 | `grep -n "knowledgePointIds.*push\|knowledgePoints.*push" lib/qie/` → 有结果 |

### Phase 1 依赖分析

| 调用者 | 影响 | 处理方式 |
|--------|------|----------|
| Question 模型创建处 | 无需修改 | 双写逻辑自动生效 |
| Question 模型更新处 | 无需修改 | 双写逻辑自动生效 |
| 旧代码读取 `knowledgePoints` | 无影响 | 保留旧字段 |

### Phase 1 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 迁移脚本运行失败 | 添加事务 + 回滚机制 | `pnpm tsx scripts/migrate-kp-name-to-id.ts 2>&1 | grep ERROR` → 无 ERROR |
| Name→ID 映射不完整 | 脚本输出未匹配的 Name 列表 | 脚本运行后检查控制台输出 → 未匹配数 < 5% |
| 已有数据丢失 | 保留旧字段直到 Phase 6 | `SELECT COUNT(*) FROM "Question" WHERE "knowledgePoints" IS NOT NULL` → > 0 |

### Phase 1 出口标准

- [ ] `knowledgePointIds` 字段存在于 schema
- [ ] 索引已创建
- [ ] 迁移脚本成功运行
- [ ] 所有 Question 记录两个字段都有值或旧字段有值

---

## Phase 2: QuestionRepository 重构

**目标**: 新增基于 ID 的查询方法，删除基于 Name 的查询

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 2.1 | 创建 `lib/qie/question-repository.ts` 文件 | `ls lib/qie/question-repository.ts` → 文件存在 |
| 2.2 | 实现 `findByTopicIds(topicIds: string[], excludeIds?: string[]): Promise<Question[]>` | `grep -n "findByTopicIds" lib/qie/question-repository.ts` → 有结果 |
| 2.3 | 实现 `findAvailableQuestion(topicId: string): Promise<Question | null>` | `grep -n "findAvailableQuestion" lib/qie/question-repository.ts` → 有结果 |
| 2.4 | 实现 `notifyQuestionAvailable(questionId: string): Promise<void>` | `grep -n "notifyQuestionAvailable" lib/qie/question-repository.ts` → 有结果 |
| 2.5 | 扫描所有调用者: `grep -rn "findQuestionByTopic\|findByTopicName" --include="*.ts" lib/` | 记录所有需要迁移的文件 |
| 2.6 | 重构 `lib/qie/uok-flow-service.ts` 使用新的 `findAvailableQuestion` | `grep -n "findAvailableQuestion" lib/qie/uok-flow-service.ts` → 有结果 |
| 2.7 | 删除旧的 `findQuestionByTopic` 方法 | `grep -rn "findQuestionByTopic" lib/qie/uok-flow-service.ts` → 无结果 |
| 2.8 | 编写单元测试 `lib/qie/__tests__/question-repository.test.ts` | `ls lib/qie/__tests__/question-repository.test.ts` → 文件存在 |
| 2.9 | 验证测试通过 | `pnpm test lib/qie/__tests__/question-repository.test.ts` → PASS |

### Phase 2 依赖分析

| 文件 | 方法调用 | 迁移工作量 |
|------|----------|----------|
| `lib/qie/uok-flow-service.ts` | `findQuestionByTopic()` | 中等 - 需修改参数传递 |
| `lib/qie/recommendation-service.ts` | `findTopNCandidates()` | 低 - 改用 QuestionRepository |
| `app/api/practice/recommend/route.ts` | UOKFlowService | 低 - 无需修改 |

### Phase 2 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| ID 查询语义与 Name 不同 | 添加日志记录查询参数 | `grep -n "log.*topicIds" lib/qie/question-repository.ts` → 有结果 |
| 查询性能下降 | 确认索引存在 | `npx prisma db execute --sql "EXPLAIN SELECT * FROM \"Question\" WHERE 'kp1' = ANY(\"knowledgePointIds\")"` → 显示索引 |

### Phase 2 出口标准

- [ ] `QuestionRepository` 类实现完整
- [ ] 所有调用者使用 `findByTopicIds` / `findAvailableQuestion`
- [ ] 单元测试覆盖率 >= 80%
- [ ] `grep -rn "findQuestionByTopic" lib/qie/` → 无结果

---

## Phase 3: DeepTutor 集成闭环

**目标**: 生成后自动触发复杂度提取，状态更新后通知推荐服务

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 3.1 | 扫描生成相关代码: `grep -rn "generate.*question\|DeepTutor\|question.*create" --include="*.ts" lib/` | 记录生成入口点 |
| 3.2 | 创建 `lib/ai/complexity-queue.ts` | `ls lib/ai/complexity-queue.ts` → 文件存在 |
| 3.3 | 实现 `enqueueComplexityExtraction(questionId: string): void` | `grep -n "enqueueComplexityExtraction" lib/ai/complexity-queue.ts` → 有结果 |
| 3.4 | 实现 `processExtraction(questionId): Promise<void>` 并更新 `extractionStatus` | `grep -n "extractionStatus.*SUCCESS\|PROCESSING" lib/ai/complexity-queue.ts` → 有结果 |
| 3.5 | 在 `app/api/questions/generate/route.ts` 生成后调用 `enqueueComplexityExtraction` | `grep -n "enqueueComplexityExtraction" app/api/questions/generate/route.ts` → 有结果 |
| 3.6 | 在 `lib/ai/question-generator.ts` 生成后调用 `enqueueComplexityExtraction` | `grep -n "enqueueComplexityExtraction" lib/ai/question-generator.ts` → 有结果 |
| 3.7 | 调用 `notifyQuestionAvailable` 通知推荐服务 | `grep -n "notifyQuestionAvailable" lib/ai/complexity-queue.ts` → 有结果 |
| 3.8 | 编写集成测试 | `pnpm test lib/ai/__tests__/complexity-queue.test.ts` → PASS |

### Phase 3 依赖分析

| 文件 | 变更内容 | 风险等级 |
|------|----------|----------|
| `app/api/questions/generate/route.ts` | 添加 `enqueueComplexityExtraction()` 调用 | 低 |
| `app/api/admin/factory/generate/route.ts` | 同上 | 低 |
| `lib/ai/question-generator.ts` | 修改生成后回调 | 中 - 需验证回调签名 |

### Phase 3 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 队列处理失败 | 添加重试机制 (最多 3 次) + 错误日志 | 模拟失败场景: `node scripts/test-complexity-queue.js FAIL` → 重试日志 |
| 状态更新丢失 | 使用事务确保原子性 | `npx prisma db execute --sql "BEGIN; UPDATE ...; SELECT ...; COMMIT"` → 原子成功 |

### Phase 3 出口标准

- [ ] 生成题目后 `extractionStatus` 变为 `PROCESSING`
- [ ] 复杂度提取完成后 `extractionStatus` 变为 `SUCCESS`
- [ ] `notifyQuestionAvailable` 被正确调用
- [ ] 集成测试覆盖完整流程

---

## Phase 4: RecommendationService 编排

**目标**: 新增推荐服务类，协调 UOK + QuestionRepository + DeepTutorGenerator

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 4.1 | 创建 `lib/qie/recommendation-engine.ts` | `ls lib/qie/recommendation-engine.ts` → 文件存在 |
| 4.2 | 创建 `lib/qie/errors.ts` 定义 ErrorCode 枚举 | `grep -n "enum ErrorCode" lib/qie/errors.ts` → 有结果 |
| 4.3 | 实现错误码到 `action` 的映射 | `grep -n "action.*NEEDS_DIAGNOSTIC\|action.*ALL_TOPICS" lib/qie/errors.ts` → 有结果 |
| 4.4 | 实现 `getNextQuestion(studentId): Promise<RecommendationResponse>` | `grep -n "getNextQuestion" lib/qie/recommendation-engine.ts` → 有结果 |
| 4.5 | 实现题库空时的兜底生成逻辑 | `grep -n "generate.*fallback\|generateFallback" lib/qie/recommendation-engine.ts` → 有结果 |
| 4.6 | 迁移现有 `lib/qie/recommendation-service.ts` 逻辑到新服务 | 代码重构后功能等价 |
| 4.7 | 编写 `lib/qie/__tests__/recommendation-engine.test.ts` | `pnpm test lib/qie/__tests__/recommendation-engine.test.ts` → PASS |
| 4.8 | 验证端到端流程 | `curl -X POST http://localhost:3000/api/practice/recommend -H "Content-Type: application/json" -d '{"studentId":"test"}'` → 返回题目或错误码 |

### Phase 4 错误响应定义

```typescript
// lib/qie/errors.ts
export enum ErrorCode {
  NEEDS_DIAGNOSTIC = 'NEEDS_DIAGNOSTIC',
  NO_LEARNING_PATH = 'NO_LEARNING_PATH',
  ALL_TOPICS_MASTERED = 'ALL_TOPICS_MASTERED',
  TOPIC_NO_QUESTIONS = 'TOPIC_NO_QUESTIONS',
  GENERATION_FAILED = 'GENERATION_FAILED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  NO_TOPICS_DEFINED = 'NO_TOPICS_DEFINED',
}

export interface RecommendationError {
  code: ErrorCode;
  message: string;
  action: string;
  details?: object;
}
```

### Phase 4 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 题库空时生成失败 | 添加降级策略 (返回友好错误) | 模拟题库空: `node scripts/test-empty-question.js` → 返回 TOPIC_NO_QUESTIONS |
| 循环依赖 | 注入依赖而非直接 import | `grep -n "constructor.*QuestionRepository" lib/qie/recommendation-engine.ts` → 有结果 |

### Phase 4 出口标准

- [ ] `RecommendationEngine` 类完整实现
- [ ] 所有错误码有对应 `action`
- [ ] 题库空时触发 DeepTutor 生成
- [ ] 单元测试覆盖率 >= 80%

---

## Phase 5: UOK 职责分离

**目标**: UOK 只保留状态机 + ML 决策，移除持久化和缓存逻辑

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 5.1 | 分析 UOK 持久化方法: `grep -n "saveStudentState\|loadStudentState\|saveQuestionState\|prisma\." lib/qie/uok.ts` | 记录持久化方法位置 |
| 5.2 | 创建 `loadKnowledge(studentId)` 纯内存方法替代 `loadStudentState` | `grep -n "loadKnowledge" lib/qie/uok.ts` → 有结果 |
| 5.3 | 移除 `saveStudentState()` 方法 (调用方负责持久化) | `grep -n "saveStudentState" lib/qie/uok.ts` → 无结果 |
| 5.4 | 移除 `saveQuestionState()` 方法 | `grep -n "saveQuestionState" lib/qie/uok.ts` → 无结果 |
| 5.5 | 移除 `Question` 内存缓存 (如 `this.state.questions`) | `grep -n "this.state.questions" lib/qie/uok.ts` → 无结果 |
| 5.6 | 移除所有 Prisma 调用 | `grep -n "prisma\." lib/qie/uok.ts` → 无结果 |
| 5.7 | 更新 `lib/qie/recommendation-engine.ts` 负责持久化协调 | `grep -n "await.*save\|prisma\." lib/qie/recommendation-engine.ts` → 有结果 |
| 5.8 | 验证 UOK 测试通过 | `pnpm test lib/qie/__tests__/uok.test.ts` → PASS |
| 5.9 | 验证重构后功能一致 | 对比 UOK 决策结果与重构前 |

### Phase 5 UOK 变更前后对比

| 变更前 | 变更后 |
|--------|--------|
| `saveStudentState()` | 调用方负责持久化 |
| `loadStudentState()` | `loadKnowledge()` 纯内存 |
| `saveQuestionState()` | 移除 |
| `this.state.questions` Map | 移除，外部提供 |
| Prisma 调用 | 移除 |

### Phase 5 依赖分析

| 文件 | 变更内容 | 风险等级 |
|------|----------|----------|
| `lib/qie/recommendation-engine.ts` | 添加持久化协调 | 中 - 需验证调用顺序 |
| `lib/qie/uok-flow-service.ts` | 移除 saveStudentState 调用 | 低 - 确认无依赖 |

### Phase 5 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 持久化丢失 | 添加日志记录持久化状态 | `grep -n "persist\|save" lib/qie/recommendation-engine.ts` → 有结果 |
| UOK 状态丢失 | 使用外部状态管理器 | 验证测试: `pnpm test lib/qie/__tests__/` → ALL PASS |

### Phase 5 出口标准

- [ ] UOK 类不包含任何 Prisma 调用
- [ ] 所有持久化逻辑移至调用方
- [ ] UOK 测试通过
- [ ] `grep -rn "prisma\." lib/qie/uok.ts` → 无结果

---

## Phase 6: API 层适配

**目标**: 修改 API 端点使用新的 RecommendationEngine，统一错误响应，删除旧字段

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 6.1 | 修改 `app/api/practice/recommend/route.ts` 使用新的 RecommendationEngine | `grep -n "RecommendationEngine" app/api/practice/recommend/route.ts` → 有结果 |
| 6.2 | 更新响应结构返回统一错误码 | `grep -n "success.*false\|error.*code" app/api/practice/recommend/route.ts` → 有结果 |
| 6.3 | 验证前端兼容: 检查 `hooks/useUOKRecommendation.ts` | `grep -n "success\|error" hooks/useUOKRecommendation.ts` → 处理两种响应 |
| 6.4 | 更新前端显示可操作错误消息 | `grep -n "action\|NEEDS_DIAGNOSTIC" components/` → 渲染 action 文本 |
| 6.5 | 确认所有消费者已迁移到 knowledgePointIds | `grep -rn "knowledgePoints" --include="*.ts" lib/qie/` → 无 KP 相关代码 |
| 6.6 | 创建 Prisma 迁移删除旧字段 | `npx prisma migrate dev --name drop_knowledge_points` → exit code 0 |
| 6.7 | 运行 `npx prisma db push` 应用最终 schema | `pnpm prisma db push` → exit code 0 |
| 6.8 | 全量回归测试 | `pnpm test -- --coverage` → 通过率 >= 80% |

### Phase 6 API 响应变更

| 场景 | 旧响应 | 新响应 |
|------|--------|--------|
| 成功 | `{ question: {...} }` | `{ success: true, question: {...}, rationale: {...} }` |
| 题库空 | `null` | `{ success: false, error: { code: 'TOPIC_NO_QUESTIONS', action: '正在为您生成题目...' } }` |
| 已掌握 | `null` | `{ success: false, error: { code: 'ALL_TOPICS_MASTERED', action: '可以回顾错题集' } }` |
| 需要诊断 | - | `{ success: false, error: { code: 'NEEDS_DIAGNOSTIC', action: '点击这里完成诊断测评' } }` |

### Phase 6 风险缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 前端未适配新响应 | 添加响应版本检测，降级处理 | `grep -n "version\|compat" hooks/useUOKRecommendation.ts` → 有结果 |
| 删除旧字段影响遗留代码 | Phase 1-5 验证后删除 | 确认迁移完成: `grep -rn "knowledgePoints" --include="*.prisma" prisma/` → 无旧字段 |

### Phase 6 出口标准

- [ ] API 返回统一错误响应结构
- [ ] 前端正确渲染 `action` 文本
- [ ] 旧字段 `knowledgePoints` 已删除
- [ ] 全量测试通过

---

## Testing Strategy

### 单元测试

| 文件 | 测试方法 | 覆盖率目标 |
|------|----------|------------|
| `lib/qie/__tests__/question-repository.test.ts` | `findByTopicIds`, `findAvailableQuestion`, `notifyQuestionAvailable` | >= 90% |
| `lib/qie/__tests__/recommendation-engine.test.ts` | `getNextQuestion`, 错误码映射 | >= 85% |
| `lib/qie/__tests__/uok-职责分离.test.ts` | UOK 决策逻辑 | >= 90% |
| `lib/ai/__tests__/complexity-queue.test.ts` | 队列处理、重试逻辑 | >= 85% |

### 集成测试

| 测试场景 | 验证点 | 命令 |
|----------|--------|------|
| 完整推荐流程 | 请求 → UOK → QuestionRepository → 返回 | `pnpm test:integration recommendation` |
| 题库空触发生成 | 题库空 → DeepTutor 生成 → 复杂度提取 → 返回 | `pnpm test:integration empty-question` |
| 错误码返回 | 各类错误码正确返回 | `curl /api/practice/recommend` → 验证 error.code |

---

## Success Criteria

| Criterion | Verification Gate |
|------------|-------------------|
| 所有知识点匹配使用 ID | `grep -rn "knowledgePoint.*=.*\.name\|kp\.name" --include="*.ts" lib/` → 无结果 |
| 无 ID-Name 映射残留 | `grep -rn "map.*name.*id\|id.*name.*map" --include="*.ts" lib/` → 无结果 |
| 错误响应 100% 有 action | `pnpm test lib/qie/__tests__/errors.test.ts` → 100% 覆盖 |
| DeepTutor 生成题目可用 | 验证生成后 `extractionStatus=SUCCESS` |
| UOK 不含 Prisma 调用 | `grep -rn "prisma\." lib/qie/uok.ts` → 无结果 |
| 单元测试覆盖率 >= 80% | `pnpm test -- --coverage` → >= 80% |
| 全功能保持 | E2E 测试 100% 通过 |

---

## Risks & Mitigations

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| 数据迁移失败 | 分阶段迁移 + 事务 + 回滚脚本 | `pnpm tsx scripts/rollback-migration.ts` → 成功回滚 |
| DeepTutor 生成失败 | 重试机制 + 降级策略 + 错误日志 | `node scripts/test-generation-fail.js` → 3次重试后返回错误码 |
| UOK 职责分离破坏现有逻辑 | 渐进切换 + 保留旧接口 | `pnpm test lib/qie/` → 所有测试通过 |
| 性能下降 | 索引优化 + 查询缓存 | `EXPLAIN ANALYZE` → 确认索引使用 |
| 前端适配遗漏 | 添加响应版本检测 + 降级处理 | 测试降级路径: `?version=legacy` |

---

## Dependencies

```
Phase 1 (完成) → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
                     ↓
                  [独立测试]
```

每个 Phase 可独立验证，但完整功能需要按顺序完成。

---

## Rollback Plan

| Phase | 回滚步骤 |
|-------|----------|
| Phase 1 | `npx prisma migrate revert` + 删除新字段 |
| Phase 2 | 恢复旧的 `findQuestionByTopic` 方法 |
| Phase 3 | 移除 `enqueueComplexityExtraction` 调用 |
| Phase 4 | 恢复旧的 `recommendation-service.ts` |
| Phase 5 | 恢复 `saveStudentState` 方法到 UOK |
| Phase 6 | 恢复旧 schema 字段 (Phase 1 备份) |