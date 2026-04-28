# ComplexityExtractor v2 设计文档

**日期**: 2026-04-28
**目标**: 解决设计与交付差距，通过 MiniMax LLM 集成和 UI 交付生产级系统

---

## 1. 背景与差距分析

### 1.1 当前状态

| 差距 | 问题 | 解决方案 |
|------|------|----------|
| LLM 模型不可用 | gemma-4-31b-it 国内网络不可达 | MiniMax 代理 |
| 准确率不足 | 规则后备 ~65% | LLM + 6-shot few-shot |
| 无 UI | 只有后端 API | 管理后台 + 学生端 |
| QIE 未集成 | 特征未融入预测系统 | 完整集成 |

### 1.2 目标

- 准确率 > 80%（通过 LLM + 6-shot few-shot）
- 管理后台：查看统计、触发提取、监控权重
- 学生端：预测展示、反馈学习、推荐选题
- 生产级稳定性：失败重试、数据不污染

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户视角                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐              ┌─────────────────────────┐  │
│  │   管理后台 UI    │              │      学生端 UI          │  │
│  │  (/admin/...)   │              │  (/practice, /learn)   │  │
│  └────────┬────────┘              └───────────┬─────────────┘  │
│           │                                     │                │
│           └──────────────┬─────────────────────┘                │
│                          │                                      │
│                          v                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     API Layer                              │  │
│  │  /api/admin/complexity/*  │  /api/qie/*  │  /api/practice │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          v                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │    ComplexityExtractor (LLM)  +  QIE Kernel (UOK)       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          v                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Prisma + SQLite                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: MiniMax LLM 集成

### 3.1 环境配置

```bash
# .env 新增
MINIMAX_API_KEY="sk-cp-wckNQgNpPA6ZCK0o4dpRYLBlQZlmI90H_B6SYJXJho60UI2kg6V_UtzX6e1rn5M-6-H6ykw5_dViXSDrBj3ofTVmipW5VsoTRcCD9LahfIEfAqhk8grSqhQ"
MINIMAX_BASE_URL="https://api.minimaxi.com/anthropic"
```

### 3.2 Anthropic 客户端封装

**文件**: `lib/qie/anthropic-client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

export class MiniMaxClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.MINIMAX_API_KEY,
      baseURL: process.env.MINIMAX_BASE_URL,
    });
  }

  async extract(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-20250514',  // MiniMax 接受任意模型名
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    // MiniMax 返回 thinking + text，提取 text
    const textBlock = response.content.find(
      (block: any) => block.type === 'text'
    );
    return textBlock?.text ?? '';
  }
}
```

### 3.3 重构 ComplexityExtractor

**文件**: `lib/qie/complexity-extractor.ts`

- 替换 GoogleGenerativeAI 为 MiniMaxClient
- 保留 6 个 few-shot 示例（覆盖 [0.1-0.9]）
- 解析 JSON 时忽略 thinking block
- 指数退避重试: 1s → 2s → 4s

### 3.4 验证标准

- [ ] MiniMax API 调用成功
- [ ] 6-shot prompt 输出有效 JSON
- [ ] 抽检 20 题准确率 > 80%

---

## 4. Phase 2: 管理后台 UI

### 4.1 特征统计面板

**路由**: `/admin/complexity`

```
┌────────────────────────────────────────────────────────────┐
│  题目特征管理                                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  总题目   │  │ 已提取    │  │  待提取   │  │ 失败     │ │
│  │   1063   │  │  1063    │  │    0     │  │    0     │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                            │
│  特征分布图 (柱状图/饼图)                                   │
│                                                            │
│  [重新提取全部]  [查看低置信度]  [权重监控]                  │
└────────────────────────────────────────────────────────────┘
```

### 4.2 权重监控面板

**路由**: `/admin/complexity/weights`

```
┌────────────────────────────────────────────────────────────┐
│  Global Shared Weights                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  cognitiveLoad:  ████████████████ 0.52                     │
│  reasoningDepth: ██████████░░░░░░░ 0.28                    │
│  complexity:     ████████░░░░░░░░░ 0.20                   │
│                                                            │
│  gateThreshold: 0.55  │  totalUpdates: 1250               │
│                                                            │
│  权重更新历史 (折线图)                                       │
└────────────────────────────────────────────────────────────┘
```

### 4.3 低置信度审核

**路由**: `/admin/complexity/low-confidence`

- 展示 extractionConfidence < 0.5 的题目
- 支持人工标注修正
- 修正后重新提取

---

## 5. Phase 3: 学生端预测展示

### 5.1 练习页面

**路由**: `/practice`

```
┌────────────────────────────────────────────────────────────┐
│  题目：求抛物线 y = x² - 4x + 3 的顶点坐标                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 预测正确率: 72%                                      │  │
│  │ ████████████████████████████████░░░░░░ 72%        │  │
│  │ 基于您在此知识点的历史表现                            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │                    答题区域                           │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│                              [提交答案]                     │
└────────────────────────────────────────────────────────────┘
```

### 5.2 答题反馈

提交答案后显示：

```
┌────────────────────────────────────────────────────────────┐
│  答案: (1, -1)                                             │
│  结果: ✓ 正确  /  ✗ 错误                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 预测: 72%  │  实际: 100% (正确)  │  误差: 28%    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  知识点掌握度                                              │
│  二次函数        ████████████████░░░░░░  82% (+5%)      │
│  顶点坐标        ██████████████░░░░░░░░  70% (+10%)      │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Phase 4: 反馈学习与推荐系统

### 6.1 QIE Kernel 集成

**文件**: `lib/qie/uok.ts` (已实现)

- `encodeQuestion()`: 加载 cognitiveLoad/complexity 特征
- `predict()`: 基于特征和嵌入预测正确率
- `encodeAnswer()`: 触发 gated weight 更新
- `saveStudentState()`: 持久化学习状态

### 6.2 推荐算法

```
推荐条件 (CTG > 0):
1. P_complex = P_simple × exp(-w·ΔC) × CTG > 阈值
2. 知识点未完全掌握 (mastery < 0.85)
3. 复杂度略高于当前水平 (ΔC ∈ [0.1, 0.3])
```

### 6.3 学习进度可视化

**路由**: `/progress`

```
┌────────────────────────────────────────────────────────────┐
│  学习进度                                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  总体掌握度: 78%  ████████████████████████████████░░░   │
│                                                            │
│  知识点进度:                                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 二次函数基础        █████████████████████░░░░░░ 85% │  │
│  │ 二次函数应用        ████████████████░░░░░░░░░░░ 65% │  │
│  │ 顶点坐标求解        ██████████████████░░░░░░░░░ 75% │  │
│  │ 实际问题建模        ████████░░░░░░░░░░░░░░░░░░░ 40% │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  [推荐下一题: 实际问题建模]                                  │
└────────────────────────────────────────────────────────────┘
```

---

## 7. 数据库 Schema

### 7.1 Question 扩展 (已实现)

```prisma
model Question {
  // ... 现有字段

  // Complexity feature extraction
  cognitiveLoad      Float?
  reasoningDepth     Float?
  complexity         Float?
  extractionStatus   String   @default("PENDING")
  featuresExtractedAt DateTime?
  extractionError    String?
  extractionModel    String?
  extractionConfidence Float?  // 新增: 置信度

  @@index([extractionStatus])
}

model UOKState {
  id            String   @id @default(cuid())
  studentId    String   @unique
  knowledge    String   @default("{}")
  attemptCount Int      @default(0)
  correctCount Int      @default(0)
  embedding    String?
  lastUpdated  DateTime @default(now())
}

model UOKQuestionState {
  id            String   @id @default(cuid())
  questionId    String   @unique
  topic         String?
  attemptCount  Int      @default(0)
  correctCount  Int      @default(0)
  embedding     String?
  lastUpdated   DateTime @default(now())
}
```

---

## 8. API 端点

### 8.1 Complexity Extractor

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/admin/complexity/extract` | POST | 单题提取 |
| `/api/admin/complexity/batch` | POST | 批量提取 |
| `/api/admin/complexity/status` | GET | 状态统计 |

### 8.2 QIE Kernel

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/qie/encode/question` | POST | 编码题目 |
| `/api/qie/encode/answer` | POST | 记录答案 |
| `/api/qie/predict` | POST | 预测正确率 |
| `/api/qie/explain` | GET | 解释 |
| `/api/qie/monitor` | GET | 权重监控 |

### 8.3 Student

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/practice/start` | POST | 开始练习 |
| `/api/practice/submit` | POST | 提交答案 |
| `/api/progress` | GET | 学习进度 |

---

## 9. 验证与交付

### 9.1 验证清单

- [ ] MiniMax API 调用成功 (Phase 1)
- [ ] 抽检 20 题准确率 > 80%
- [ ] 全量 1063 题重新提取 (Phase 1)
- [ ] 管理后台显示正确 (Phase 2)
- [ ] 学生端预测显示正确 (Phase 3)
- [ ] 答题反馈触发权重更新 (Phase 4)
- [ ] 推荐算法按 CTG > 0 选题 (Phase 4)

### 9.2 交付标准

- 所有题目有 cognitiveLoad/reasoningDepth/complexity
- 预测 API 响应 < 200ms
- 管理后台可操作
- 学生端可正常练习
