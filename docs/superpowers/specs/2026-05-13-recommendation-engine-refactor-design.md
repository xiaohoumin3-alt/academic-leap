# 推荐引擎重构设计方案

**日期**: 2026-05-13
**问题**: "没有可用的推荐题目" - 数据+应用双重问题
**方案**: 激进重构 - 推荐引擎

---

## 1. 背景与问题分析

### 1.1 问题根因

| 层级 | 问题 | 影响 |
|------|------|------|
| 数据架构 | `UserKnowledge.knowledgePointId`(ID) vs `Question.knowledgePoints`(Name) 语义不一致 | 匹配失败，推荐返回 null |
| 数据架构 | JSON 字段无法 SQL 索引，内存过滤性能差 | 规模扩展瓶颈 |
| 数据架构 | DeepTutor 生成题目未触发复杂度提取 (`extractionStatus=PENDING`) | 生成的题目永远不可用 |
| 应用架构 | DeepTutor 未集成到推荐流程 | 题库空时无兜底 |
| 应用架构 | UOK 承担太多职责（状态机+ML+查询+错误处理） | 职责不清，维护困难 |
| 应用架构 | 错误消息不区分原因 (`null` 不知道是题库空还是已掌握) | 用户体验差 |

### 1.2 数据流现状

```
用户请求 → UOK.act('next_question') → 找到 weakTopic
         → findQuestionByTopic(topic) → 查询题库
         → 题库空或匹配失败 → 返回 null
         → 前端显示 "没有可用的推荐题目"
```

---

## 2. 设计目标

### 2.1 核心目标

1. **知识点语义统一**：全部使用 ID，不再有 ID-Name 映射
2. **DeepTutor 集成闭环**：题库空时自动触发生成，生成后自动提取复杂度
3. **UOK 职责分离**：UOK 只做 ML 决策（状态机+预测），移除持久化和查询逻辑
4. **统一错误响应**：区分不同失败原因，提供可执行的操作提示

### 2.2 成功标准

- 用户请求推荐时，始终返回题目（除非真正没有知识点数据）
- 题库空时，DeepTutor 自动生成题目作为兜底
- 所有错误消息可操作，用户知道下一步该做什么
- 新架构支持水平扩展（10k+ 题目）

---

## 3. 架构设计

### 3.1 目标架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           推荐请求流程                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   用户请求 ──▶ 推荐服务 (RecommendationService)                         │
│                      │                                                  │
│                      ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │  1. UOK.act('next_question', studentId)                     │      │
│   │     → 返回 weakTopic (知识点ID)                             │      │
│   │     → 职责：ML 决策，状态机                                  │      │
│   └─────────────────────────────────────────────────────────────┘      │
│                      │                                                  │
│                      ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │  2. QuestionRepository.findByTopic(topicId, excludeIds)      │      │
│   │     → 职责：题库查询，知识点语义用 ID                         │      │
│   │     → 返回：Question | null                                  │      │
│   └─────────────────────────────────────────────────────────────┘      │
│                      │                                                  │
│         ┌────────────┴────────────┐                                    │
│         ▼                         ▼                                    │
│    ┌─────────┐              ┌─────────────┐                            │
│    │ 有题目  │              │ 题库为空    │                            │
│    │ ✅ 返回 │              │ → 触发生成   │                            │
│    └─────────┘              └─────────────┘                            │
│                                  │                                       │
│                                  ▼                                       │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │  3. DeepTutorGenerator.generate(topicId, count: 5)           │      │
│   │     → 生成题目                                                │      │
│   │     → 自动触发复杂度提取                                      │      │
│   │     → 存入题库 (extractionStatus=SUCCESS)                    │      │
│   └─────────────────────────────────────────────────────────────┘      │
│                      │                                                  │
│                      ▼                                                  │
│              返回生成的题目                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 核心模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| **RecommendationService** | 编排推荐流程，协调各组件 | UOK, QuestionRepository, DeepTutorGenerator |
| **UOK** | 状态机 + ML 预测（只做决策） | 无 |
| **QuestionRepository** | 题库查询（使用知识点ID） | Prisma |
| **DeepTutorGenerator** | AI 生成题目 + 复杂度提取 | DeepTutor API, QuestionRepository |
| **ErrorHandler** | 统一错误响应，区分原因 | RecommendationService |

### 3.3 数据模型设计

#### 3.3.1 Question 表 - 知识点存储改为 ID 引用

```prisma
model Question {
  id              String @id @default(cuid())
  extractionStatus String @default("PENDING")

  // 改为存储知识点ID列表，而不是名称列表
  knowledgePointIds String[]  // ["kp17-2-folding"] 替代 ["勾股定理"]

  complexity     Float?
  cognitiveLoad   Float?
  reasoningDepth Float?
  difficulty     Int

  steps QuestionStep[]

  @@index([extractionStatus])
  @@index([knowledgePointIds])  // 可以索引 String[]
}
```

**迁移策略**：
1. 阶段一：新增 `knowledgePointIds String[]` 字段，同时双写（新旧字段都写入）
2. 阶段一：写脚本将 `knowledgePoints` (Name) 转换为 ID，写入 `knowledgePointIds`
3. 阶段一：验证数据正确性（Name→ID 转换 100% 成功）
4. 阶段六之后（所有消费者切换完成后）：删除 `knowledgePoint` 旧字段

**回滚策略**：如阶段一失败，删除新字段，恢复旧字段

#### 3.3.2 KnowledgePoint 表 - 保持不变，验证唯一性

```prisma
model KnowledgePoint {
  id        String @id  // "kp17-2-folding"
  name      String      // "勾股定理折叠问题"
  chapterId String

  @@unique([id])  // 确保 ID 唯一性
}
```

#### 3.3.3 DeepTutor 生成后自动触发复杂度提取

```typescript
// DeepTutorGenerator.generate() 结束时
async generate(request: GenerateRequest): Promise<QAPair[]> {
  const results = await this.coordinator.generate(request);

  for (const qa of results) {
    // 1. 查找或创建知识点（获取 ID）
    const kpId = await this.ensureKnowledgePoint(qa.concentration);

    // 2. 保存题目
    const question = await prisma.question.create({
      data: {
        // ...
        knowledgePointIds: [kpId],  // 使用 ID，不是名称
        extractionStatus: 'PROCESSING',  // 立即设为处理中
      }
    });

    // 3. 触发复杂度提取（异步）
    this.enqueueComplexityExtraction(question.id);
  }

  return results;
}

// 复杂度提取完成后
async onComplexityExtracted(questionId: string, result: ExtractionResult) {
  await prisma.question.update({
    where: { id: questionId },
    data: {
      extractionStatus: 'SUCCESS',
      complexity: result.complexity,
      cognitiveLoad: result.cognitiveLoad,
      reasoningDepth: result.reasoningDepth,
    }
  });

  // 4. 通知推荐服务：题目可用
  await this.recommendationService.notifyQuestionAvailable(questionId);
}
```

### 3.4 UOK 职责分离

#### 当前问题
```typescript
class UOK {
  private state: UOKState {
    questions: Map,      // 内存缓存（不需要）
    students: Map,      // 内存缓存（不需要）
    // ...
  };

  async loadStudentState() {
    // 从 UOKState 表加载（持久化层）
    // 从 UserKnowledge 表加载（业务层）
    // 两套状态，没有同步机制
  }
}
```

#### 目标：UOK 只做 ML 决策

```typescript
class UOK {
  // 只负责决策，不负责持久化
  async act(intent: string, studentId: string): Promise<Action> {
    // 1. 接收知识点数据（由调用方提供）
    const knowledge = await this.loadKnowledge(studentId);  // 纯内存操作

    // 2. ML 决策
    if (knowledge.isEmpty()) {
      return { type: 'gap_report', gaps: [] };
    }

    const weakest = this.findWeakestTopic(knowledge);
    return { type: 'recommend', topic: weakest.id };  // 返回 ID
  }

  // 移除：
  // - saveStudentState()
  // - loadStudentState() 改为 loadKnowledge()
  // - Question 缓存逻辑
}
```

### 3.5 统一错误响应

#### 当前问题
```typescript
// 返回 null，前端无法区分原因
getRecommendation() → null
```

#### 目标：错误响应结构化、可操作

```typescript
interface RecommendationResponse {
  success: boolean;
  data?: {
    question: Question;
    beforeProbability: number;
    rationale: string;
  };
  error?: {
    code: ErrorCode;
    message: string;
    action: string;  // 用户可执行的操作
    details?: object;  // 调试信息（仅开发环境）
  };
}

enum ErrorCode {
  // 用户侧错误（需要用户操作）
  NEEDS_DIAGNOSTIC = 'NEEDS_DIAGNOSTIC',        // "请先完成诊断测评"
  NO_LEARNING_PATH = 'NO_LEARNING_PATH',        // "请先创建学习路径"
  ALL_TOPICS_MASTERED = 'ALL_TOPICS_MASTERED',  // "您已完成所有知识点的学习！"

  // 系统侧错误（需要系统操作）
  TOPIC_NO_QUESTIONS = 'TOPIC_NO_QUESTIONS',    // "正在为您生成题目..."
  GENERATION_FAILED = 'GENERATION_FAILED',      // "系统繁忙，请稍后重试"
  SYSTEM_ERROR = 'SYSTEM_ERROR',               // "服务器错误，请联系支持"

  // 数据错误（需要数据修复）
  NO_TOPICS_DEFINED = 'NO_TOPICS_DEFINED',      // "请联系管理员配置知识点"
}
```

#### 示例响应

```typescript
// 场景1：题库空，正在生成
{
  success: false,
  error: {
    code: 'TOPIC_NO_QUESTIONS',
    message: '当前知识点暂无可用题目',
    action: '正在为您智能生成题目，预计需要 10-15 秒...'
  }
}

// 场景2：所有知识点已掌握
{
  success: false,
  error: {
    code: 'ALL_TOPICS_MASTERED',
    message: '恭喜！您已完成所有知识点的学习',
    action: '可以回顾错题集，或联系老师开启下一阶段'
  }
}

// 场景3：诊断测评未完成
{
  success: false,
  error: {
    code: 'NEEDS_DIAGNOSTIC',
    message: '在开始个性化练习前，需要先了解您的学习起点',
    action: '点击这里完成诊断测评（约 10 分钟）'
  }
}
```

---

## 4. 实现计划

### 阶段一：数据模型迁移（不破坏现有功能）

1. 新增 `knowledgePointIds String[]` 字段
2. 写脚本将 `knowledgePoints` Name → ID
3. 验证数据正确性
4. 保留旧字段（向后兼容）

### 阶段二：QuestionRepository 重构

1. 新增 `findByTopicIds()` 方法（使用知识点ID）
2. 删除旧的 `findByTopicName()` 方法（不再需要名称匹配）
3. 添加 `notifyQuestionAvailable()` 方法
4. 单元测试覆盖
5. 验证：所有题库查询走 ID 路径，无 ID-Name 映射

### 阶段三：DeepTutor 集成闭环

1. 修改 DeepTutor 生成端点：生成后自动触发复杂度提取
2. 添加 `enqueueComplexityExtraction()` 队列
3. 复杂度提取完成后更新状态并通知

### 阶段四：RecommendationService 编排

1. 新增 RecommendationService 类
2. 协调 UOK + QuestionRepository + DeepTutorGenerator
3. 实现题库空时的兜底生成逻辑
4. 统一错误响应

### 阶段五：UOK 职责分离

1. 移除 UOK 中的持久化逻辑
2. 移除 Question 缓存逻辑
3. UOK 只保留状态机 + ML 决策
4. 添加 `loadKnowledge()` 纯内存方法

### 阶段六：API 层适配

1. 修改 `/api/uok/recommend/route.ts`
2. 使用新的 RecommendationService
3. 返回统一的错误响应结构
4. 前端适配（显示可操作错误消息）

---

## 5. 风险与缓解

| 风险 | 缓解措施 | 验证方法 |
|------|----------|----------|
| 数据迁移失败 | 分阶段迁移，保留旧字段可回滚 | 迁移前后数据对比 |
| DeepTutor 生成失败 | 添加重试机制 + 降级到父知识点 | 模拟失败场景测试 |
| UOK 职责分离破坏现有逻辑 | 先保留旧接口，渐进切换 | 全量回归测试 |
| 性能下降（新增查询） | 索引优化 + 缓存策略 | 负载测试 |

---

## 6. 测试策略

### 6.1 单元测试

- `QuestionRepository.findByTopicIds()` - ID 查询正确性
- `DeepTutorGenerator.generate()` - 生成+提取闭环
- `UOK.act()` - 决策逻辑（无持久化）
- `RecommendationService` - 编排逻辑

### 6.2 集成测试

- 完整推荐流程：请求 → UOK → QuestionRepository → 返回
- 题库空场景：请求 → 题库空 → DeepTutor生成 → 返回
- 错误场景：各类错误码的返回和展示

### 6.3 E2E 测试

- 用户完整流程：诊断测评 → 推荐练习 → 完成
- 错误恢复流程：题库空 → 自动生成 → 继续练习

---

## 7. 成功标准

| 指标 | 目标 |
|------|------|
| 指标 | 目标 |
|------|------|
| 推荐成功率 | 待测量 → 95%+ |
| 错误消息可操作性 | 100% 错误有对应 action |
| DeepTutor 生成题目可用率 | 100%（自动提取复杂度） |
| 知识点语义一致性 | 全部使用 ID，无 ID-Name 映射 |

---

## 8. 后续演进（不在本次范围）

1. **题库数据模型优化**：JSON → 关系表（支持 10k+ 题目规模）
2. **UOK 状态持久化**：考虑将 ML embeddings 存入专门表
3. **多生成器支持**：DeepTutor + 其他 AI 生成器
4. **推荐策略优化**：A/B 测试不同推荐算法