# ComplexityExtractor 使用指南

## 概述

ComplexityExtractor 使用 gemma-4-31b-it LLM 自动提取数学题目的复杂度特征。

## 特征维度

- **cognitiveLoad** [0-1]: 认知负荷，工作记忆占用程度
- **reasoningDepth** [0-1]: 推理深度，逻辑推理层次数
- **complexity** [0-1]: 综合复杂度

## 使用方式

### 1. 批量处理历史题库

```bash
# 基本用法（处理100题）
pnpm tsx scripts/extract-complexity.ts --limit 100

# 干运行（不更新数据库）
pnpm tsx scripts/extract-complexity.ts --limit 10 --dry-run

# 重试失败的记录
pnpm tsx scripts/extract-complexity.ts --retry-failed --limit 50

# 自定义批量大小和延迟
pnpm tsx scripts/extract-complexity.ts --batch-size 5 --delay 2000
```

### 2. API 调用

**单题提取：**
```bash
POST /api/admin/complexity/extract
{
  "questionId": "xxx",
  "content": { "title": "...", "description": "..." }
}
```

**批量提取：**
```bash
POST /api/admin/complexity/batch
{
  "questions": [
    { "id": "q1", "content": {...} },
    { "id": "q2", "content": {...} }
  ]
}
```

**查询状态：**
```bash
GET /api/admin/complexity/status
```

## 数据质量

- 成功率目标: > 95%
- 准确率目标: > 80% (人工抽检)
- 低置信度题目 (< 0.5) 需人工审核

## 错误处理

- 失败的题目标记为 `extractionStatus: FAILED`
- 使用 `--retry-failed` 重新处理失败记录
- 不会写入默认值，避免数据污染
