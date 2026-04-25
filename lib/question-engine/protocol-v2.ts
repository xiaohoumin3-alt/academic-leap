/**
 * 题目协议 v2
 *
 * 主要改进:
 * - AnswerMode: 决定 UI 呈现方式（是/否按钮、数字键盘、选项按钮等）
 * - ExpectedAnswer: 类型安全的答案定义（判题用）
 * - StepProtocolV2: 支持更多答题模式的步骤协议
 */

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
