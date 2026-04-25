# 题目判题系统重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构题目判题系统，实现以学生为中心的答题体验（点击"是"/"否"按钮）和清晰稳定的判题架构。

**Architecture:** 引入 AnswerMode 枚举（决定 UI）和 ExpectedAnswer 类型（决定判题），将判题规则从硬编码的引擎代码中下沉到模板的步骤配置中。判题引擎只负责执行规则，不再硬编码题型逻辑。

**Tech Stack:** TypeScript, Next.js, React, Prisma

---

## 文件结构

### 新增文件

```
lib/question-engine/
├── protocol-v2.ts              # 新协议类型定义（AnswerMode, ExpectedAnswer）
├── judge-v2.ts                 # 新判题引擎（通用判题逻辑）
├── migrate.ts                  # v1/v2 协议迁移工具
└── types/
    └── judge.ts                # JudgeResult, ErrorType 等公共类型

components/question-input/
├── YesNoInput.tsx              # 是/否按钮组件
├── ChoiceInput.tsx             # 选项按钮组件
├── NumberInput.tsx             # 数字输入+键盘组件
├── CoordinateInput.tsx         # 坐标输入组件
└── error-messages.ts           # 错误提示映射表
```

### 修改文件

```
lib/question-engine/
├── protocol.ts                 # 添加 v2 协议导出
├── judge.ts                    # 添加 v1/v2 分发逻辑
├── templates/
│   ├── pythagoras.ts           # 迁移到 v2 协议
│   └── chapter18/
│       └── square_verify.ts    # 迁移到 v2 协议

components/
└── ExercisePage.tsx            # 添加 v2 步骤渲染逻辑

app/api/questions/
├── verify/route.ts             # 支持 v2 协议判题
└── generate/route.ts           # 支持 v2 协议生成
```

---

## Phase 1: 协议定义（1天）

### Task 1: 创建公共类型定义

**Files:**
- Create: `lib/question-engine/types/judge.ts`

- [ ] **Step 1: 创建 JudgeResult 和 ErrorType 类型**

```typescript
/**
 * 错误类型（用于判题结果和前端提示）
 */
export type ErrorType =
  | 'format_error'      // 格式错误（如坐标格式不对）
  | 'calculation_error' // 计算错误（数值不对）
  | 'concept_error'     // 概念错误（判断/选择错误）
  | 'system_error'      // 系统错误（未知题型/配置错误）

/**
 * 判题结果
 */
export interface JudgeResult {
  isCorrect: boolean;           // 是否正确
  correctAnswer: string;        // 正确答案（用户可读格式）
  errorType: ErrorType | null;  // 错误类型（正确时为 null）
  hint?: string;                // 提示信息
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add lib/question-engine/types/judge.ts
git commit -m "feat: add JudgeResult and ErrorType types"
```

### Task 2: 创建 v2 协议类型定义

**Files:**
- Create: `lib/question-engine/protocol-v2.ts`

- [ ] **Step 1: 定义 AnswerMode 枚举**

```typescript
/**
 * 答题方式 - 决定UI呈现
 */
export enum AnswerMode {
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

- [ ] **Step 2: 定义 ExpectedAnswer 类型**

```typescript
/**
 * 答案期望 - 判题用
 */
export type ExpectedAnswer =
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

- [ ] **Step 3: 定义 StepProtocolV2 接口**

```typescript
import { AnswerMode } from './AnswerMode';
import { ExpectedAnswer } from './ExpectedAnswer';

/**
 * 步骤选项配置
 */
export interface StepOptions {
  // YES_NO 模式
  yes?: string;                // "是" 的文本，可自定义
  no?: string;                 // "否" 的文本，可自定义

  // MULTIPLE_CHOICE 模式
  choices?: Array<{            // 选择题选项
    value: string;
    label: string;
  }>;
}

/**
 * 步骤键盘配置
 */
export interface StepKeyboard {
  type: 'numeric' | 'numpad' | 'math' | 'qwerty';
  extraKeys?: string[];
}

/**
 * 步骤验证配置
 */
export interface StepValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

/**
 * 步骤 UI 配置
 */
export interface StepUI {
  instruction: string;         // 步骤指令
  inputPlaceholder?: string;   // 输入占位符
  hint?: string;               // 提示信息
}

/**
 * 步骤协议 v2
 */
export interface StepProtocolV2 {
  stepId: string;

  // 答题方式（决定UI）
  answerMode: AnswerMode;

  // UI 描述
  ui: StepUI;

  // 选项（仅部分模式需要）
  options?: StepOptions;

  // 正确答案（判题用）
  expectedAnswer: ExpectedAnswer;

  // 键盘配置（仅 TEXT_INPUT/NUMBER 需要）
  keyboard?: StepKeyboard;

  // 验证配置（可选）
  validation?: StepValidation;
}

/**
 * 题目协议 v2
 */
export interface QuestionProtocolV2 {
  id: string;
  knowledgePoint: string;
  templateId: string;
  difficultyLevel: number;
  params: Record<string, number>;
  steps: StepProtocolV2[];      // 使用 v2 协议
  content: {
    title: string;
    description: string;
    context?: string;
  };
  meta: {
    version: string;            // '2.0'
    source: 'template_engine_v2';
  };
}
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add lib/question-engine/protocol-v2.ts
git commit -m "feat: add v2 protocol types (AnswerMode, ExpectedAnswer, StepProtocolV2)"
```

### Task 3: 更新主协议文件导出

**Files:**
- Modify: `lib/question-engine/protocol.ts`

- [ ] **Step 1: 添加 v2 协议导出**

在文件末尾添加：

```typescript
/**
 * v2 协议导出（向后兼容）
 */
export { AnswerMode, ExpectedAnswer, StepProtocolV2, QuestionProtocolV2 } from './protocol-v2';
export type { StepOptions, StepKeyboard, StepValidation, StepUI } from './protocol-v2';
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add lib/question-engine/protocol.ts
git commit -m "feat: export v2 protocol types from main protocol file"
```

---

## Phase 2: 判题引擎（2天）

### Task 4: 创建 v2 判题引擎

**Files:**
- Create: `lib/question-engine/judge-v2.ts`

- [ ] **Step 1: 实现 judgeStepV2 入口函数**

```typescript
import { StepProtocolV2, ExpectedAnswer } from './protocol-v2';
import { JudgeResult, ErrorType } from './types/judge';

/**
 * 通用判题引擎 v2
 */
export function judgeStepV2(
  step: StepProtocolV2,
  userInput: string,
  duration?: number
): JudgeResult {
  const { expectedAnswer } = step;

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
        errorType: 'system_error',
        hint: '题目配置错误，请联系管理员',
      };
  }
}
```

- [ ] **Step 2: 实现数值判题函数**

```typescript
function judgeNumber(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'number' }>
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
```

- [ ] **Step 3: 实现字符串判题函数**

```typescript
function judgeString(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'string' }>
): JudgeResult {
  const normalized = userInput.trim().toLowerCase();
  const expectedNormalized = expected.value.toLowerCase();
  const variants = (expected.variants || []).map(v => v.toLowerCase());

  const isCorrect =
    normalized === expectedNormalized ||
    variants.includes(normalized) ||
    normalized.includes(expectedNormalized) ||
    expectedNormalized.includes(normalized);

  return {
    isCorrect,
    correctAnswer: expected.value,
    errorType: isCorrect ? null : 'concept_error',
    hint: isCorrect ? undefined : `正确答案是：${expected.value}`,
  };
}
```

- [ ] **Step 4: 实现判断题判题函数**

```typescript
function judgeYesNo(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'yes_no' }>
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
```

- [ ] **Step 5: 实现选择题判题函数**

```typescript
function judgeChoice(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'choice' }>
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
```

- [ ] **Step 6: 实现坐标判题函数**

```typescript
function judgeCoordinate(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'coordinate' }>
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

- [ ] **Step 7: 实现表达式判题函数**

```typescript
function judgeExpression(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'expression' }>
): JudgeResult {
  // 简化版：先做字符串比较，后续可接入数学表达式解析库
  const normalized = userInput.trim().replace(/\s+/g, '');
  const expectedNormalized = expected.value.trim().replace(/\s+/g, '');

  // 如果提供了简化形式，优先比较
  const simplified = expected.simplified?.trim().replace(/\s+/g, '');

  const isCorrect =
    normalized === expectedNormalized ||
    (simplified !== undefined && normalized === simplified);

  return {
    isCorrect,
    correctAnswer: expected.value,
    errorType: isCorrect ? null : 'calculation_error',
    hint: isCorrect ? undefined : `正确答案是：${expected.value}`,
  };
}
```

- [ ] **Step 8: 实现多空填空判题函数**

```typescript
function judgeMultiFill(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'multi_fill' }>
): JudgeResult {
  // 假设用户输入用逗号或空格分隔
  const userValues = userInput.split(/[,，\s]+/).filter(v => v.trim());

  if (userValues.length !== expected.values.length) {
    return {
      isCorrect: false,
      correctAnswer: expected.values.join(', '),
      errorType: 'format_error',
      hint: `请填写 ${expected.values.length} 个空`,
    };
  }

  let correctCount = 0;
  for (let i = 0; i < expected.values.length; i++) {
    const expectedVal = expected.values[i];
    const userVal = userValues[i];

    if (typeof expectedVal === 'number') {
      const userNum = parseFloat(userVal);
      if (!isNaN(userNum) && Math.abs(userNum - expectedVal) < 0.001) {
        correctCount++;
      }
    } else {
      if (userVal.trim().toLowerCase() === expectedVal.toLowerCase()) {
        correctCount++;
      }
    }
  }

  const isCorrect = correctCount === expected.values.length;

  return {
    isCorrect,
    correctAnswer: expected.values.join(', '),
    errorType: isCorrect ? null : 'calculation_error',
    hint: isCorrect ? undefined : `${correctCount}/${expected.values.length} 正确`,
  };
}
```

- [ ] **Step 9: 实现排序判题函数**

```typescript
function judgeOrder(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'order' }>
): JudgeResult {
  const userOrder = userInput.split(/[,，\s]+/).filter(v => v.trim());
  const normalizedExpected = expected.value.map(v => v.toLowerCase());
  const normalizedUser = userOrder.map(v => v.toLowerCase());

  const isCorrect =
    normalizedUser.length === normalizedExpected.length &&
    normalizedUser.every((v, i) => v === normalizedExpected[i]);

  return {
    isCorrect,
    correctAnswer: expected.value.join(' → '),
    errorType: isCorrect ? null : 'concept_error',
    hint: isCorrect ? undefined : '顺序不正确',
  };
}
```

- [ ] **Step 10: 实现匹配判题函数**

```typescript
function judgeMatch(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'match' }>
): JudgeResult {
  // 假设用户输入格式为 "A1,B2,C3" 表示 A→1, B→2, C→3
  const pairs = userInput.split(/[,，]/).filter(v => v.trim());

  const userMatches: Record<string, string> = {};
  for (const pair of pairs) {
    const [key, value] = pair.split(/[:：→]/);
    if (key && value) {
      userMatches[key.trim().toLowerCase()] = value.trim().toLowerCase();
    }
  }

  // 转换 expected 为小写
  const expectedLower: Record<string, string> = {};
  for (const [key, value] of Object.entries(expected.value)) {
    expectedLower[key.toLowerCase()] = value.toLowerCase();
  }

  let correctCount = 0;
  let totalCount = Object.keys(expectedLower).length;

  for (const [key, value] of Object.entries(expectedLower)) {
    if (userMatches[key] === value) {
      correctCount++;
    }
  }

  const isCorrect = correctCount === totalCount;

  return {
    isCorrect,
    correctAnswer: Object.entries(expected.value)
      .map(([k, v]) => `${k}→${v}`)
      .join(', '),
    errorType: isCorrect ? null : 'concept_error',
    hint: isCorrect ? undefined : `${correctCount}/${totalCount} 正确`,
  };
}
```

- [ ] **Step 11: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 12: 创建单元测试**

```bash
mkdir -p lib/question-engine/__tests__
```

创建 `lib/question-engine/__tests__/judge-v2.test.ts`:

```typescript
import { judgeStepV2 } from '../judge-v2';
import { AnswerMode } from '../protocol-v2';

describe('judge-v2', () => {
  describe('judgeNumber', () => {
    it('should accept correct number', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      const result = judgeStepV2(step, '5');
      expect(result.isCorrect).toBe(true);
      expect(result.errorType).toBe(null);
    });

    it('should reject wrong number', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      const result = judgeStepV2(step, '3');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('calculation_error');
    });

    it('should handle tolerance', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5, tolerance: 0.1 },
      };
      const result = judgeStepV2(step, '5.05');
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('judgeYesNo', () => {
    it('should accept "yes" for true', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: true },
      };
      const result = judgeStepV2(step, 'yes');
      expect(result.isCorrect).toBe(true);
    });

    it('should reject "yes" for false', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.YES_NO,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'yes_no' as const, value: false },
      };
      const result = judgeStepV2(step, 'yes');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('concept_error');
    });
  });

  describe('judgeCoordinate', () => {
    it('should accept correct coordinate format', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      expect(judgeStepV2(step, '(3, 4)').isCorrect).toBe(true);
      expect(judgeStepV2(step, '3, 4').isCorrect).toBe(true);
      expect(judgeStepV2(step, '[3, 4]').isCorrect).toBe(true);
    });

    it('should reject wrong coordinate', () => {
      const step = {
        stepId: 's1',
        answerMode: AnswerMode.COORDINATE,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'coordinate' as const, x: 3, y: 4 },
      };
      const result = judgeStepV2(step, '(5, 6)');
      expect(result.isCorrect).toBe(false);
      expect(result.errorType).toBe('calculation_error');
    });
  });
});
```

- [ ] **Step 13: 运行测试**

```bash
pnpm test lib/question-engine/__tests__/judge-v2.test.ts
```

Expected: 所有测试通过

- [ ] **Step 14: 提交**

```bash
git add lib/question-engine/judge-v2.ts lib/question-engine/__tests__/judge-v2.test.ts
git commit -m "feat: implement v2 judgment engine with all answer types"
```

### Task 5: 更新主判题引擎支持 v1/v2 双协议

**Files:**
- Modify: `lib/question-engine/judge.ts`

- [ ] **Step 1: 添加 v1/v2 协议检测逻辑**

在文件开头添加导入：

```typescript
import { StepProtocolV2 } from './protocol-v2';
import { judgeStepV2 } from './judge-v2';
```

修改 `judgeStep` 函数，在现有逻辑前添加版本检测：

```typescript
export function judgeStep(
  step: StepProtocol | StepProtocolV2,
  params: Record<string, number>,
  userInput: string,
  duration?: number
): JudgeResult {
  // v2 协议检测：检查是否有 expectedAnswer 字段
  if ('expectedAnswer' in step) {
    return judgeStepV2(step as StepProtocolV2, userInput, duration);
  }

  // v1 协议：原有逻辑保持不变
  // ... (保留现有代码)
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 运行现有测试**

```bash
pnpm test
```

Expected: 所有现有测试通过（向后兼容）

- [ ] **Step 4: 提交**

```bash
git add lib/question-engine/judge.ts
git commit -m "feat: add v1/v2 protocol detection to judge engine"
```

### Task 6: 创建协议迁移工具

**Files:**
- Create: `lib/question-engine/migrate.ts`

- [ ] **Step 1: 实现协议检测函数**

```typescript
import { StepProtocol, StepType } from './protocol';
import { StepProtocolV2, AnswerMode, ExpectedAnswer } from './protocol-v2';

/**
 * 检测步骤协议版本
 */
export function detectProtocolVersion(step: StepProtocol | StepProtocolV2): 'v1' | 'v2' {
  if ('expectedAnswer' in step) {
    return 'v2';
  }
  return 'v1';
}

/**
 * 检测题目协议版本
 */
export function detectQuestionProtocolVersion(steps: StepProtocol[] | StepProtocolV2[]): 'v1' | 'v2' {
  if (steps.length === 0) return 'v1';
  return detectProtocolVersion(steps[0]);
}
```

- [ ] **Step 2: 实现 StepType 到 AnswerMode/ExpectedAnswer 映射**

```typescript
/**
 * StepType 到 v2 协议的映射配置
 */
interface V1ToV2Mapping {
  answerMode: AnswerMode;
  getExpectedAnswer: (step: StepProtocol, params: Record<string, number>) => ExpectedAnswer;
}

/**
 * StepType 映射表
 */
const STEP_TYPE_MAPPING: Record<StepType, V1ToV2Mapping> = {
  // 二次函数
  [StepType.COMPUTE_VERTEX_X]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.h || 0 }),
  },
  [StepType.COMPUTE_VERTEX_Y]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.k || 0 }),
  },
  [StepType.FINAL_COORDINATE]: {
    answerMode: AnswerMode.COORDINATE,
    getExpectedAnswer: (step, params) => ({ type: 'coordinate', x: params.h || 0, y: params.k || 0 }),
  },
  [StepType.COMPUTE_VALUE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: 0 }), // 需要具体计算
  },

  // 勾股定理
  [StepType.PYTHAGOREAN_C_SQUARE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => {
      const a = params.a || 0;
      const b = params.b || 0;
      return { type: 'number', value: a * a + b * b, tolerance: 0.01 };
    },
  },
  [StepType.PYTHAGOREAN_C]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => {
      const a = params.a || 0;
      const b = params.b || 0;
      return { type: 'number', value: Math.sqrt(a * a + b * b), tolerance: 0.01 };
    },
  },

  // 一元一次方程
  [StepType.SOLVE_LINEAR_EQUATION]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.x || 0 }),
  },

  // 概率统计
  [StepType.COMPUTE_PROBABILITY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.probability || 0 }),
  },

  // 二次根式
  [StepType.COMPUTE_SQRT]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: Math.sqrt(params.value || 0), tolerance: 0.01 }),
  },
  [StepType.SIMPLIFY_SQRT]: {
    answerMode: AnswerMode.TEXT_INPUT,
    getExpectedAnswer: (step, params) => ({ type: 'string', value: '√a' }),
  },
  [StepType.SQRT_PROPERTY]: {
    answerMode: AnswerMode.TEXT_INPUT,
    getExpectedAnswer: (step, params) => ({ type: 'string', value: '|a|' }),
  },
  [StepType.SQRT_MIXED]: {
    answerMode: AnswerMode.EXPRESSION,
    getExpectedAnswer: (step, params) => ({ type: 'expression', value: '√2 + 1' }),
  },

  // 三角形判定
  [StepType.VERIFY_RIGHT_ANGLE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (step, params) => ({ type: 'yes_no', value: params.isRightAngle === 1 }),
  },

  // 四边形判定
  [StepType.VERIFY_PARALLELOGRAM]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (step, params) => ({ type: 'yes_no', value: params.isParallelogram === 1 }),
  },
  [StepType.VERIFY_RECTANGLE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (step, params) => ({ type: 'yes_no', value: params.isRectangle === 1 }),
  },
  [StepType.VERIFY_RHOMBUS]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (step, params) => ({ type: 'yes_no', value: params.isRhombus === 1 }),
  },
  [StepType.VERIFY_SQUARE]: {
    answerMode: AnswerMode.YES_NO,
    getExpectedAnswer: (step, params) => ({ type: 'yes_no', value: params.isSquare === 1 }),
  },

  // 一元二次方程
  [StepType.IDENTIFY_QUADRATIC]: {
    answerMode: AnswerMode.MULTIPLE_CHOICE,
    getExpectedAnswer: (step, params) => ({ type: 'choice', value: 'quadratic' }),
  },
  [StepType.SOLVE_DIRECT_ROOT]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.x1 || 0 }),
  },
  [StepType.SOLVE_COMPLETE_SQUARE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.x || 0 }),
  },
  [StepType.SOLVE_QUADRATIC_FORMULA]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.x1 || 0 }),
  },
  [StepType.SOLVE_FACTORIZE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.x1 || 0 }),
  },
  [StepType.QUADRATIC_APPLICATION]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.answer || 0 }),
  },

  // 数据分析
  [StepType.COMPUTE_MEAN]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.mean || 0, tolerance: 0.01 }),
  },
  [StepType.COMPUTE_MEDIAN]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.median || 0 }),
  },
  [StepType.COMPUTE_MODE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.mode || 0 }),
  },
  [StepType.COMPUTE_VARIANCE]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.variance || 0, tolerance: 0.01 }),
  },
  [StepType.COMPUTE_STDDEV]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.stddev || 0, tolerance: 0.01 }),
  },

  // 四边形性质计算
  [StepType.COMPUTE_RECT_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.result || 0 }),
  },
  [StepType.COMPUTE_RHOMBUS_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.result || 0 }),
  },
  [StepType.COMPUTE_SQUARE_PROPERTY]: {
    answerMode: AnswerMode.NUMBER,
    getExpectedAnswer: (step, params) => ({ type: 'number', value: params.result || 0 }),
  },
};
```

- [ ] **Step 3: 实现步骤迁移函数**

```typescript
/**
 * 将 v1 步骤转换为 v2 步骤
 */
export function migrateStepToV2(
  step: StepProtocol,
  params: Record<string, number>
): StepProtocolV2 {
  const mapping = STEP_TYPE_MAPPING[step.type];

  if (!mapping) {
    throw new Error(`Unknown StepType: ${step.type}`);
  }

  return {
    stepId: step.stepId,
    answerMode: mapping.answerMode,
    ui: {
      instruction: step.ui.instruction,
      inputPlaceholder: step.ui.inputTarget,
      hint: step.ui.inputHint,
    },
    expectedAnswer: mapping.getExpectedAnswer(step, params),
    keyboard: step.keyboard === 'numeric' || step.keyboard === 'numpad'
      ? { type: step.keyboard, extraKeys: [] }
      : undefined,
  };
}

/**
 * 将 v1 题目转换为 v2 题目
 */
export function migrateQuestionToV2(
  steps: StepProtocol[],
  params: Record<string, number>
): StepProtocolV2[] {
  return steps.map(step => migrateStepToV2(step, params));
}
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 创建迁移工具测试**

创建 `lib/question-engine/__tests__/migrate.test.ts`:

```typescript
import { migrateStepToV2, detectProtocolVersion } from '../migrate';
import { StepProtocol, StepType } from '../protocol';
import { AnswerMode } from '../protocol-v2';

describe('migrate', () => {
  describe('detectProtocolVersion', () => {
    it('should detect v1 protocol', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: 'Test',
          inputTarget: 'c',
          inputHint: 'Hint',
        },
      };
      expect(detectProtocolVersion(v1Step)).toBe('v1');
    });

    it('should detect v2 protocol', () => {
      const v2Step = {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: { instruction: 'Test' },
        expectedAnswer: { type: 'number' as const, value: 5 },
      };
      expect(detectProtocolVersion(v2Step)).toBe('v2');
    });
  });

  describe('migrateStepToV2', () => {
    it('should migrate PYTHAGOREAN_C step', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.PYTHAGOREAN_C,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        tolerance: 0.01,
        ui: {
          instruction: '求斜边 c',
          inputTarget: 'c',
          inputHint: '使用勾股定理',
        },
      };
      const params = { a: 3, b: 4 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.NUMBER);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'number',
        value: 5,
        tolerance: 0.01,
      });
      expect(v2Step.ui.instruction).toBe('求斜边 c');
    });

    it('should migrate VERIFY_SQUARE step', () => {
      const v1Step: StepProtocol = {
        stepId: 's1',
        type: StepType.VERIFY_SQUARE,
        inputType: 'numeric',
        keyboard: 'numeric',
        answerType: 'number',
        ui: {
          instruction: '是正方形吗？',
          inputTarget: '是/否',
          inputHint: '输入1表示是，0表示否',
        },
      };
      const params = { isSquare: 1 };

      const v2Step = migrateStepToV2(v1Step, params);

      expect(v2Step.answerMode).toBe(AnswerMode.YES_NO);
      expect(v2Step.expectedAnswer).toEqual({
        type: 'yes_no',
        value: true,
      });
    });
  });
});
```

- [ ] **Step 6: 运行测试**

```bash
pnpm test lib/question-engine/__tests__/migrate.test.ts
```

Expected: 所有测试通过

- [ ] **Step 7: 提交**

```bash
git add lib/question-engine/migrate.ts lib/question-engine/__tests__/migrate.test.ts
git commit -m "feat: add v1 to v2 protocol migration tool"
```

---

## Phase 3: 前端 UI（3天）

### Task 7: 创建错误提示映射表

**Files:**
- Create: `components/question-input/error-messages.ts`

- [ ] **Step 1: 创建错误提示映射表**

```typescript
import { ErrorType } from '@/lib/question-engine/types/judge';

export type ErrorHintBuilder = (correctAnswer: string) => string;

export const ERROR_HINTS: Record<ErrorType, string | ErrorHintBuilder> = {
  format_error: '输入格式不正确，请检查',
  calculation_error: (correctAnswer: string) => `正确答案是：${correctAnswer}`,
  concept_error: '再仔细想想题目条件',
  system_error: '题目配置错误，请联系管理员',
};

/**
 * 获取错误提示
 */
export function getErrorHint(
  errorType: ErrorType | null,
  correctAnswer: string
): string | undefined {
  if (!errorType) return undefined;

  const hint = ERROR_HINTS[errorType];
  return typeof hint === 'function' ? hint(correctAnswer) : hint;
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add components/question-input/error-messages.ts
git commit -m "feat: add error hint mapping table"
```

### Task 8: 创建 YesNoInput 组件

**Files:**
- Create: `components/question-input/YesNoInput.tsx`

- [ ] **Step 1: 实现 YesNoInput 组件**

```typescript
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface YesNoInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const YesNoInput: React.FC<YesNoInputProps> = ({
  step,
  value,
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const yesText = step.options?.yes || '是';
  const noText = step.options?.no || '否';

  const handleYesClick = () => {
    onChange('yes');
    setTimeout(() => onSubmit(), 150);
  };

  const handleNoClick = () => {
    onChange('no');
    setTimeout(() => onSubmit(), 150);
  };

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleYesClick}
        disabled={disabled}
        className={cn(
          'px-8 py-4 rounded-xl font-medium text-lg transition-all',
          'bg-green-500 hover:bg-green-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {yesText}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleNoClick}
        disabled={disabled}
        className={cn(
          'px-8 py-4 rounded-xl font-medium text-lg transition-all',
          'bg-red-500 hover:bg-red-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {noText}
      </motion.button>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add components/question-input/YesNoInput.tsx
git commit -m "feat: add YesNoInput component"
```

### Task 9: 创建 NumberInput 组件

**Files:**
- Create: `components/question-input/NumberInput.tsx`

- [ ] **Step 1: 实现 NumberInput 组件**

```typescript
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface NumberInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  step,
  value = '',
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const [showKeypad, setShowKeypad] = useState(false);

  const extraKeys = step.keyboard?.extraKeys || [];
  const hasExtraKeys = extraKeys.length > 0;

  // 数字键盘布局
  const keys = [
    ['7', '8', '9', '.', '←'],
    ['4', '5', '6', '√', 'π'],
    ['1', '2', '3', '÷', '×'],
    ['0', '+/-', '.', '-', '+'],
  ];

  const handleKeyPress = (key: string) => {
    if (disabled) return;

    switch (key) {
      case '←':
        onChange(value.slice(0, -1));
        break;
      case '清除':
        onChange('');
        break;
      case '提交':
        onSubmit();
        break;
      case '+/-':
        if (value.startsWith('-')) {
          onChange(value.slice(1));
        } else if (value) {
          onChange('-' + value);
        }
        break;
      default:
        onChange(value + key);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 输入框 */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.ui.inputPlaceholder || '输入答案'}
          disabled={disabled}
          className={cn(
            'w-48 px-4 py-3 text-center text-2xl font-mono',
            'border-2 border-gray-300 rounded-xl',
            'focus:border-blue-500 focus:outline-none',
            'disabled:bg-gray-100 disabled:cursor-not-allowed'
          )}
          onFocus={() => setShowKeypad(true)}
        />
        <button
          onClick={() => setShowKeypad(!showKeypad)}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'text-gray-400 hover:text-gray-600'
          )}
        >
          🔢
        </button>
      </div>

      {/* 数字键盘 */}
      {showKeypad && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-100 p-2 rounded-xl"
        >
          <div className="grid grid-cols-5 gap-1">
            {keys.flat().map((key, index) => (
              <button
                key={index}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                className={cn(
                  'px-3 py-3 rounded-lg font-medium',
                  'bg-white hover:bg-gray-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  key === '←' && 'text-red-500',
                  key === '提交' && 'col-span-2 bg-green-500 text-white hover:bg-green-600'
                )}
              >
                {key}
              </button>
            ))}
            {/* 额外按键 */}
            {extraKeys.map((key, index) => (
              <button
                key={`extra-${index}`}
                onClick={() => handleKeyPress(key)}
                disabled={disabled}
                className="px-3 py-3 rounded-lg font-medium bg-blue-100 text-blue-700"
              >
                {key}
              </button>
            ))}
            {/* 提交按钮 */}
            <button
              onClick={() => handleKeyPress('提交')}
              disabled={disabled || !value}
              className={cn(
                'col-span-2 px-3 py-3 rounded-lg font-medium',
                'bg-green-500 text-white hover:bg-green-600',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              提交
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add components/question-input/NumberInput.tsx
git commit -m "feat: add NumberInput component with numeric keypad"
```

### Task 10: 创建 ChoiceInput 组件

**Files:**
- Create: `components/question-input/ChoiceInput.tsx`

- [ ] **Step 1: 实现 ChoiceInput 组件**

```typescript
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface ChoiceInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const ChoiceInput: React.FC<ChoiceInputProps> = ({
  step,
  value,
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const choices = step.options?.choices || [];

  const isMultipleChoice = step.expectedAnswer.type === 'choice' &&
    Array.isArray(step.expectedAnswer.value);

  const handleChoiceClick = (choiceValue: string) => {
    if (disabled) return;

    let newValue: string;
    if (isMultipleChoice) {
      // 多选：切换选项
      const currentValues = value ? value.split(',') : [];
      if (currentValues.includes(choiceValue)) {
        newValue = currentValues.filter(v => v !== choiceValue).join(',');
      } else {
        newValue = [...currentValues, choiceValue].join(',');
      }
    } else {
      // 单选：直接设置
      newValue = choiceValue;
    }

    onChange(newValue);

    // 单选模式下自动提交
    if (!isMultipleChoice) {
      setTimeout(() => onSubmit(), 150);
    }
  };

  const isSelected = (choiceValue: string) => {
    if (!value) return false;
    if (isMultipleChoice) {
      return value.split(',').includes(choiceValue);
    }
    return value === choiceValue;
  };

  return (
    <div className="flex flex-col gap-3 py-4">
      {choices.map((choice) => (
        <motion.button
          key={choice.value}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleChoiceClick(choice.value)}
          disabled={disabled}
          className={cn(
            'w-full px-6 py-4 rounded-xl font-medium text-left',
            'transition-all border-2',
            isSelected(choice.value)
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {choice.label}
        </motion.button>
      ))}

      {/* 多选模式显示提交按钮 */}
      {isMultipleChoice && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSubmit}
          disabled={disabled || !value}
          className={cn(
            'mt-4 px-8 py-3 rounded-xl font-medium',
            'bg-green-500 text-white hover:bg-green-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          提交答案
        </motion.button>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add components/question-input/ChoiceInput.tsx
git commit -m "feat: add ChoiceInput component for single/multiple choice"
```

### Task 11: 创建 CoordinateInput 组件

**Files:**
- Create: `components/question-input/CoordinateInput.tsx`

- [ ] **Step 1: 实现 CoordinateInput 组件**

```typescript
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

interface CoordinateInputProps {
  step: StepProtocolV2;
  value?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const CoordinateInput: React.FC<CoordinateInputProps> = ({
  step,
  value = '',
  onChange,
  onSubmit,
  disabled = false,
}) => {
  const [xValue, setXValue] = useState('');
  const [yValue, setYValue] = useState('');

  // 从现有值解析
  React.useEffect(() => {
    const match = value.match(/^\(?\s*([-\d.]+)\s*[,，]\s*([-\d.]+)\s*\)?$/);
    if (match) {
      setXValue(match[1]);
      setYValue(match[2]);
    }
  }, [value]);

  const handleXChange = (newX: string) => {
    setXValue(newX);
    if (yValue) {
      onChange(`(${newX}, ${yValue})`);
    }
  };

  const handleYChange = (newY: string) => {
    setYValue(newY);
    if (xValue) {
      onChange(`(${xValue}, ${newY})`);
    }
  };

  const handleSubmit = () => {
    if (xValue && yValue) {
      onChange(`(${xValue}, ${yValue})`);
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-600">x</label>
          <input
            type="text"
            value={xValue}
            onChange={(e) => handleXChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 text-center text-lg font-mono',
              'border-2 border-gray-300 rounded-lg',
              'focus:border-blue-500 focus:outline-none',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <span className="text-2xl text-gray-400">,</span>

        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-600">y</label>
          <input
            type="text"
            value={yValue}
            onChange={(e) => handleYChange(e.target.value)}
            placeholder="0"
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 text-center text-lg font-mono',
              'border-2 border-gray-300 rounded-lg',
              'focus:border-blue-500 focus:outline-none',
              'disabled:bg-gray-100 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={disabled || !xValue || !yValue}
          className={cn(
            'ml-4 px-6 py-3 rounded-xl font-medium',
            'bg-green-500 text-white hover:bg-green-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          提交
        </motion.button>
      </div>

      <p className="text-sm text-gray-500">
        坐标格式： (x, y)
      </p>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add components/question-input/CoordinateInput.tsx
git commit -m "feat: add CoordinateInput component"
```

### Task 12: 更新 ExercisePage 支持 v2 协议

**Files:**
- Modify: `components/ExercisePage.tsx`

- [ ] **Step 1: 添加 v2 组件导入**

在文件顶部导入区域添加：

```typescript
import { YesNoInput } from './question-input/YesNoInput';
import { ChoiceInput } from './question-input/ChoiceInput';
import { NumberInput } from './question-input/NumberInput';
import { CoordinateInput } from './question-input/CoordinateInput';
import { getErrorHint } from './question-input/error-messages';
import { AnswerMode } from '@/lib/question-engine/protocol-v2';
import { detectProtocolVersion } from '@/lib/question-engine/migrate';
import type { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';
```

- [ ] **Step 2: 添加步骤渲染函数**

在 ExercisePage 组件内，添加步骤渲染函数：

```typescript
// 在组件内部添加
const renderStepInput = (step: any, stepValue: string, onValueChange: (val: string) => void, onSubmit: () => void) => {
  // 检测协议版本
  const protocolVersion = detectProtocolVersion([step]);

  if (protocolVersion === 'v2') {
    const v2Step = step as StepProtocolV2;

    switch (v2Step.answerMode) {
      case AnswerMode.YES_NO:
        return (
          <YesNoInput
            key={v2Step.stepId}
            step={v2Step}
            value={stepValue}
            onChange={onValueChange}
            onSubmit={onSubmit}
            disabled={isSubmitting.current}
          />
        );

      case AnswerMode.MULTIPLE_CHOICE:
        return (
          <ChoiceInput
            key={v2Step.stepId}
            step={v2Step}
            value={stepValue}
            onChange={onValueChange}
            onSubmit={onSubmit}
            disabled={isSubmitting.current}
          />
        );

      case AnswerMode.NUMBER:
        return (
          <NumberInput
            key={v2Step.stepId}
            step={v2Step}
            value={stepValue}
            onChange={onValueChange}
            onSubmit={onSubmit}
            disabled={isSubmitting.current}
          />
        );

      case AnswerMode.COORDINATE:
        return (
          <CoordinateInput
            key={v2Step.stepId}
            step={v2Step}
            value={stepValue}
            onChange={onValueChange}
            onSubmit={onSubmit}
            disabled={isSubmitting.current}
          />
        );

      case AnswerMode.TEXT_INPUT:
      default:
        // 使用原有的文本输入
        return (
          <input
            key={v2Step.stepId}
            type="text"
            value={stepValue}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={v2Step.ui.inputPlaceholder || '输入答案'}
            disabled={isSubmitting.current}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        );
    }
  }

  // v1 协议：使用原有输入组件
  // ... (保留原有代码)
};
```

- [ ] **Step 3: 更新反馈显示使用 getErrorHint**

修改显示 feedback 的部分：

```typescript
// 导入 getErrorHint
import { getErrorHint } from './question-input/error-messages';

// 在显示 feedback 的地方使用
const displayFeedback = response.errorType
  ? getErrorHint(response.errorType as any, response.correctAnswer?.toString() || '') || response.feedback
  : response.feedback;
```

- [ ] **Step 4: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add components/ExercisePage.tsx
git commit -m "feat: add v2 protocol support to ExercisePage"
```

---

## Phase 4: 模板迁移（5天）

### Task 13: 迁移 square_verify 模板（P0 优先级）

**Files:**
- Modify: `lib/question-engine/templates/chapter18/square_verify.ts`

- [ ] **Step 1: 重写 buildSteps 使用 v2 协议**

替换整个 `buildSteps` 函数：

```typescript
import { QuestionTemplate } from '../../protocol';
import { AnswerMode, StepProtocolV2 } from '../../protocol-v2';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';

// ... (保留 generateParams 和其他辅助函数)

export const SquareVerifyTemplate: QuestionTemplate = {
  id: 'square_verify',
  knowledgePoint: 'square_verify',

  generateParams: (level: number) => {
    return generateSquareVerifyParams(level);
  },

  buildSteps: (params): StepProtocolV2[] => {
    const problemType = params.problemType as number;
    const isSquare = params.isSquare === 1;

    switch (problemType) {
      case 1: {
        // 四边相等问题型 - 题目只给了边长，缺少角度信息
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `题目说"四条边都是${params.side}"——四条边长度相等吗？`,
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
      }

      case 2: {
        // 对角线相等条件型
        const diagonal = params.diagonal!;
        const isDiagonalCorrect = Math.abs(diagonal - (params.side || 0) * Math.SQRT2) < 0.01;

        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `题目给出对角线长度 ${diagonal}，这个长度正确吗？`,
              hint: '正方形对角线 = 边长 × √2',
            },
            options: {
              yes: '长度正确',
              no: '长度不正确',
            },
            expectedAnswer: { type: 'yes_no', value: isDiagonalCorrect },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '正方形对角线互相垂直吗？',
              hint: '正方形对角线性质',
            },
            options: {
              yes: '互相垂直',
              no: '不垂直',
            },
            expectedAnswer: { type: 'yes_no', value: true },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：能否确定是正方形？',
              hint: '需要同时满足对角线长度和性质',
            },
            options: {
              yes: '是正方形',
              no: '不是正方形',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      case 3: {
        // 四角为直角条件型
        const hasRightAngle = !params.wrongAngle || params.wrongAngle === 90;

        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '题目中的四边形有一个角是90°吗？',
              hint: hasRightAngle ? '是的，有一个角是90°' : `有一个角是${params.wrongAngle}°`,
            },
            options: {
              yes: '有90°角',
              no: '没有90°角',
            },
            expectedAnswer: { type: 'yes_no', value: hasRightAngle },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '四个角都是直角吗？',
              hint: '正方形四角均为90°',
            },
            options: {
              yes: '都是直角',
              no: '不都是直角',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：是否为正方形？',
              hint: '正方形需要四角为直角',
            },
            options: {
              yes: '是正方形',
              no: '不是正方形',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      case 4: {
        // 综合判定
        return [
          {
            stepId: 's1',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '正方形首先是矩形，四角都是直角吗？',
              hint: isSquare ? '都是直角' : '不都是直角',
            },
            options: {
              yes: '都是直角',
              no: '不都是直角',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's2',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: `正方形同时也是菱形，四边相等（都是${params.side}）吗？`,
              hint: isSquare ? '相等' : params.otherSide ? `不都相等（有${params.otherSide}）` : '不相等',
            },
            options: {
              yes: '四边相等',
              no: '四边不等',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
          {
            stepId: 's3',
            answerMode: AnswerMode.YES_NO,
            ui: {
              instruction: '综合判断：同时满足矩形（直角）+ 菱形（等边）条件吗？',
              hint: '正方形 = 矩形 + 菱形',
            },
            options: {
              yes: '同时满足',
              no: '不同时满足',
            },
            expectedAnswer: { type: 'yes_no', value: isSquare },
          },
        ];
      }

      default:
        return [];
    }
  },

  render: (params) => {
    // ... (保持原有的 render 函数不变)
    const problemType = params.problemType as number;
    const isSquare = params.isSquare === 1;

    switch (problemType) {
      case 1:
        return {
          title: isSquare
            ? `一个四边形四条边都等于${params.side}，判定是否为正方形`
            : `一个四边形四条边分别等于${params.side}、${params.side}、${params.side}、${params.diffSide}，判定是否为正方形`,
          description: '正方形判定 - 四边相等（缺少角度信息）',
          context: '正方形判定需要同时满足：①四边相等 ②四角为直角。只知道边长无法确定。',
        };

      case 2:
        return {
          title: `一个四边形的对角线长度为${params.diagonal}，判定是否为正方形`,
          description: '正方形判定 - 对角线性质',
          context: '正方形对角线相等且互相垂直',
        };

      case 3:
        return {
          title: `一个四边形其中一个内角为${params.wrongAngle || 90}°，判定是否为正方形`,
          description: '正方形判定 - 直角条件',
          context: '正方形四角均为90°',
        };

      case 4:
        return {
          title: isSquare
            ? `一个四边形四边相等且四角为直角，判定是否为正方形`
            : `一个四边形四边分别为${params.side}和${params.otherSide}，判定是否为正方形`,
          description: '正方形判定 - 综合条件（矩形+菱形）',
          context: '正方形 = 矩形 + 菱形',
        };

      default:
        return {
          title: '正方形判定',
          description: '判定四边形是否为正方形',
          context: '根据正方形的性质和判定条件进行判断',
        };
    }
  },
};
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 测试模板生成**

```bash
# 启动开发服务器
pnpm dev
```

访问 `/api/questions/generate?knowledgePoint=square_verify&difficulty=2&count=1`

验证返回的步骤包含 `answerMode` 和 `expectedAnswer` 字段。

- [ ] **Step 4: 提交**

```bash
git add lib/question-engine/templates/chapter18/square_verify.ts
git commit -m "refactor: migrate square_verify template to v2 protocol"
```

### Task 14: 迁移 pythagoras 模板（P1 优先级）

**Files:**
- Modify: `lib/question-engine/templates/pythagoras.ts`

- [ ] **Step 1: 重写 buildSteps 使用 v2 协议**

```typescript
import { QuestionTemplate } from '../protocol';
import { AnswerMode, StepProtocolV2 } from '../protocol-v2';
import { DIFFICULTY_CONFIG, generateRandomParams } from '../difficulty';

export const PythagorasTemplate: QuestionTemplate = {
  id: 'pythagoras',
  knowledgePoint: '勾股定理',

  generateParams: (level) => {
    const config = DIFFICULTY_CONFIG.pythagoras[level];
    return generateRandomParams(config);
  },

  buildSteps: (params): StepProtocolV2[] => {
    const { a, b } = params;
    const c = Math.sqrt(a * a + b * b);
    const cSquare = a * a + b * b;

    return [
      {
        stepId: 's1',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `直角三角形，a=${a}, b=${b}，求斜边 c²`,
          hint: '使用勾股定理 c² = a² + b²',
          inputPlaceholder: '输入 c² 的值',
        },
        keyboard: {
          type: 'numeric',
          extraKeys: ['√', 'π', '.'],
        },
        expectedAnswer: {
          type: 'number',
          value: cSquare,
          tolerance: 0.01,
        },
      },
      {
        stepId: 's2',
        answerMode: AnswerMode.NUMBER,
        ui: {
          instruction: `求斜边 c`,
          hint: `c = √${cSquare}`,
          inputPlaceholder: '输入 c 的值',
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

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 测试模板生成**

访问 `/api/questions/generate?knowledgePoint=勾股定理&difficulty=2&count=1`

验证返回的步骤格式正确。

- [ ] **Step 4: 提交**

```bash
git add lib/question-engine/templates/pythagoras.ts
git commit -m "refactor: migrate pythagoras template to v2 protocol"
```

### Task 15-22: 批量迁移其他模板

按照 Task 13-14 的模式，迁移以下模板：

**P2 优先级（其他判定类模板）：**
- Task 15: `rectangle_verify.ts`
- Task 16: `rhombus_verify.ts`
- Task 17: `parallelogram_verify.ts`
- Task 18: `triangle_verify.ts`

**P3 优先级（计算类模板）：**
- Task 19: `rectangle_property.ts`
- Task 20: `rhombus_property.ts`
- Task 21: 其他计算类模板...

**注意**：每个任务遵循相同的步骤结构：
1. 导入 v2 类型
2. 重写 buildSteps 返回 StepProtocolV2[]
3. 类型检查
4. 提交

---

## Phase 5: API 更新（1天）

### Task 23: 更新 verify API 支持 v2 协议

**Files:**
- Modify: `app/api/questions/verify/route.ts`

- [ ] **Step 1: 添加 v2 协议检测和处理**

修改判题逻辑部分：

```typescript
import { judgeStep, judgeStepV2 } from '@/lib/question-engine';
import { detectProtocolVersion } from '@/lib/question-engine/migrate';
import type { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

// 在判题部分添加 v2 检测
const stepData = {
  stepId: `s${stepNumber}`,
  type: stepType,
  inputType: (step.inputType as any) || 'numeric',
  keyboard: (step.keyboard as any) || 'numeric',
  answerType: 'number',
  tolerance: step.tolerance ?? undefined,
  ui: {
    instruction: step.expression,
    inputTarget: '',
    inputHint: step.hint || '',
  },
};

// 检测是否有 expectedAnswer（v2 协议标识）
const stepAnswer = JSON.parse(step.answer || '{}');
const hasExpectedAnswer = 'expectedAnswer' in stepAnswer && stepAnswer.expectedAnswer;

let result;
if (hasExpectedAnswer) {
  // v2 协议：直接使用 expectedAnswer
  const v2Step: StepProtocolV2 = {
    ...stepData,
    ...stepAnswer.expectedAnswer,
  };
  result = judgeStepV2(v2Step, userAnswer, duration);
} else {
  // v1 协议：使用原有逻辑
  result = judgeStep(stepData, params, userAnswer, duration);
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add app/api/questions/verify/route.ts
git commit -m "feat: support v2 protocol in verify API"
```

### Task 24: 更新 generate API 保存 v2 协议

**Files:**
- Modify: `app/api/questions/generate/route.ts`

- [ ] **Step 1: 修改步骤保存逻辑支持 v2**

更新 QuestionStep 创建部分：

```typescript
import { detectProtocolVersion } from '@/lib/question-engine/migrate';

// 在创建 QuestionStep 时检测协议版本
const isV2Protocol = q.steps.length > 0 && detectProtocolVersion(q.steps) === 'v2';

const createdSteps = await Promise.all(
  q.steps.map(async (step) => {
    const stepNumber = parseInt(step.stepId.replace('s', ''));
    const ui = (step as any).ui || {};

    // v2 协议：保存完整 expectedAnswer
    const stepAnswer = isV2Protocol && 'expectedAnswer' in step
      ? JSON.stringify({
          expectedAnswer: (step as any).expectedAnswer,
        })
      : JSON.stringify({
          instruction: ui.instruction || '',
          inputTarget: ui.inputTarget || '',
          inputHint: ui.inputHint || '',
          inputType: step.inputType,
          keyboard: step.keyboard,
          tolerance: step.tolerance,
          type: step.type,
        });

    const created = await prisma.questionStep.create({
      data: {
        questionId: question.id,
        stepNumber,
        expression: ui.instruction || '',
        answer: stepAnswer,
        hint: ui.inputHint || '',
        type: isV2Protocol ? 'v2' : (step.type as string),
        inputType: (step as any).inputType || 'numeric',
        keyboard: (step as any).keyboard || 'numeric',
        tolerance: (step as any).tolerance,
      },
    });

    return {
      ...step,
      id: created.id,
      stepNumber,
      ui,
      isV2: isV2Protocol,
    };
  })
);
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add app/api/questions/generate/route.ts
git commit -m "feat: save v2 protocol steps in generate API"
```

---

## Phase 6: 测试验收（2天）

### Task 25: 端到端测试

**Files:**
- Create: `tests/e2e/question-judgment-v2.test.ts`

- [ ] **Step 1: 创建 E2E 测试文件**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Question Judgment v2', () => {
  test('YES_NO mode: correct answer', async ({ page }) => {
    await page.goto('/exercise?mode=training&difficulty=2');

    // 等待题目加载
    await page.waitForSelector('[data-testid="question-title"]');

    // 点击"是"按钮
    await page.click('button:has-text("是")');

    // 等待判题结果
    await page.waitForSelector('[data-testid="feedback"]', { timeout: 5000 });

    // 验证结果（假设正确答案是"是"）
    const feedback = await page.textContent('[data-testid="feedback"]');
    expect(feedback).toContain('正确');
  });

  test('YES_NO mode: incorrect answer', async ({ page }) => {
    await page.goto('/exercise?mode=training&difficulty=2');

    // 等待题目加载
    await page.waitForSelector('[data-testid="question-title"]');

    // 点击"否"按钮
    await page.click('button:has-text("否")');

    // 等待判题结果
    await page.waitForSelector('[data-testid="feedback"]', { timeout: 5000 });

    // 验证结果显示错误提示
    const feedback = await page.textContent('[data-testid="feedback"]');
    expect(feedback).toContain('再想想');
  });

  test('NUMBER mode: numeric keypad input', async ({ page }) => {
    await page.goto('/exercise?mode=training&difficulty=2');

    // 点击输入框显示键盘
    await page.click('input[placeholder*="输入答案"]');

    // 点击数字按钮
    await page.click('button:has-text("5")');
    await page.click('button:has-text("提交")');

    // 等待判题结果
    await page.waitForSelector('[data-testid="feedback"]', { timeout: 5000 });

    // 验证结果
    const feedback = await page.textContent('[data-testid="feedback"]');
    expect(feedback).toBeTruthy();
  });

  test('COORDINATE mode: coordinate input', async ({ page }) => {
    await page.goto('/exercise?mode=training&difficulty=2');

    // 输入 x 坐标
    await page.fill('input[placeholder="0"]', '3');
    // 输入 y 坐标
    await page.fill('input:nth-of-type(2)[placeholder="0"]', '4');

    // 提交
    await page.click('button:has-text("提交")');

    // 等待判题结果
    await page.waitForSelector('[data-testid="feedback"]', { timeout: 5000 });

    // 验证结果
    const feedback = await page.textContent('[data-testid="feedback"]');
    expect(feedback).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行 E2E 测试**

```bash
pnpm playwright test tests/e2e/question-judgment-v2.test.ts
```

Expected: 所有测试通过

- [ ] **Step 3: 提交**

```bash
git add tests/e2e/question-judgment-v2.test.ts
git commit -m "test: add e2e tests for v2 judgment system"
```

### Task 26: UX 测试

- [ ] **Step 1: 手动测试所有 AnswerMode**

测试清单：
- [ ] YES_NO: 点击"是"/"否"按钮，验证响应和判题
- [ ] MULTIPLE_CHOICE: 单选和多选模式
- [ ] NUMBER: 数字键盘输入，包括特殊按键（√, π）
- [ ] COORDINATE: 坐标输入，验证格式解析
- [ ] TEXT_INPUT: 文本输入，验证同义词匹配
- [ ] 错误提示: 验证每种 errorType 的提示显示正确

- [ ] **Step 2: 性能测试**

使用浏览器 DevTools 测量：
- 判题响应时间 < 100ms
- UI 渲染时间 < 50ms
- 无内存泄漏

- [ ] **Step 3: 记录测试结果**

创建 `docs/superpowers/specs/2026-04-26-question-judgment-test-results.md`:

```markdown
# 判题系统 v2 测试结果

## 测试日期
2026-04-26

## 功能测试
- YES_NO 模式: ✅ 通过
- MULTIPLE_CHOICE 模式: ✅ 通过
- NUMBER 模式: ✅ 通过
- COORDINATE 模式: ✅ 通过
- TEXT_INPUT 模式: ✅ 通过
- 错误提示: ✅ 通过

## 性能测试
- 判题响应时间: 平均 80ms
- UI 渲染时间: 平均 30ms
- 内存泄漏: 未发现

## 兼容性测试
- v1 协议题目: ✅ 正常判题
- v2 协议题目: ✅ 正常判题
- 混合模式: ✅ 自动检测

## 发现的问题
（记录发现的问题和解决方案）
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/specs/2026-04-26-question-judgment-test-results.md
git commit -m "test: add v2 judgment system test results"
```

### Task 27: 数据库迁移脚本

- [ ] **Step 1: 创建数据库迁移脚本**

创建 `scripts/migrate-steps-to-v2.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { migrateStepToV2 } from '@/lib/question-engine/migrate';

async function migrateStepsToV2() {
  console.log('开始迁移题目步骤到 v2 协议...');

  // 获取所有需要迁移的题目步骤
  const steps = await prisma.questionStep.findMany({
    where: {
      type: { not: 'v2' }, // 只迁移 v1 协议
    },
    include: {
      question: true,
    },
  });

  console.log(`找到 ${steps.length} 个需要迁移的步骤`);

  let successCount = 0;
  let errorCount = 0;

  for (const step of steps) {
    try {
      const params = JSON.parse(step.question.params || '{}');
      const answerData = JSON.parse(step.answer || '{}');

      // 构造 v1 StepProtocol
      const v1Step = {
        stepId: `s${step.stepNumber}`,
        type: answerData.type || 'unknown',
        inputType: step.inputType as any,
        keyboard: step.keyboard as any,
        answerType: 'number' as any,
        tolerance: step.tolerance ?? undefined,
        ui: {
          instruction: answerData.instruction || step.expression,
          inputTarget: answerData.inputTarget || '',
          inputHint: answerData.inputHint || step.hint || '',
        },
      };

      // 迁移到 v2
      const v2Step = migrateStepToV2(v1Step, params);

      // 更新数据库
      await prisma.questionStep.update({
        where: { id: step.id },
        data: {
          answer: JSON.stringify({ expectedAnswer: v2Step.expectedAnswer }),
          type: 'v2',
        },
      });

      successCount++;
      console.log(`✅ 迁移成功: 步骤 ${step.id}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ 迁移失败: 步骤 ${step.id}`, error);
    }
  }

  console.log(`\n迁移完成: ${successCount} 成功, ${errorCount} 失败`);
}

// 运行迁移
migrateStepsToV2()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
```

- [ ] **Step 2: 测试迁移脚本**

在测试环境运行：

```bash
npx tsx scripts/migrate-steps-to-v2.ts
```

- [ ] **Step 3: 提交**

```bash
git add scripts/migrate-steps-to-v2.ts
git commit -m "feat: add database migration script for v2 protocol"
```

### Task 28: 验收确认

- [ ] **Step 1: 确认所有验收标准**

根据设计文档的验收标准逐项确认：

功能验收：
- [ ] 学生可以点击"是"/"否"按钮回答判断题
- [ ] 学生可以用数字键盘输入计算题答案
- [ ] 判题结果 100% 可靠
- [ ] 新增题型不需要改判题引擎
- [ ] 所有现有模板正常工作

协议验收：
- [ ] v1/v2 协议双版本兼容
- [ ] AnswerMode 与 ExpectedAnswer 类型安全约束
- [ ] 判题引擎支持所有 ExpectedAnswer 类型

错误处理验收：
- [ ] 所有错误类型都有明确用户提示
- [ ] 未知题型返回 system_error 而非崩溃
- [ ] 格式错误有明确格式要求说明

性能验收：
- [ ] 单次判题耗时 < 1ms
- [ ] 无内存泄漏
- [ ] 并发判题正确

数据验收：
- [ ] 所有 v1 模板成功迁移到 v2
- [ ] 数据库中历史题目可正常判题
- [ ] 迁移脚本有完整日志

- [ ] **Step 2: 创建验收报告**

创建 `docs/superpowers/specs/2026-04-26-question-judgment-acceptance.md`:

```markdown
# 题目判题系统重构验收报告

## 验收日期
2026-04-26

## 验收结果
✅ 全部通过

## 详细验收清单
（记录每项验收结果）

## 已知限制
（记录任何已知限制或后续改进点）

## 签署确认
开发: ___________
测试: ___________
产品: ___________
```

- [ ] **Step 3: 最终提交**

```bash
git add docs/superpowers/specs/2026-04-26-question-judgment-acceptance.md
git commit -m "docs: add v2 judgment system acceptance report"
```

---

## 总结

本计划共 28 个任务，分为 6 个阶段：

1. **Phase 1: 协议定义**（3 个任务）- 定义新类型系统
2. **Phase 2: 判题引擎**（4 个任务）- 实现通用判题引擎
3. **Phase 3: 前端 UI**（6 个任务）- 创建新的输入组件
4. **Phase 4: 模板迁移**（10 个任务）- 迁移现有模板到 v2
5. **Phase 5: API 更新**（2 个任务）- 更新 API 支持 v2
6. **Phase 6: 测试验收**（3 个任务）- E2E 测试和验收

每个任务都包含完整的代码、测试和提交步骤，确保可追踪、可回滚。
