# 题目判题系统重构设计

> 以学生为中心的答题体验，清晰稳定的判题架构

## 背景

### 当前问题

1. **UX 问题**：强迫学生学习"编码系统"（1=是，0=否），完全不符合学生日常学习习惯
2. **架构问题**：判题逻辑硬编码在引擎中，与题目定义分离，三处必须同步
3. **维护问题**：每新增题型都要改 StepType 枚举、加判题 case、确保 params 约定

### 设计目标

| 特性 | 说明 |
|------|------|
| **自然** | 学生用日常习惯答题（点击"是"/"否"，输入数字） |
| **清晰** | 答题方式与题目类型一目了然 |
| **稳定** | 新增题型不改引擎代码 |
| **可靠** | 判题结果 100% 可预测 |
| **鲁棒** | 支持同义词、模糊匹配 |

---

## 核心设计

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                    新的数据流                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  模板定义                         判题引擎                  │
│  ├─ generateParams()              ├─ 通用解析逻辑          │
│  ├─ buildSteps() ──→ 步骤+判题规则 ├─ 执行规则             │
│  └─ render()                      │                       │
│                                  │ 规则类型：            │
│  判题规则在步骤中定义               │ ├─ number             │
│  判题引擎只负责执行规则             │ ├─ string             │
│                                  │ ├─ coordinate         │
│                                  │ ├─ yes_no             │
│                                  │ └─ choice             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心原则

> **学生应该用最自然的方式答题，系统负责理解**

---

## 数据结构

### AnswerMode 枚举

```typescript
/**
 * 答题方式 - 决定UI呈现
 */
enum AnswerMode {
  // 基础类型
  TEXT_INPUT = 'text',           // 文本输入框（计算题、填空题）
  YES_NO = 'yes_no',             // 是/否 按钮（判断题）
  MULTIPLE_CHOICE = 'choice',    // 选项按钮（选择题）

  // 数值/坐标类型
  NUMBER = 'number',             // 数字输入（带数字键盘）
  COORDINATE = 'coordinate',     // 坐标输入 (x,y)

  // 高级类型
  EXPRESSION = 'expression',     // 数学表达式（如 2x+3=7）
  FILL_BLANK = 'fill_blank',     // 多个填空
  ORDER = 'order',               // 排序题
  MATCH = 'match',               // 匹配题
}
```

### ExpectedAnswer 类型

```typescript
/**
 * 答案期望 - 判题用
 */
type ExpectedAnswer =
  // 数值答案（计算题）
  | { type: 'number'; value: number; tolerance?: number }

  // 字符串答案（支持同义词）
  | { type: 'string'; value: string; variants?: string[] }

  // 坐标答案
  | { type: 'coordinate'; x: number; y: number; tolerance?: number }

  // 判断题答案
  | { type: 'yes_no'; value: boolean }

  // 选择题答案（单选/多选）
  | { type: 'choice'; value: string | string[] }

  // 表达式答案
  | { type: 'expression'; value: string; simplified?: string }

  // 多空答案
  | { type: 'multi_fill'; values: Array<string | number> }

  // 排序答案
  | { type: 'order'; value: string[] }

  // 匹配答案
  | { type: 'match'; value: Record<string, string> };
```

### StepProtocol v2

```typescript
/**
 * 步骤协议 v2
 */
interface StepProtocol {
  stepId: string;

  // 答题方式（决定UI）
  answerMode: AnswerMode;

  // UI 描述
  ui: {
    instruction: string;         // 步骤指令
    inputPlaceholder?: string;   // 输入占位符
    hint?: string;               // 提示信息
  };

  // 选项（仅部分模式需要）
  options?: {
    // YES_NO 模式
    yes?: string;                // "是" 的文本，可自定义
    no?: string;                 // "否" 的文本，可自定义

    // MULTIPLE_CHOICE 模式
    choices?: Array<{            // 选择题选项
      value: string;
      label: string;
    }>;

    // 其他模式的扩展...
  };

  // 正确答案（判题用）
  expectedAnswer: ExpectedAnswer;

  // 键盘配置（仅 TEXT_INPUT/NUMBER 需 要）
  keyboard?: {
    type: 'numeric' | 'numpad' | 'math' | 'qwerty';
    extraKeys?: string[];
  };

  // 验证配置（可选）
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
  };
}

/**
 * 题目协议
 */
interface QuestionProtocol {
  id: string;
  knowledgePoint: string;
  templateId: string;
  difficultyLevel: number;
  params: Record<string, number>;
  steps: StepProtocol[];          // 使用 v2 协议
  content: {
    title: string;
    description: string;
    context?: string;
  };
  meta: {
    version: string;
    source: 'template_engine_v2';
  };
}
```

---

## 前端 UI 设计（混合方案）

### 基础组件

```
components/question-input/
├── BaseInput.tsx           # 基础输入框（TEXT_INPUT 通用）
├── YesNoInput.tsx          # 是/否 按钮（YES_NO 专用）
├── ChoiceInput.tsx         # 选项按钮（MULTIPLE_CHOICE 专用）
├── NumberInput.tsx         # 数字输入 + 数字键盘（NUMBER 专用）
└── CoordinateInput.tsx     # 坐标输入（COORDINATE 专用）
```

### UI 渲染逻辑

```typescript
// ExercisePage.tsx

function renderStepInput(step: StepProtocol) {
  switch (step.answerMode) {
    case AnswerMode.YES_NO:
      return <YesNoInput step={step} onSubmit={handleSubmit} />;

    case AnswerMode.MULTIPLE_CHOICE:
      return <ChoiceInput step={step} onSubmit={handleSubmit} />;

    case AnswerMode.NUMBER:
      return <NumberInput step={step} onSubmit={handleSubmit} />;

    case AnswerMode.COORDINATE:
      return <CoordinateInput step={step} onSubmit={handleSubmit} />;

    case AnswerMode.TEXT_INPUT:
    default:
      return <BaseInput step={step} onSubmit={handleSubmit} />;
  }
}
```

### UI 示例

#### YES_NO 模式（判断题）

```
┌─────────────────────────────────────────────┐
│  步骤 1                                     │
│                                             │
│  题目说"四条边都是7"——四条边长度相等吗？      │
│                                             │
│  ┌─────────┐  ┌─────────┐                   │
│  │   是    │  │   否    │                   │
│  └─────────┘  └─────────┘                   │
│                                             │
│  点击按钮作答                                │
└─────────────────────────────────────────────┘
```

#### NUMBER 模式（计算题）

```
┌─────────────────────────────────────────────┐
│  步骤 1                                     │
│                                             │
│  直角三角形，a=3, b=4，求斜边 c              │
│                                             │
│  ┌─────────────────────────────────────────┐ │
│  │           5                             │ │
│  └─────────────────────────────────────────┘ │
│                                             │
│  [7] [8] [9] [.] [←] [清除]                │
│  [4] [5] [6] [√] [π] [提交]                │
│  [1] [2] [3] [÷] [×] [  ]                  │
│  [0] [+/-] [.] [-] [+] [  ]                │
└─────────────────────────────────────────────┘
```

---

## 判题引擎设计

### 新的 judge.ts

```typescript
/**
 * 通用判题引擎 v2
 */
export function judgeStep(
  step: StepProtocol,
  userInput: string,
  duration?: number
): JudgeResult {

  const { expectedAnswer, answerMode } = step;

  switch (expectedAnswer.type) {
    case 'number':
      return judgeNumber(userInput, expectedAnswer);

    case 'string':
      return judgeString(userInput, expectedAnswer);

    case 'coordinate':
      return judgeCoordinate(userInput, expectedAnswer);

    case 'yes_no':
      return judgeYesNo(userInput, expectedAnswer);

    case 'choice':
      return judgeChoice(userInput, expectedAnswer);

    case 'expression':
      return judgeExpression(userInput, expectedAnswer);

    case 'multi_fill':
      return judgeMultiFill(userInput, expectedAnswer);

    case 'order':
      return judgeOrder(userInput, expectedAnswer);

    case 'match':
      return judgeMatch(userInput, expectedAnswer);

    default:
      return {
        isCorrect: false,
        correctAnswer: '未知题型',
        errorType: 'format_error',
        hint: '请联系管理员',
      };
  }
}

/**
 * 数值判题
 */
function judgeNumber(
  userInput: string,
  expected: { type: 'number'; value: number; tolerance?: number }
): JudgeResult {
  const userNum = parseFloat(userInput.trim());

  if (isNaN(userNum)) {
    return {
      isCorrect: false,
      correctAnswer: expected.value.toString(),
      errorType: 'format_error',
      hint: '请输入一个有效的数字',
    };
  }

  const tolerance = expected.tolerance ?? 0.001;
  const diff = Math.abs(userNum - expected.value);
  const isCorrect = diff <= tolerance;

  return {
    isCorrect,
    correctAnswer: expected.value.toString(),
    errorType: isCorrect ? null : 'calculation_error',
    hint: isCorrect ? undefined : `正确答案是 ${expected.value}`,
  };
}

/**
 * 字符串判题（支持同义词）
 */
function judgeString(
  userInput: string,
  expected: { type: 'string'; value: string; variants?: string[] }
): JudgeResult {
  const normalized = userInput.trim().toLowerCase();
  const expectedNormalized = expected.value.toLowerCase();
  const variants = (expected.variants || []).map(v => v.toLowerCase());

  const isCorrect =
    normalized === expectedNormalized ||
    variants.includes(normalized) ||
    // 模糊匹配（包含）
    normalized.includes(expectedNormalized) ||
    expectedNormalized.includes(normalized);

  return {
    isCorrect,
    correctAnswer: expected.value,
    errorType: isCorrect ? null : 'concept_error',
    hint: isCorrect ? undefined : `正确答案是：${expected.value}`,
  };
}

/**
 * 判断题判题
 */
function judgeYesNo(
  userInput: string,
  expected: { type: 'yes_no'; value: boolean }
): JudgeResult {
  // UI 返回的是 "yes" 或 "no"（从按钮点击）
  const userBool = userInput === 'yes' || userInput === 'true';
  const expectedBool = expected.value;

  return {
    isCorrect: userBool === expectedBool,
    correctAnswer: expectedBool ? '是' : '否',
    errorType: userBool === expectedBool ? null : 'concept_error',
    hint: userBool === expectedBool ? undefined : '再想想题目条件',
  };
}

/**
 * 选择题判题
 */
function judgeChoice(
  userInput: string,
  expected: { type: 'choice'; value: string | string[] }
): JudgeResult {
  const isCorrect = Array.isArray(expected.value)
    ? userInput.split(',').sort().join(',') === expected.value.sort().join(',')
    : userInput === expected.value;

  return {
    isCorrect,
    correctAnswer: Array.isArray(expected.value) ? expected.value.join(', ') : expected.value,
    errorType: isCorrect ? null : 'concept_error',
    hint: isCorrect ? undefined : '请重新选择',
  };
}

/**
 * 坐标判题
 */
function judgeCoordinate(
  userInput: string,
  expected: { type: 'coordinate'; x: number; y: number; tolerance?: number }
): JudgeResult {
  // 支持多种格式：(x, y)、[x, y]、x y
  const match = userInput.trim().match(/^\(?\s*([-\d.]+)\s*[,，]\s*([-\d.]+)\s*\)?$/);

  if (!match) {
    return {
      isCorrect: false,
      correctAnswer: `(${expected.x}, ${expected.y})`,
      errorType: 'format_error',
      hint: '坐标格式：(x, y) 或 [x, y]',
    };
  }

  const userX = parseFloat(match[1]);
  const userY = parseFloat(match[2]);
  const tolerance = expected.tolerance ?? 0.01;

  const isCorrect =
    Math.abs(userX - expected.x) <= tolerance &&
    Math.abs(userY - expected.y) <= tolerance;

  return {
    isCorrect,
    correctAnswer: `(${expected.x}, ${expected.y})`,
    errorType: isCorrect ? null : 'calculation_error',
    hint: isCorrect ? undefined : `正确答案是 (${expected.x}, ${expected.y})`,
  };
}
```

---

## 模板定义示例

### 正方形判定（YES_NO 模式）

```typescript
export const squareVerifyTemplate: QuestionTemplate = {
  id: 'square_verify',
  knowledgePoint: '正方形判定',

  generateParams: (level) => {
    return {
      side: 7,
      problemType: 1,
      isSquare: 0,  // 条件不足
    };
  },

  buildSteps: (params) => {
    const { side } = params;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: `题目说"四条边都是${side}"——四条边长度相等吗？`,
          hint: '根据题目给出的信息判断',
        },
        options: {
          yes: '是，四条边相等',
          no: '否，四条边不相等',
        },
        expectedAnswer: { type: 'yes_no', value: true },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '题目给出角度信息了吗？',
          hint: '检查题目描述',
        },
        options: {
          yes: '给出了角度',
          no: '没给角度',
        },
        expectedAnswer: { type: 'yes_no', value: false },
      },
      {
        stepId: 's3',
        answerMode: AnswerMode.YES_NO,
        ui: {
          instruction: '综合判断：只知四边相等，能确定是正方形吗？',
          hint: '正方形需要同时满足：四边相等 + 四角为直角',
        },
        options: {
          yes: '能确定',
          no: '不能确定',
        },
        expectedAnswer: { type: 'yes_no', value: false },
      },
    ];
  },

  render: (params) => ({
    title: `一个四边形四条边都等于${params.side}，判定是否为正方形`,
    description: '正方形判定',
    context: '正方形 = 四边相等 + 四角为直角，两个条件缺一不可',
  }),
};
```

### 勾股定理计算（NUMBER 模式）

```typescript
export const pythagorasTemplate: QuestionTemplate = {
  id: 'pythagoras',
  knowledgePoint: '勾股定理',

  generateParams: (level) {
    const config = DIFFICULTY_CONFIG.pythagoras[level];
    return generateRandomParams(config);
  },

  buildSteps: (params) => {
    const { a, b } = params;
    const c = Math.sqrt(a * a + b * b);

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `直角三角形，a=${a}, b=${b}，求斜边 c²`,
          hint: '使用勾股定理 c² = a² + b²',
        },
        keyboard: {
          type: 'numeric',
          extraKeys: ['√', 'π', '.'],
        },
        expectedAnswer: {
          type: 'number',
          value: a * a + b * b,
          tolerance: 0.01,
        },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `求斜边 c`,
          hint: `c = √${a * a + b * b}`,
        },
        keyboard: {
          type: 'numeric',
          extraKeys: ['√', '.'],
        },
        expectedAnswer: {
          type: 'number',
          value: c,
          tolerance: 0.01,
        },
      },
    ];
  },

  render: (params) => ({
    title: `勾股定理：a=${params.a}, b=${params.b}`,
    description: '求斜边长度',
    context: '直角三角形中，c² = a² + b²',
  }),
};
```

---

## 实施计划

### Phase 1: 协议定义（1天）
- [ ] 定义 AnswerMode 枚举
- [ ] 定义 ExpectedAnswer 类型
- [ ] 定义 StepProtocol v2
- [ ] TypeScript 类型验证

### Phase 2: 判题引擎（2天）
- [ ] 重写 judge.ts
- [ ] 实现各类判题函数
- [ ] 单元测试覆盖

### Phase 3: 前端 UI（3天）
- [ ] 创建 YesNoInput 组件
- [ ] 创建 ChoiceInput 组件
- [ ] 创建 NumberInput 组件
- [ ] 创建 CoordinateInput 组件
- [ ] 更新 ExercisePage 渲染逻辑

### Phase 4: 模板迁移（5天）
- [ ] 迁移勾股定理模板
- [ ] 迁移正方形判定模板
- [ ] 迁移其他判定类模板
- [ ] 迁移计算类模板
- [ ] 测试验证

### Phase 5: API 更新（1天）
- [ ] 更新 verify API
- [ ] 更新 generate API

### Phase 6: 测试验收（2天）
- [ ] 端到端测试
- [ ] UX 测试
- [ ] 性能测试

---

## 验收标准

- [ ] 学生可以点击"是"/"否"按钮回答判断题
- [ ] 学生可以用数字键盘输入计算题答案
- [ ] 判题结果 100% 可靠
- [ ] 新增题型不需要改判题引擎
- [ ] 所有现有模板正常工作
