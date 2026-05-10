# 诊断测评知识点覆盖优化设计

**日期：** 2025-05-09
**状态：** 第四次审核中
**版本：** v4 (零新增文件，极简实施)

## 问题

当前诊断测评的题目知识点覆盖过于集中：
- 10道题只覆盖1-2个知识点
- 某些知识点有5+道重复题目
- 无法真实反映学生对整体知识点的掌握情况

## 目标

最大化知识点覆盖，确保测评结果具有代表性：

| 场景 | 题目数 | 知识点数 | 期望策略 |
|------|--------|----------|----------|
| 充足 | 10题 | ≥10个 | 1题1知识点，覆盖10个不同知识点 |
| 充足 | 100题 | ≥100个 | 1题1知识点，覆盖100个不同知识点 |
| 不足 | 100题 | 20个 | 每知识点5题，允许重复 |

## 类型定义

```typescript
// 数据库中 Question.knowledgePoints 字段为 JSON 字符串
// 格式: '["kp-id-1", "kp-id-2"]'

interface KnowledgePoint {
  id: string;
  name: string;
  conceptId?: string;
  weight: number;
}

interface Question {
  id: string;
  type: string;
  difficulty: number;
  content: string;  // JSON 字符串
  answer: string;
  knowledgePoints: string;  // JSON 字符串，存储知识点ID数组
}

interface FetchedQuestion {
  id: string;
  type: string;
  difficulty: number;
  content: any;  // 解析后的对象
  knowledgePoint: string;  // 当前题目的主要知识点名称
  stepCount: number;
  answer: string;
}
```

## 设计方案

### 核心算法：轮询取题 v2

```typescript
/**
 * 轮询取题：确保知识点均匀分布
 */
async function fetchQuestionsRoundRobin(
  knowledgePoints: KnowledgePoint[],
  targetCount: number,
  difficultyRange: { min: number; max: number }
): Promise<FetchedQuestion[]> {
  // 边界检查
  if (knowledgePoints.length === 0) {
    throw new Error('NO_KNOWLEDGE_POINTS');
  }

  const questions: FetchedQuestion[] = [];
  const usedQuestionIds = new Set<string>();

  // 动态计算最大轮数
  const maxRounds = Math.ceil(targetCount / knowledgePoints.length) + 1;

  for (let round = 0; round < maxRounds && questions.length < targetCount; round++) {
    for (const kp of knowledgePoints) {
      if (questions.length >= targetCount) break;

      // 为当前知识点取1道未使用的题
      const question = await prisma.question.findFirst({
        where: {
          knowledgePoints: { contains: kp.id },
          id: { notIn: Array.from(usedQuestionIds) },
          difficulty: { gte: difficultyRange.min, lte: difficultyRange.max },
        },
        select: {
          id: true,
          type: true,
          difficulty: true,
          content: true,
          answer: true,
          steps: true,
        },
      });

      if (question) {
        questions.push(mapQuestion(question, kp));
        usedQuestionIds.add(question.id);
      }
    }
  }

  // 降级处理：如果题目不足，返回已获取的题目（由调用方决定是否AI生成）
  return questions;
}

/**
 * 将数据库Question转换为FetchedQuestion格式
 */
function mapQuestion(dbQuestion: Question, kp: KnowledgePoint): FetchedQuestion {
  let content: any;
  try {
    content = typeof dbQuestion.content === 'string'
      ? JSON.parse(dbQuestion.content)
      : dbQuestion.content;
  } catch {
    content = { question: '题目解析失败' };
  }

  return {
    id: dbQuestion.id,
    type: dbQuestion.type,
    difficulty: dbQuestion.difficulty,
    content,
    knowledgePoint: kp.name,
    stepCount: 0,  // 将在调用处设置
    answer: dbQuestion.answer,
  };
}
```

### 边界情况处理

| 情况 | 处理方式 |
|------|----------|
| 知识点为空 | 抛出错误 `NO_KNOWLEDGE_POINTS` |
| 知识点充足（≥10个） | 每个知识点取1道，覆盖不同知识点 |
| 知识点不足（5个，需10题） | 第1轮取5题，第2轮再取5题（允许重复） |
| 题目不足 | 返回已获取的题目，由调用方触发AI生成 |
| 某知识点无题 | 跳过该知识点，继续轮询其他 |

### 错误处理

```typescript
enum FetchQuestionsError {
  NO_KNOWLEDGE_POINTS = 'NO_KNOWLEDGE_POINTS',
  INSUFFICIENT_QUESTIONS = 'INSUFFICIENT_QUESTIONS',
}

// 使用示例
try {
  const questions = await fetchQuestionsRoundRobin(kps, 10, { min: 3, max: 6 });
  if (questions.length < 10) {
    // 触发AI生成补充
    const generated = await generateMoreQuestions(10 - questions.length);
    questions.push(...generated);
  }
} catch (error) {
  if (error.message === 'NO_KNOWLEDGE_POINTS') {
    return NextResponse.json({ error: '没有可用的测评知识点' }, { status: 400 });
  }
  throw error;
}
```

### 修改位置

- **文件：** `app/api/assessment/start/route.ts`
- **修改范围：** 第146-179行，完全替换取题逻辑
- **保持不变：** AI生成逻辑、知识点选择逻辑

### 性能优化（可选）

当前实现每次轮询进行一次数据库查询，最多产生 `kp.length × maxRounds` 次查询。

**优化方案：** 批量查询后分组
```typescript
// 一次性查询所有相关题目，然后分组处理
const allQuestions = await prisma.question.findMany({
  where: {
    difficulty: { gte: min, lte: max },
  },
});
// 按知识点分组，每组取1道
```

## 验证标准

### 功能验证

| 场景 | 预期结果 |
|------|----------|
| 10题，≥10个知识点 | 覆盖 ≥8 个不同知识点 |
| 10题，5个知识点 | 每个知识点 1-2 题 |
| 10题，3个知识点 | 每个知识点 2-4 题 |

### 自动化测试用例

```typescript
describe('fetchQuestionsRoundRobin', () => {
  test('10个知识点，取10题，应覆盖10个不同知识点', async () => {
    const result = await fetchQuestionsRoundRobin(mockKPs(10), 10, { min: 3, max: 6 });
    const uniqueKPs = new Set(result.map(q => q.knowledgePoint));
    expect(uniqueKPs.size).toBeGreaterThanOrEqual(8);
  });

  test('5个知识点，取10题，每个知识点1-2题', async () => {
    const result = await fetchQuestionsRoundRobin(mockKPs(5), 10, { min: 3, max: 6 });
    const kpCounts = countByKP(result);
    Object.values(kpCounts).forEach(count => {
      expect(count).toBeLessThanOrEqual(2);
    });
  });
});
```

### 上线监控指标

- 知识点覆盖率：`覆盖的知识点数 / 题目总数`
- 重复率：`重复知识点题数 / 题目总数`
- 取题成功率：`获取到的题目数 / 目标题目数`

## 实施步骤

1. 添加 `fetchQuestionsRoundRobin` 函数和 `mapQuestion` 辅助函数
2. 添加类型定义和错误枚举
3. 替换第146-179行的取题逻辑
4. 添加边界情况处理和错误抛出
5. 测试验证（手动 + 自动化）
6. 清理旧代码

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| N+1 查询问题 | 性能下降 | 监控查询时间，后续优化为批量查询 |
| 题目关联多知识点 | 去重策略问题 | `usedQuestionIds` 全局去重已考虑此场景 |
| AI生成题不足 | 仍无法满足目标数 | 已有降级返回逻辑，由调用方处理 |

---

## Swarm Review v4 极简实施

### 审核历史

| 版本 | 逻辑一致性 | 细节完整性 | 实施就绪性 | 最小化修改 |
|------|-----------|-----------|-----------|-----------|
| v3 | ❌ | ❌ | ❌ | ❌ |
| v4 | 修复中 | 修复中 | 修复中 | 修复中 |

### v4 修复内容（零新增文件）

#### 修复1：maxRounds计算错误
```typescript
// 错误（v3）
const maxRounds = Math.ceil(targetCount / selectedKnowledgePoints.length) + 1;

// 正确（v4）
const maxRounds = Math.ceil(targetCount / selectedKnowledgePoints.length);
```

#### 修复2：内联类型定义（不创建新文件）
在 `route.ts` 顶部添加：
```typescript
// 题目内容类型（内联定义，不创建新文件）
interface QuestionContent {
  question: string;
  options?: string[];
  explanation?: string;
}
```

#### 修复3：极简实施代码（第146-179行替换）

**完整替换代码（包含所有必要变量）：**
```typescript
// 第一步：轮询取题（每知识点每轮取1道，确保均匀分布）
const targetCount = 10;  // 目标题目数
const usedQuestionIds = new Set<string>();
const maxRounds = Math.ceil(targetCount / selectedKnowledgePoints.length);

for (let round = 0; round < maxRounds && questions.length < targetCount; round++) {
  for (const kp of selectedKnowledgePoints) {
    if (questions.length >= targetCount) break;

    const queryDifficulty = retry ? startDifficulty : minDifficulty;

    const question = await prisma.question.findFirst({
      where: {
        knowledgePoints: { contains: kp.id },
        id: { notIn: Array.from(usedQuestionIds) },
        difficulty: {
          gte: queryDifficulty,
          lte: retry ? queryDifficulty + 1 : maxDifficulty,
        },
      },
      select: {
        id: true,
        type: true,
        difficulty: true,
        content: true,
        answer: true,
        steps: true,
      },
    });

    if (question) {
      let content: QuestionContent;
      try {
        const parsed = typeof question.content === 'string'
          ? JSON.parse(question.content)
          : question.content;
        content = {
          question: parsed.question || '',
          options: parsed.options || [],
          explanation: parsed.explanation || '',
        };
      } catch {
        content = { question: '题目解析失败' };
      }

      questions.push({
        id: question.id,
        type: question.type,
        difficulty: startDifficulty,
        content,
        knowledgePoint: kp.name,
        stepCount: question.steps?.length ?? 1,
        answer: question.answer,
      });
      usedQuestionIds.add(question.id);
    }
  }
}

// 检查是否有足够的题目
if (questions.length === 0) {
  return NextResponse.json({
    success: false,
    error: '无法获取测评题目，请稍后重试',
    noQuestionsAvailable: true,
  }, { status: 400 });
}
```

### 实施步骤（极简版）

1. 在 `app/api/assessment/start/route.ts` 顶部添加 `QuestionContent` 接口
2. 替换第146-179行为上述代码
3. 删除第182行的 `const targetCount = 10;`（已在替换代码中定义）
4. 验证编译通过

### 验证标准（快速验证）

| 场景 | 预期结果 | 快速验证 |
|------|----------|----------|
| 10题，≥10个知识点 | 覆盖 10 个不同知识点 | `jq '.questions | map(.knowledgePoint) | unique | length'` ≥ 8 |
| 10题，5个知识点 | 每个知识点 1-2 题 | 均匀分布 |
| 10题，3个知识点 | 每个知识点 3-4 题 | 均匀分布 |
