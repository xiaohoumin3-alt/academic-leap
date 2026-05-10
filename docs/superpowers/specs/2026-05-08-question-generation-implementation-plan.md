# 题目生成状态不一致Bug修复 - 实现计划

**日期**: 2026-05-08
**设计**: [2026-05-08-question-generation-bug-fix-design.md](./2026-05-08-question-generation-bug-fix-design.md)

## 实现计划

### 文件1: lib/question-generation/state-helpers.ts

**修改**: `checkComplete()` 函数

| 步骤 | 操作 | 验证方式 |
|------|------|----------|
| 1.1 | 在函数开头增加数据库实际题目数查询 | pnpm tsc --noEmit 通过 |
| 1.2 | 计算总目标数量 = 等级数 × 每等级目标数 | 确认公式：(max-min+1) × targetPerLevel |
| 1.3 | 如果实际题目数 >= 目标，返回true | 运行现有测试通过 |
| 1.4 | 保留原有generationProgress检查逻辑 | 确保向后兼容 |

### 文件2: lib/question-generation/worker.ts

**修改**: `generateQuestionsWorker()` 函数

| 步骤 | 操作 | 验证方式 |
|------|------|----------|
| 2.1 | 在函数开头（第21行后）添加生成前检查 | pnpm tsc --noEmit 通过 |
| 2.2 | 查询数据库实际题目数 | 确认prisma.question.count语法 |
| 2.3 | 如果已达目标，调用markCompleted并返回 | 运行现有测试通过 |
| 2.4 | 添加日志输出以便调试 | 日志格式："[Worker] Knowledge point {id} already has {count} questions" |

### 文件3: components/admin/KnowledgePointDetail.tsx

**修改**: UI显示逻辑

| 步骤 | 操作 | 验证方式 |
|------|------|----------|
| 3.1 | 第313行：改为直接显示questions.length | pnpm tsc --noEmit 通过 |
| 3.2 | 确认API返回actualQuestionCount字段 | 检查/api/admin/question-generation/status/[id]响应 |

## 验收测试

| 测试 | 步骤 | 预期结果 |
|------|------|----------|
| 后端-停止条件 | 1. 创建已有120题的知识点<br>2. 触发生成任务<br>3. 检查任务状态 | 任务立即标记为completed，不生成新题目 |
| 后端-checkComplete | 1. 调用checkComplete(kpId, 10, {min:1,max:12})<br>2. 数据库有120题 | 返回true |
| 前端-UI显示 | 1. 打开知识点详情页<br>2. 检查"共X题"显示 | 数量与数据库一致 |
| 集成-完整流程 | 1. 新建知识点，0题目<br>2. 触发生成<br>3. 等待完成 | 生成120题后自动停止 |

## 回滚计划

如有问题，可通过git revert快速回滚。
