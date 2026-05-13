# DeepTutor 题目生成模块移植设计 v3

> 基于 Round 2 Swarm Review 修订

## 目标

移植 DeepTutor 题目生成核心功能，实现从主题生成高质量数学题

## 移植范围

### P0 - 核心功能

| 组件 | 说明 |
|------|------|
| 数据模型 | QuestionTemplate, QAPair, GenerationResult |
| IdeaAgent | 模板生成 Agent（含内置 Prompt）|
| Generator | 题目生成 Agent（含内置 Prompt）|
| AgentCoordinator | 流程协调器（批处理 + 去重 + 常量配置）|
| REST API | `/api/questions/deeptutor/generate` |

### v2 - 延后实现

- answer_now 快速模式
- mimic 模式（PDF 试卷模仿）
- RAG/web_search/code_execution 工具
- 持久化 summary.json

## 架构设计（简化版）

```
app/api/questions/deeptutor/generate/route.ts
                    │
                    ▼
lib/deeptutor/coordinator.ts (含常量配置)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
lib/deeptutor/idea-agent.ts  lib/deeptutor/generator.ts
        │                       │
        └───────────┬───────────┘
                    ▼
lib/ai/generation/minimax.ts (扩展 callLLM + parseJSONResponse)
```

**文件数：** 4 个（models.ts, coordinator.ts, idea-agent.ts, generator.ts）

> **备选方案（3 文件）**：可将 generator.ts 合并到 coordinator.ts，但推荐 4 文件方案以保持职责分离。

## 数据模型

```typescript
// lib/deeptutor/models.ts
//
// DeepTutor 类型系统（独立于现有 GeneratedQuestionType）
// 现有系统：fill_blank | multiple_choice | short_answer
// DeepTutor：choice | written | calculation
// 两者不共享，未来如需统一可添加映射函数

type DeepTutorQuestionType = 'choice' | 'written' | 'calculation';
type Difficulty = 'easy' | 'medium' | 'hard';

// 题目模板（v3: 添加 rationale 字段）
interface QuestionTemplate {
  question_id: string;
  concentration: string;
  question_type: DeepTutorQuestionType;
  difficulty: Difficulty;
  source: 'custom';
  rationale?: string;  // IdeaAgent 生成的设计理由
}

// 问答对
interface QAPair {
  question_id: string;
  question: string;
  question_type: DeepTutorQuestionType;
  options?: Record<string, string>;
  correct_answer: string;
  explanation: string;
  concentration: string;
  difficulty: Difficulty;
}

// 生成请求
interface GenerationRequest {
  mode: 'custom';  // v1 只支持 custom
  topic: string;
  preference?: string;
  knowledgeContext?: string;
  count: number;
  difficulty?: Difficulty;
  questionType?: DeepTutorQuestionType;
}

// 生成结果
interface GenerationResult {
  success: boolean;
  error?: string;
  source: 'topic';
  requested: number;
  template_count: number;
  completed: number;
  failed: number;
  results: Array<{
    template: QuestionTemplate;
    qa_pair: QAPair;
    success: boolean;
  }>;
}
```

## 文件结构

```
lib/deeptutor/
├── models.ts           # 数据模型
├── idea-agent.ts       # IdeaAgent + 内置 PROMPT
├── generator.ts        # Generator + 内置 PROMPT
└── coordinator.ts      # AgentCoordinator + 常量配置

app/api/questions/deeptutor/
└── generate/route.ts   # REST API（直接调用 coordinator）

lib/ai/generation/minimax.ts (扩展)
├── callLLM()           # 新增：通用 LLM 调用
└── parseJSONResponse() # 新增：通用 JSON 解析
```

## API 规范

### POST /api/questions/deeptutor/generate

**请求体：**
```json
{
  "mode": "custom",
  "topic": "一元二次方程的求解",
  "preference": "高中数学，侧重基础概念",
  "knowledgeContext": "一元二次方程是形如...",
  "count": 5,
  "difficulty": "medium",
  "questionType": "choice"
}
```

**成功响应 (200)：**
```json
{
  "success": true,
  "requested": 5,
  "template_count": 5,
  "completed": 5,
  "failed": 0,
  "results": [
    {
      "template": {
        "question_id": "q_1",
        "concentration": "一元二次方程因式分解法的基本识别与应用",
        "question_type": "choice",
        "difficulty": "easy",
        "source": "custom",
        "rationale": "此题直接考察最基础的解法"
      },
      "qa_pair": {
        "question_id": "q_1",
        "question": "对于一元二次方程 x² + 8x + 7 = 0...",
        "question_type": "choice",
        "options": {"A": "添加16", "B": "添加8", "C": "添加4", "D": "添加7"},
        "correct_answer": "A",
        "explanation": "配方法的核心步骤...",
        "concentration": "一元二次方程因式分解法的基本识别与应用",
        "difficulty": "easy"
      },
      "success": true
    }
  ]
}
```

**错误响应：**
```json
// 400 参数验证失败
{
  "success": false,
  "error": "topic is required",
  "code": "INVALID_PARAMS"
}

// 400 mode 不支持
{
  "success": false,
  "error": "Invalid mode. Only \"custom\" is supported in v1.",
  "code": "INVALID_MODE"
}

// 500 LLM 调用失败
{
  "success": false,
  "error": "Failed to generate questions",
  "details": "LLM API timeout"
}
```

## Prompt 模板（内联到各 Agent）

### IdeaAgent (lib/deeptutor/idea-agent.ts)

```typescript
const IDEA_AGENT_SYSTEM = `你是考试题目设计流程中的 Idea Agent。
你的职责是基于知识内容提出多样、有效、可执行的出题方向。`;

const IDEA_AGENT_PROMPT = (params: {
  topic: string;
  preference: string;
  knowledgeContext: string;
  existingConcentrations: string;
  numIdeas: number;
}) => `主题：
${params.topic}

用户偏好：
${params.preference}

知识依据：
${params.knowledgeContext}

前几批已经使用过的考察点：
${params.existingConcentrations || '无'}

请生成恰好 ${params.numIdeas} 个候选出题创意。

question_type 只允许：choice / written / calculation

仅返回 JSON：
{
  "ideas": [
    {
      "idea_id": "idea_1",
      "concentration": "该题主要考察点",
      "question_type": "choice | written | calculation",
      "difficulty": "easy 或 medium 或 hard",
      "rationale": "该创意的价值"
    }
  ]
}`;
```

### Generator (lib/deeptutor/generator.ts)

```typescript
const GENERATOR_SYSTEM = `你是题目生成流程中的 Generator。
从结构化的 QuestionTemplate 生成高质量的问答对。`;

const GENERATOR_PROMPT = (params: {
  template: QuestionTemplate;
  topic: string;
  knowledgeContext: string;
  previousQuestions: string;
}) => `QuestionTemplate:
${JSON.stringify(params.template, null, 2)}

用户主题：
${params.topic}

知识依据：
${params.knowledgeContext}

已生成的题目（你的新题目必须与所有这些题目不同）：
${params.previousQuestions || '无'}

要求：
- 严格保持与 template.concentration 和 template.difficulty 一致
- 严格遵守 template.question_type
- choice 类型：4个选项，正确答案不能明显更长
- written/calculation 类型：不提供选项
- 提供清晰的解释

仅返回 JSON：
{
  "question_type": "choice 或 written 或 calculation",
  "question": "题目内容",
  "options": {"A":"...","B":"...","C":"...","D":"..."} 或 null,
  "correct_answer": "选择题用选项键；简答/计算题用参考答案本身",
  "explanation": "详细解释"
}`;
```

## LLM 集成

### 扩展 lib/ai/generation/minimax.ts

```typescript
// lib/ai/generation/minimax.ts 新增

export interface LLMRequest {
  systemPrompt?: string;
  userPrompt: string;
}

export async function callLLM(request: LLMRequest): Promise<string> {
  const config = getAIConfig();

  // 组合 system 和 user prompt
  const prompt = request.systemPrompt
    ? `${request.systemPrompt}\n\n${request.userPrompt}`
    : request.userPrompt;

  // 复用现有 callMimoAPI 的重试和错误处理逻辑
  const response = await retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const res = await fetch(`${config.baseURL}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const error = await res.text();
          throw new Error(`LLM API ${res.status}: ${error}`);
        }

        const data = await res.json() as {
          error?: { message: string };
          content?: Array<{ type: string; text?: string }>;
        };

        if (data.error) {
          throw new Error(`LLM API error: ${data.error.message}`);
        }

        const textBlocks = data.content
          ?.filter((block) => block.type === 'text' && block.text)
          .map((block) => block.text || '');

        const content = textBlocks.join('');
        if (!content) {
          throw new Error('LLM API: no text content in response');
        }

        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    config.retryConfig
  );

  return response;
}

export function parseJSONResponse<T>(raw: string): T | null {
  // 清理 markdown 代码块
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export function safeParseJSON<T>(raw: string, fallback: T): T {
  const result = parseJSONResponse<T>(raw);
  return result !== null ? result : fallback;
}
```

## 数据流

### 完整流程

```
1. API 请求 → validate() → GenerationRequest
2. Coordinator.generate()
   ├─ 初始化 usedConcentrations = []
   ├─ 初始化 generatedQuestions = []
   ├─ while (templates.length < requested)
   │  ├─ numIdeas = Math.min(BATCH_SIZE, requested - templates.length)
   │  ├─ IdeaAgent.process(existingConcentrations, numIdeas)
   │  │  └─ 返回 QuestionTemplate[]
   │  ├─ usedConcentrations.add(...newTemplates.map(t => t.concentration.toLowerCase()))
   │  └─ templates.push(...newTemplates)
   └─ for each template
      ├─ Generator.process(template, previousQuestions)
      │  └─ 返回 QAPair
      ├─ results.push({template, qa_pair, success})
      └─ generatedQuestions.push(qa_pair)
3. 返回 GenerationResult
```

### 状态管理

```typescript
// coordinator.ts 内部状态
class AgentCoordinator {
  private ideaAgent: IdeaAgent;
  private generator: Generator;
  private usedConcentrations = new Set<string>();
  private generatedQuestions: QAPair[] = [];

  constructor() {
    this.ideaAgent = new IdeaAgent();
    this.generator = new Generator();
  }

  // 主入口：生成题目
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    // 完整实现见数据流部分
    // ...
  }

  private updateConcentrations(templates: QuestionTemplate[]) {
    templates.forEach(t => this.usedConcentrations.add(t.concentration.toLowerCase()));
  }

  private getConcentrationsPlaceholder(): string {
    return Array.from(this.usedConcentrations).join(', ') || '无';
  }

  private getPreviousQuestionsPlaceholder(): string {
    return this.generatedQuestions.map(q => q.question).join('\n') || '无';
  }
}
```

## 配置管理（内联到 coordinator.ts）

```typescript
// lib/deeptutor/coordinator.ts 顶部

const BATCH_SIZE = 5;
const MAX_QUESTIONS = 50;
const DEFAULT_COUNT = 3;
```

## 错误处理

### 输入验证

```typescript
// app/api/questions/deeptutor/generate/route.ts

function validateRequest(body: any): body is GenerationRequest {
  if (!body.topic || typeof body.topic !== 'string') {
    throw new Error('topic is required');
  }
  if (body.mode !== 'custom') {
    throw new Error('Invalid mode. Only "custom" is supported in v1.');
  }
  if (body.count < 1 || body.count > MAX_QUESTIONS) {
    throw new Error(`count must be between 1 and ${MAX_QUESTIONS}`);
  }
  return true;
}
```

### LLM 错误处理

```typescript
// 任何 LLM 调用失败都包装为错误响应
try {
  const qaPair = await generator.process(template);
  results.push({ template, qa_pair, success: true });
} catch (error) {
  // fallback QAPair，保持类型完整
  const fallbackQAPair: QAPair = {
    question_id: template.question_id,
    question: `[生成失败] ${template.concentration}`,
    question_type: template.question_type,
    correct_answer: 'N/A',
    explanation: String(error),
    concentration: template.concentration,
    difficulty: template.difficulty,
  };

  // choice 类型需要 options 字段（其他类型的 options 保持 undefined）
  if (template.question_type === 'choice') {
    fallbackQAPair.options = {
      A: '生成失败，请重试',
      B: '生成失败，请重试',
      C: '生成失败，请重试',
      D: '生成失败，请重试',
    };
  }
  // TypeScript 类型说明：QAPair.options 是可选字段，条件赋值后类型正确

  results.push({
    template,
    qa_pair: fallbackQAPair,
    success: false,
  });
}
```

## 实现计划

### Phase 1: 基础设施

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 1.1 | 创建 lib/deeptutor/models.ts | `pnpm build` → exit code 0 |
| 1.2 | 扩展 lib/ai/generation/minimax.ts | `grep "callLLM" lib/ai/generation/minimax.ts` → 有输出 |
| 1.3 | 验证扩展函数可调用 | `npx tsx -e "import('./lib/ai/generation/minimax.ts').then(m => console.log(typeof m.callLLM === 'function' ? 'OK' : 'FAIL'))"` → 输出 OK |

### Phase 2: Agent 实现

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 2.1 | 创建 lib/deeptutor/idea-agent.ts | `test -f lib/deeptutor/idea-agent.ts && echo exists` |
| 2.2 | 创建 scripts/test-idea-agent.ts | `test -f scripts/test-idea-agent.ts && echo exists` |
| 2.3 | 测试 IdeaAgent | `npx tsx scripts/test-idea-agent.ts` → 返回 ideas 数组 |
| 2.4 | 创建 lib/deeptutor/generator.ts | `test -f lib/deeptutor/generator.ts && echo exists` |
| 2.5 | 创建 scripts/test-generator.ts | `test -f scripts/test-generator.ts && echo exists` |
| 2.6 | 测试 Generator | `npx tsx scripts/test-generator.ts` → 返回 QAPair |

### Phase 3: 协调器与服务

| Step | Action | Verification Gate |
|------|--------|-------------------|
| 3.1 | 创建 lib/deeptutor/coordinator.ts | `test -f lib/deeptutor/coordinator.ts && echo exists` |
| 3.2 | 创建 API 端点 | `test -f app/api/questions/deeptutor/generate/route.ts && echo exists` |
| 3.3 | 端到端测试 | `curl -X POST http://localhost:3000/api/questions/deeptutor/generate -H "Content-Type: application/json" -d '{"mode":"custom","topic":"一元二次方程","count":1}'` → 返回 JSON（注：开发环境无需额外认证） |

## 验证标准

| 功能 | 验证方法 |
|------|----------|
| 数据模型 | `pnpm build` → 类型检查通过 |
| IdeaAgent | `npx tsx scripts/test-idea-agent.ts` → `ideas.length === 5` |
| Generator | `npx tsx scripts/test-generator.ts` → `options && Object.keys(options).length === 4` |
| 批处理 | 请求 10 题 → 返回 `results.length === 10` |
| 去重 | 相同 topic 两次请求 → 考察点不重复 |
| API | `curl -X POST http://localhost:3000/api/questions/deeptutor/generate -H "Content-Type: application/json" -d '{"mode":"custom","topic":"测试","count":3}'` → `success === true && results.length === 3` |

## 风险与缓解

| 风险 | 缓解措施 | 验证命令 |
|------|----------|----------|
| JSON 解析失败 | safeParseJSON + 默认值 | `npx tsx -e "import('./lib/ai/generation/minimax.ts').then(m => console.log(m.safeParseJSON('invalid', {})))"` |
| API 端点错误 | 复用现有 baseURL 格式 | `grep "v1/messages" lib/ai/generation/minimax.ts` → 有输出 |
| rationale 字段缺失 | 已添加到模型 | `grep "rationale" lib/deeptutor/models.ts` → 有输出 |
