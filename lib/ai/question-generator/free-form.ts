/**
 * Free-Form AI Question Generator
 *
 * Generates questions entirely using AI when templates are not
 * available or when more variety is needed.
 *
 * Supports:
 * - Multiple choice questions
 * - Fill-in-the-blank questions
 * - True/false questions
 * - Calculation questions with template filling
 */

import { ModelAdapter, ModelType } from '@/lib/ai/model-adapter';

export interface FreeFormOptions {
  knowledgePoint: string;
  difficultyLevel: number;
  style?: 'standard' | 'guided' | 'gamified' | 'story';
  count?: number;
}

export interface FreeFormQuestion {
  knowledgePoint: string;
  question: string;
  answer: string;
  explanation: string;
  difficulty: number;
  steps?: Array<{
    description: string;
    answer: string;
  }>;
}

// ============================================================================
// Fill-in-the-Blank Question Types
// ============================================================================

export type FillBlankOperator =
  | '+'    // Addition
  | '-'    // Subtraction
  | '*'    // Multiplication
  | '/'    // Division
  | '^'    // Exponentiation
  | 'sqrt'; // Square root

export interface FillBlankTemplate {
  /** Template structure with placeholders */
  structure: string;
  /** Parameter definitions */
  params: {
    name: string;
    type: 'integer' | 'decimal' | 'operator' | 'choice';
    range?: { min: number; max: number };
    options?: string[];
    constraints?: string[];
  }[];
}

export interface FillBlankRequest {
  knowledgePoint: string;
  difficultyLevel: number; // 0-5 scale (1=easy, 5=hard)
  grade?: number;
  template?: FillBlankTemplate;
}

export interface FillBlankQuestion {
  id: string;
  knowledgePoint: string;
  question: string;
  answer: string;
  explanation: string;
  difficulty: number;
  template: string;
  computedValues: Record<string, string | number>;
}

export interface FillBlankResult {
  success: boolean;
  question?: FillBlankQuestion;
  error?: string;
}

// ============================================================================
// Predefined Fill-in-the-Blank Templates
// ============================================================================

const FILL_BLANK_TEMPLATES: Record<string, FillBlankTemplate> = {
  // Basic arithmetic
  addition: {
    structure: '{num1} + {num2} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 1, max: 100 } },
      { name: 'num2', type: 'integer', range: { min: 1, max: 100 } }
    ]
  },
  subtraction: {
    structure: '{num1} - {num2} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 10, max: 100 } },
      { name: 'num2', type: 'integer', range: { min: 1, max: 50 }, constraints: ['num2 <= num1'] }
    ]
  },
  multiplication: {
    structure: '{num1} × {num2} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 2, max: 12 } },
      { name: 'num2', type: 'integer', range: { min: 2, max: 12 } }
    ]
  },
  division: {
    structure: '{num1} ÷ {num2} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 10, max: 100 } },
      { name: 'num2', type: 'integer', range: { min: 2, max: 10 }, constraints: ['num1 % num2 == 0'] }
    ]
  },
  // Fraction operations
  fraction_add: {
    structure: '{num1}/{denom1} + {num2}/{denom2} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 1, max: 9 } },
      { name: 'denom1', type: 'integer', range: { min: 2, max: 9 } },
      { name: 'num2', type: 'integer', range: { min: 1, max: 9 } },
      { name: 'denom2', type: 'integer', range: { min: 2, max: 9 } }
    ]
  },
  // Mixed operations
  order_of_operations: {
    structure: '{num1} + {num2} × {num3} = ?',
    params: [
      { name: 'num1', type: 'integer', range: { min: 1, max: 20 } },
      { name: 'num2', type: 'integer', range: { min: 2, max: 9 } },
      { name: 'num3', type: 'integer', range: { min: 2, max: 9 } }
    ]
  }
};

// ============================================================================
// Operator Definitions
// ============================================================================

const OPERATORS: Record<FillBlankOperator, { symbol: string; displayName: string }> = {
  '+': { symbol: '+', displayName: '加法' },
  '-': { symbol: '-', displayName: '减法' },
  '*': { symbol: '×', displayName: '乘法' },
  '/': { symbol: '÷', displayName: '除法' },
  '^': { symbol: '^', displayName: '幂运算' },
  'sqrt': { symbol: '√', displayName: '平方根' }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a random integer within range
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random decimal within range
 */
function randomDecimal(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

/**
 * Sample a random element from an array
 */
function sample<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Calculate result of binary operation
 */
function calculateResult(num1: number, operator: FillBlankOperator, num2: number): number {
  switch (operator) {
    case '+': return num1 + num2;
    case '-': return num1 - num2;
    case '*': return num1 * num2;
    case '/': return num1 / num2;
    case '^': return Math.pow(num1, num2);
    default: throw new Error(`Unknown operator: ${operator}`);
  }
}

/**
 * Round to significant digits for display
 */
function formatAnswer(value: number): string {
  // For integers, show without decimal
  if (Number.isInteger(value)) {
    return value.toString();
  }
  // For decimals, show up to 4 significant digits
  if (Math.abs(value) < 0.0001) {
    return value.toExponential(2);
  }
  return value.toPrecision(4);
}

/**
 * Check if value satisfies constraint
 */
function satisfiesConstraint(value: number, constraint: string, context: Record<string, string | number>): boolean {
  // Handle common constraint patterns
  if (constraint.includes('<=')) {
    const match = constraint.match(/(\w+)\s*<=\s*(\w+)/);
    if (match) {
      const [, left, right] = match;
      const rightVal = context[right];
      if (typeof rightVal === 'number') {
        return value <= rightVal;
      }
      return true;
    }
  }
  if (constraint.includes('%')) {
    const match = constraint.match(/(\w+)\s*%\s*(\w+)\s*==\s*0/);
    if (match) {
      const [, left, right] = match;
      const leftVal = context[left] as number;
      const rightVal = context[right] as number;
      if (typeof leftVal === 'number' && typeof rightVal === 'number') {
        return leftVal % rightVal === 0;
      }
      return true;
    }
  }
  return true;
}

/**
 * Sample parameters for a template based on difficulty
 */
function sampleTemplateParams(
  template: FillBlankTemplate,
  difficultyLevel: number
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const param of template.params) {
    switch (param.type) {
      case 'integer': {
        const range = param.range || { min: 1, max: 100 };
        // Adjust range based on difficulty
        const difficultyFactor = Math.max(0.3, 1 - (difficultyLevel - 1) * 0.15);
        const adjustedMax = Math.round(range.max * difficultyFactor);
        const adjustedMin = Math.round(range.min / difficultyFactor);
        result[param.name] = randomInt(adjustedMin, adjustedMax);
        break;
      }
      case 'decimal': {
        const range = param.range || { min: 0.1, max: 10 };
        result[param.name] = randomDecimal(range.min, range.max);
        break;
      }
      case 'operator': {
        const operators = param.options || ['+', '-', '*', '/'];
        result[param.name] = sample(operators);
        break;
      }
      case 'choice': {
        result[param.name] = sample(param.options || ['A', 'B', 'C', 'D']);
        break;
      }
    }
  }

  // Apply constraints iteratively
  let attempts = 0;
  const maxAttempts = 100;
  while (attempts < maxAttempts) {
    let valid = true;
    for (const param of template.params) {
      if (param.constraints) {
        for (const constraint of param.constraints) {
          if (!satisfiesConstraint(result[param.name] as number, constraint, result)) {
            valid = false;
            // Resample the parameter
            if (param.type === 'integer') {
              const range = param.range || { min: 1, max: 100 };
              result[param.name] = randomInt(range.min, range.max);
            }
          }
        }
      }
    }
    if (valid) break;
    attempts++;
  }

  return result;
}

// ============================================================================
// AI-Enhanced Template Filling
// ============================================================================

/**
 * Fill template using AI to generate contextual parameters
 */
async function fillTemplateWithAI(
  template: FillBlankTemplate,
  knowledgePoint: string,
  difficultyLevel: number,
  adapter: ModelAdapter
): Promise<Record<string, string | number>> {
  const prompt = `
请为以下数学题目模板生成合适的参数值：

知识点：${knowledgePoint}
难度等级：${difficultyLevel} (1=简单, 5=困难)

模板结构：${template.structure}
参数定义：${JSON.stringify(template.params.map(p => ({
  name: p.name,
  type: p.type,
  range: p.range,
  constraints: p.constraints
})))}

要求：
1. 参数值必须符合难度等级
2. 答案必须是整数或简单小数
3. 结果要符合数学逻辑
4. 不要生成超出小学生理解范围的数字

请返回JSON格式：
{
  "num1": 数字1,
  "num2": 数字2,
  "num3": 数字3 (如果有),
  "denom1": 分母1 (如果有),
  "denom2": 分母2 (如果有)
}
`;

  const response = await adapter.generate(prompt, {
    responseFormat: 'json',
    maxTokens: 500,
    temperature: 0.8
  });

  try {
    const parsed = JSON.parse(response.content);
    // Convert all values to numbers where possible
    const result: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number') {
        result[key] = value;
      } else if (typeof value === 'string' && !isNaN(Number(value))) {
        result[key] = Number(value);
      } else if (value !== null && value !== undefined) {
        result[key] = String(value);
      }
    }
    return result;
  } catch {
    // Fallback to random sampling
    return sampleTemplateParams(template, difficultyLevel);
  }
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate a fill-in-the-blank question
 */
export async function generateFillBlank(
  request: FillBlankRequest
): Promise<FillBlankResult> {
  const { knowledgePoint, difficultyLevel, grade = 3 } = request;

  try {
    // Determine template based on knowledge point
    let templateKey = 'addition';
    const kpLower = knowledgePoint.toLowerCase();

    if (kpLower.includes('加法') || kpLower.includes('addition')) {
      templateKey = 'addition';
    } else if (kpLower.includes('减法') || kpLower.includes('subtraction')) {
      templateKey = 'subtraction';
    } else if (kpLower.includes('乘法') || kpLower.includes('multiplication')) {
      templateKey = 'multiplication';
    } else if (kpLower.includes('除法') || kpLower.includes('division')) {
      templateKey = 'division';
    } else if (kpLower.includes('分数') || kpLower.includes('fraction')) {
      templateKey = 'fraction_add';
    } else if (kpLower.includes('运算律') || kpLower.includes('order')) {
      templateKey = 'order_of_operations';
    }

    // Get template
    const template = request.template || FILL_BLANK_TEMPLATES[templateKey];
    if (!template) {
      return {
        success: false,
        error: `Unknown template for knowledge point: ${knowledgePoint}`
      };
    }

    // Initialize model adapter
    const model = difficultyLevel >= 4 ? 'claude-sonnet-4.6' : 'claude-haiku-4.5';
    const adapter = new ModelAdapter({ model });

    // Generate parameters using AI
    let params: Record<string, string | number>;
    if (request.template) {
      // Custom template: always use AI
      params = await fillTemplateWithAI(template, knowledgePoint, difficultyLevel, adapter);
    } else {
      // Predefined template: use AI for higher difficulty
      if (difficultyLevel >= 3) {
        try {
          params = await fillTemplateWithAI(template, knowledgePoint, difficultyLevel, adapter);
        } catch {
          // Fallback to random sampling
          params = sampleTemplateParams(template, difficultyLevel);
        }
      } else {
        // Lower difficulty: use simple random sampling
        params = sampleTemplateParams(template, difficultyLevel);
      }
    }

    // Build question from template
    let question = template.structure;
    for (const [key, value] of Object.entries(params)) {
      question = question.replace(`{${key}}`, String(value));
    }

    // Calculate answer based on template
    let answer: string;
    let explanation: string;

    if (templateKey === 'order_of_operations') {
      const num1 = params.num1 as number;
      const num2 = params.num2 as number;
      const num3 = params.num3 as number;
      const product = num2 * num3;
      const result = num1 + product;
      answer = formatAnswer(result);
      explanation = `先算乘法: ${num2} × ${num3} = ${product}\n再算加法: ${num1} + ${product} = ${result}`;
    } else if (templateKey === 'fraction_add') {
      const num1 = params.num1 as number;
      const denom1 = params.denom1 as number;
      const num2 = params.num2 as number;
      const denom2 = params.denom2 as number;

      // Find LCM for fraction addition
      const lcm = (a: number, b: number): number => {
        return (a * b) / gcd(a, b);
      };
      const gcd = (a: number, b: number): number => {
        return b === 0 ? a : gcd(b, a % b);
      };

      const l = lcm(denom1, denom2);
      const newNum1 = num1 * (l / denom1);
      const newNum2 = num2 * (l / denom2);
      const result = newNum1 + newNum2;

      answer = `${result}/${l}`;
      explanation = `通分: 最小公倍数是 ${l}\n${num1}/${denom1} = ${newNum1}/${l}\n${num2}/${denom2} = ${newNum2}/${l}\n相加: ${newNum1}/${l} + ${newNum2}/${l} = ${result}/${l}`;
    } else if (templateKey === 'division') {
      const num1 = params.num1 as number;
      const num2 = params.num2 as number;
      const result = num1 / num2;
      answer = formatAnswer(result);
      explanation = `${num1} ÷ ${num2} = ${answer}`;
    } else if (templateKey === 'multiplication') {
      const num1 = params.num1 as number;
      const num2 = params.num2 as number;
      const result = num1 * num2;
      answer = formatAnswer(result);
      explanation = `${num1} × ${num2} = ${result}`;
    } else if (templateKey === 'subtraction') {
      const num1 = params.num1 as number;
      const num2 = params.num2 as number;
      const result = num1 - num2;
      answer = formatAnswer(result);
      explanation = `${num1} - ${num2} = ${result}`;
    } else {
      // Default: addition
      const num1 = params.num1 as number;
      const num2 = params.num2 as number;
      const result = num1 + num2;
      answer = formatAnswer(result);
      explanation = `${num1} + ${num2} = ${result}`;
    }

    return {
      success: true,
      question: {
        id: generateId(),
        knowledgePoint,
        question,
        answer,
        explanation,
        difficulty: difficultyLevel,
        template: template.structure,
        computedValues: params
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating question'
    };
  }
}

/**
 * Generate multiple fill-in-the-blank questions
 */
export async function generateFillBlankBatch(
  request: FillBlankRequest & { count: number }
): Promise<FillBlankResult[]> {
  const { count = 1 } = request;
  const results: FillBlankResult[] = [];

  for (let i = 0; i < count; i++) {
    // Slightly vary difficulty for variety
    const variedDifficulty = Math.max(1, Math.min(5,
      request.difficultyLevel + Math.floor(Math.random() * 3) - 1
    ));

    const result = await generateFillBlank({
      ...request,
      difficultyLevel: variedDifficulty
    });
    results.push(result);
  }

  return results;
}

// ============================================================================
// Free-Form Generation (Legacy Interface)
// ============================================================================

/**
 * Generate questions using AI without template constraints
 */
export async function generateFreeForm(
  options: FreeFormOptions
): Promise<FreeFormQuestion[]> {
  const { knowledgePoint, difficultyLevel, count = 1 } = options;

  const adapter = new ModelAdapter({ model: 'claude-sonnet-4.6' });
  const grade = Math.max(1, Math.min(6, Math.ceil(difficultyLevel * 1.5)));

  const prompt = `
请为${grade || '3'}年级学生生成${count}道关于"${knowledgePoint}"的数学填空题。

要求：
1. 题目格式："{数字1} {运算符} {数字2} = ?"
2. 答案必须是整数或简单小数
3. 难度适中，符合${grade || '3'}年级水平
4. 每道题包含完整的解题步骤

请返回JSON格式数组：
[
  {
    "question": "题目内容",
    "answer": "答案",
    "explanation": "解题步骤",
    "difficulty": 难度等级(1-5)
  }
]
`;

  const response = await adapter.generate(prompt, {
    responseFormat: 'json',
    maxTokens: 2000,
    temperature: 0.7
  });

  try {
    const parsed = JSON.parse(response.content);
    const questions = Array.isArray(parsed) ? parsed : [parsed];

    return questions.map((q: { question: string; answer: string; explanation: string; difficulty: number }) => ({
      knowledgePoint,
      question: q.question,
      answer: q.answer,
      explanation: q.explanation || '',
      difficulty: q.difficulty || difficultyLevel,
      steps: []
    }));
  } catch {
    // Fallback: generate single question
    const result = await generateFillBlank({
      knowledgePoint,
      difficultyLevel
    });

    if (result.success && result.question) {
      return [{
        knowledgePoint,
        question: result.question.question,
        answer: result.question.answer,
        explanation: result.question.explanation,
        difficulty: result.question.difficulty,
        steps: []
      }];
    }

    return [];
  }
}
