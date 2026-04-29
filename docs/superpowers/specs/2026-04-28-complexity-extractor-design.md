# ComplexityExtractor 设计文档

**日期**: 2026-04-28
**目标**: 构建题目复杂度特征自动提取工厂，为 QIE v2.1 提供真实数据支持

---

## 1. 背景与目标

### 1.1 问题
QIE v2.1 Global Shared Weights 需要题目特征输入：
- `cognitiveLoad`: 认知负荷 [0, 1]
- `reasoningDepth`: 推理深度 [0, 1]
- `complexity`: 综合复杂度 [0, 1]

当前题库缺少这些特征，人工标注不可行。

### 1.2 目标
- 自动化提取题目特征，准确率 > 80%
- 支持批量处理历史题库（10万+ 题目）
- 提供 API 端点支持新增题目
- 生产级稳定性（失败重试、数据不污染）

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│              ComplexityExtractor                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Prompt     │───>│  gemma-4-31b │───>│  Defense     │  │
│  │  Builder    │    │  (JSON Mode) │    │  Parser      │  │
│  └─────────────┘    └──────────────┘    └──────────────┘  │
│       │                                           │         │
│       │  ┌─────────────────────────────────┐     │         │
│       └──>  批量模式: 8题/次                │     │         │
│          │  单题模式: 1题/次 (API)          │     │         │
│          └─────────────────────────────────┘     │         │
│                                                   │         │
│  ┌────────────────────────────────────────────────┴─────────┐│
│  │           失败处理: extractionStatus = FAILED            ││
│  │           重试队列: WHERE extractionStatus = 'FAILED'    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │                                     │
         v                                     v
┌─────────────────┐                   ┌──────────────┐
│  Script Mode    │                   │   API Mode   │
│  (批量处理)      │                   │  (单题/小批)  │
└─────────────────┘                   └──────────────┘
```

### 2.2 核心组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| ComplexityExtractor | `lib/qie/complexity-extractor.ts` | 核心提取类 |
| Prompt Builder | 内置 | Few-shot prompt 构建 |
| Defense Parser | 内置 | 防御性 JSON 解析 |
| 批量脚本 | `scripts/extract-complexity.ts` | 离线批量处理 |
| API 端点 | `app/api/admin/complexity/*` | 在线提取服务 |

---

## 3. 数据库设计

### 3.1 Schema 扩展

```prisma
model Question {
  // ... 现有字段

  // 特征提取相关
  cognitiveLoad      Float?   // [0, 1] 认知负荷
  reasoningDepth     Float?   // [0, 1] 推理深度
  complexity         Float?   // [0, 1] 综合复杂度
  extractionStatus   String   @default("PENDING")  // PENDING | SUCCESS | FAILED
  featuresExtractedAt DateTime?
  extractionError    String?  // 失败原因
  extractionModel    String?  @default("gemma-4-31b-it-v1")  // 模型版本

  @@index([extractionStatus])
}
```

### 3.2 状态转换

```
PENDING ──提取成功──> SUCCESS (特征值写入, featuresExtractedAt=NOW())
   │
   └──提取失败──> FAILED (extractionError 记录原因)
                     │
                     └──重试──> PENDING
```

---

## 4. Prompt 设计

### 4.1 Few-shot 示例（6个）

| 示例 | 题目类型 | cognitiveLoad | reasoningDepth | complexity |
|------|---------|---------------|----------------|------------|
| 1 | 直接计算 √16 | 0.1 | 0.0 | 0.1 |
| 2 | 公式应用 √3×√12 | 0.2 | 0.1 | 0.2 |
| 3 | 多步化简 √50 | 0.4 | 0.3 | 0.4 |
| 4 | 混合运算 (√8+√18)/√2 | 0.7 | 0.6 | 0.7 |
| 5 | 建模应用 正方形对角线 | 0.8 | 0.7 | 0.8 |
| 6 | 构造性证明 不等式证明 | 0.9 | 0.9 | 0.9 |

### 4.2 单题 Prompt 模板

```
你是一个数学教育专家，擅长分析数学题目的认知特征。

请分析以下数学题目的三个特征维度：

**特征定义：**
1. **cognitiveLoad（认知负荷）[0-1]**：学生解题时工作记忆的占用程度
2. **reasoningDepth（推理深度）[0-1]**：逻辑推理的层次数
3. **complexity（综合复杂度）[0-1]**：题目整体难度

[6个示例...]

现在分析以下题目：
{question_json}

请严格按照以下JSON格式输出，不要包含任何其他文字、Markdown标记或解释：
{"reasoning":"...","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X}
```

### 4.3 批量 Prompt 模板

```
请一次性评估以下 {N} 道数学题目的复杂度特征：

题目列表：
{questions_json_array}

请按照以下JSON数组格式输出，不要包含任何其他文字：
[
  {"id":"q1","reasoning":"...","features":{"cognitiveLoad":0.X,"reasoningDepth":0.X,"complexity":0.X},"confidence":0.X},
  ...
]
```

---

## 5. API 设计

### 5.1 单题提取
```
POST /api/admin/complexity/extract

Request:
{
  "questionId": "xxx",
  "content": { "title": "...", "description": "..." }
}

Response:
{
  "success": true,
  "features": {
    "cognitiveLoad": 0.5,
    "reasoningDepth": 0.4,
    "complexity": 0.6
  },
  "confidence": 0.85
}
```

### 5.2 批量提取
```
POST /api/admin/complexity/batch

Request:
{
  "questions": [
    { "id": "q1", "content": {...} },
    { "id": "q2", "content": {...} }
  ]
}

Response:
{
  "success": true,
  "results": [
    { "id": "q1", "features": {...}, "status": "SUCCESS" },
    { "id": "q2", "features": {...}, "status": "SUCCESS" }
  ],
  "summary": {
    "total": 2,
    "success": 2,
    "failed": 0
  }
}
```

### 5.3 状态查询
```
GET /api/admin/complexity/status

Response:
{
  "pending": 150,
  "success": 8500,
  "failed": 23,
  "avgConfidence": 0.82
}
```

---

## 6. 批量脚本设计

### 6.1 命令行参数

```bash
# 基本用法
pnpm tsx scripts/extract-complexity.ts

# 可选参数
--limit 100          # 处理题目数量限制
--batch-size 8       # 批量大小（默认8）
--delay 1000         # 批次间延迟（毫秒）
--dry-run            # 干运行，不更新数据库
--retry-failed       # 仅重试失败的记录
--force              # 强制重新提取（覆盖已有特征）
```

### 6.2 输出报告

```
=== 题目复杂度特征批量提取 ===
找到 1000 道题目需要处理

开始批量提取...
  进度: 8/1000 (0.8%)
  进度: 16/1000 (1.6%)
  ...

=== 统计 ===
  总数: 1000
  成功: 975
  失败: 25
  高置信度 (>0.8): 850
  低置信度 (<0.5): 15
  平均认知负荷: 0.452
  平均推理深度: 0.438
  平均复杂度: 0.491

=== 低置信度题目（需要人工审核）===
  q_123: confidence=0.32
  q_456: confidence=0.41
  ...
```

---

## 7. 错误处理与容错

### 7.1 失败处理策略

| 场景 | 处理方式 |
|------|---------|
| LLM 超时 | 指数退避重试（1s → 2s → 4s） |
| JSON 解析失败 | 记录 FAILED，保存错误信息 |
| 特征值超出 [0,1] | Clamp 到边界 |
| 网络错误 | 标记 FAILED，下次重试 |

### 7.2 重试机制

```typescript
// 指数退避重试
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
}
```

### 7.3 数据质量保证

- **拒绝默认值**：失败时不写入虚假数据
- **置信度记录**：保留 LLM 的置信度评分
- **人工审核队列**：低置信度（< 0.5）题目标记供审核

---

## 8. 性能指标

| 指标 | 目标值 |
|------|--------|
| 单题提取耗时 | < 5 秒 |
| 批量提取吞吐 | > 100 题/小时 |
| 成功率 | > 95% |
| 准确率（人工抽检） | > 80% |

---

## 9. 测试计划

### 9.1 单元测试
- Mock LLM 响应，测试解析逻辑
- 测试 Clamp、验证逻辑
- 测试错误处理路径

### 9.2 集成测试
- 真实 LLM 调用，3 个难度级别
- 批量处理小样本（10 题）

### 9.3 数据质量测试
- 人工抽检 100 题，验证准确率
- 低置信度题目人工复核

---

## 10. 上线计划

1. **Phase 1**: 核心功能开发（ComplexityExtractor + 脚本）
2. **Phase 2**: 数据库迁移 + 小批量测试（100 题）
3. **Phase 3**: 全量题库处理
4. **Phase 4**: API 端点 + 监控面板
5. **Phase 5**: 人工审核低置信度题目

---

## 附录：技术栈

- **LLM**: gemma-4-31b-it (Google Generative AI)
- **SDK**: @google/generative-ai
- **数据库**: Prisma + SQLite
- **类型**: TypeScript
- **测试**: Jest
