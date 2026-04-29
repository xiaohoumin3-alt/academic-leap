import { ComplexitySpec, QuestionTemplate } from './types';

export interface TemplateComposition {
  base: string;
  transforms: Array<{
    name: string;
    apply: (template: string) => string;
  }>;
  perturbations: Array<{
    name: string;
    apply: (template: string) => string;
    type: 'irrelevant' | 'misleading' | 'trap';
  }>;
}

// 模板库 - 每种结构多个变体
const TEMPLATE_POOL: Record<string, QuestionTemplate[]> = {
  // linear + depth 1: 多种变体
  linear_d1: [
    {
      template: '解方程: {a}x {b:+d} = {c}',
      answer: 'x = {x}',
      params: { a: '1..10', b: '-10..10', c: '-20..20' },
      constraint: 'a != 0',
    },
    {
      template: '求 x 的值: {a}x {b:+d} = {c}',
      answer: 'x = {x}',
      params: { a: '2..10', b: '-8..8', c: '-15..15' },
      constraint: 'a != 0',
    },
    {
      template: '已知 {a}x {b:+d} = {c}，求 x',
      answer: 'x = {x}',
      params: { a: '1..8', b: '-12..12', c: '-18..18' },
      constraint: 'a != 0',
    },
    {
      template: '求解: {a}x {b:+d} = {c}',
      answer: 'x = {x}',
      params: { a: '3..9', b: '-6..6', c: '-12..12' },
      constraint: 'a != 0',
    },
  ],

  // linear + depth 2: 两边都有变量
  linear_d2: [
    {
      template: '解方程: {a}x {b:+d} = {c}x {d:+d}',
      answer: 'x = {x}',
      params: { a: '2..8', b: '-10..10', c: '1..7', d: '-10..10' },
      constraint: 'a != c',
    },
    {
      template: '已知 {a}x {b:+d} = {c}x {d:+d}，求 x',
      answer: 'x = {x}',
      params: { a: '3..7', b: '-8..8', c: '1..5', d: '-8..8' },
      constraint: 'a != c',
    },
    {
      template: '求解 x: {a}x {b:+d} = {c}x {d:+d}',
      answer: 'x = {x}',
      params: { a: '2..6', b: '-6..6', c: '1..4', d: '-6..6' },
      constraint: 'a != c',
    },
    {
      template: '方程 {a}x {b:+d} = {c}x {d:+d} 中 x 等于多少？',
      answer: 'x = {x}',
      params: { a: '2..8', b: '-5..5', c: '1..6', d: '-5..5' },
      constraint: 'a != c',
    },
  ],

  // linear + depth 3: 嵌套形式
  linear_d3: [
    {
      template: '解方程: {a}({b}x {c:+d}) = {e}',
      answer: 'x = {x}',
      hint: '先展开括号',
      params: { a: '2..5', b: '2..5', c: '-5..5', e: '10..40' },
      constraint: 'b != 0',
    },
    {
      template: '求解: {a}({b}x {c:+d}) = {e}',
      answer: 'x = {x}',
      hint: '先去括号',
      params: { a: '2..4', b: '2..4', c: '-4..4', e: '8..30' },
      constraint: 'b != 0',
    },
    {
      template: '已知 {a}({b}x {c:+d}) = {e}，求 x 的值',
      answer: 'x = {x}',
      params: { a: '3..5', b: '3..5', c: '-3..3', e: '15..45' },
      constraint: 'b != 0',
    },
  ],

  // linear + depth 4: 双重嵌套
  linear_d4: [
    {
      template: '解方程: {a}({b}({c}x {d:+d}) {e:+d}) = {f}',
      answer: 'x = {x}',
      hint: '从内到外展开',
      params: { a: '2..4', b: '2..4', c: '2..4', d: '-3..3', e: '-5..5', f: '20..60' },
      constraint: 'c != 0',
    },
    {
      template: '求解: {a}({b}({c}x {d:+d}) {e:+d}) = {f}',
      answer: 'x = {x}',
      params: { a: '2..3', b: '2..3', c: '2..3', d: '-2..2', e: '-3..3', f: '15..45' },
      constraint: 'c != 0',
    },
  ],

  // nested: 带括号的多层嵌套
  nested_d1: [
    {
      template: '解方程: {a}(x {b:+d}) = {c}',
      answer: 'x = {x}',
      hint: '先展开括号',
      params: { a: '2..5', b: '-5..5', c: '10..30' },
      constraint: 'a != 0',
    },
    {
      template: '求解: {a}(x {b:+d}) = {c}',
      answer: 'x = {x}',
      params: { a: '2..4', b: '-4..4', c: '8..24' },
      constraint: 'a != 0',
    },
  ],
  nested_d2: [
    {
      template: '解方程: {a}({b}(x {c:+d}) {d:+d}) = {e}',
      answer: 'x = {x}',
      hint: '先展开内层括号',
      params: { a: '2..4', b: '2..4', c: '-4..4', d: '-4..4', e: '15..50' },
      constraint: 'b != 0',
    },
    {
      template: '求解: {a}({b}(x {c:+d}) {d:+d}) = {e}',
      answer: 'x = {x}',
      params: { a: '2..3', b: '2..3', c: '-3..3', d: '-3..3', e: '10..40' },
      constraint: 'b != 0',
    },
  ],
  nested_d3: [
    {
      template: '解方程: {a}({b}({c}(x {d:+d}) {e:+d}) {f:+d}) = {g}',
      answer: 'x = {x}',
      hint: '从内到外逐步展开',
      params: { a: '2..3', b: '2..3', c: '2..3', d: '-3..3', e: '-3..3', f: '-3..3', g: '20..60' },
      constraint: 'c != 0',
    },
  ],
  nested_d4: [
    {
      template: '解方程: {a}({b}({c}({d}(x {e:+d}) {f:+d}) {g:+d}) {h:+d}) = {i}',
      answer: 'x = {x}',
      hint: '耐心展开每一层',
      params: { a: '2..3', b: '2..3', c: '2..3', d: '2..3', e: '-2..2', f: '-2..2', g: '-2..2', h: '-2..2', i: '30..80' },
      constraint: 'd != 0',
    },
  ],

  // multi_equation: 多方程组
  multi_d1: [
    {
      template: '解方程组:\\n{a1}x + {b1}y = {c1}\\n{a2}x + {b2}y = {c2}',
      answer: 'x = {x}, y = {y}',
      hint: '使用代入法或消元法',
      params: { a1: '1..5', b1: '1..5', c1: '5..20', a2: '1..5', b2: '1..5', c2: '5..20' },
      constraint: 'a1*b2 != a2*b1',
    },
  ],
  multi_d2: [
    {
      template: '解方程组:\\n{a1}x + {b1}y + {c1}z = {d1}\\n{a2}x + {b2}y + {c2}z = {d2}\\n{a3}x + {b3}y + {c3}z = {d3}',
      answer: 'x = {x}',
      hint: '先用两式消去一个变量',
      params: { a1: '1..4', b1: '1..4', c1: '1..4', d1: '10..30', a2: '1..4', b2: '1..4', c2: '1..4', d2: '10..30', a3: '1..4', b3: '1..4', c3: '1..4', d3: '10..30' },
    },
  ],

  // constraint_chain: 约束链
  chain_d1: [
    {
      template: '解方程: x {a:+d} = {b}',
      answer: 'x = {x}',
      params: { a: '1..10', b: '5..30' },
      constraint: 'x > -20',
    },
    {
      template: '求解: x {a:+d} = {b}',
      answer: 'x = {x}',
      params: { a: '1..8', b: '3..25' },
    },
  ],
  chain_d2: [
    {
      template: '解方程: x {a:+d} {b:+d} = {c}',
      answer: 'x = {x}',
      params: { a: '1..8', b: '1..8', c: '10..40' },
    },
    {
      template: '求解: x {a:+d} {b:+d} = {c}',
      answer: 'x = {x}',
      params: { a: '2..6', b: '2..6', c: '15..35' },
    },
  ],
  chain_d3: [
    {
      template: '解方程: x {a:+d} {b:+d} {c:+d} = {d_val}',
      answer: 'x = {x}',
      params: { a: '1..6', b: '1..6', c: '1..6', d_val: '20..50' },
    },
  ],
  chain_d4: [
    {
      template: '解方程: x {a:+d} {b:+d} {c:+d} {e:+d} = {f}',
      answer: 'x = {x}',
      hint: '先合并同类项',
      params: { a: '1..5', b: '1..5', c: '1..5', e: '1..5', f: '25..60' },
    },
  ],
};

// DISTRACTION 文本库
const DISTRACTION_TEXT = {
  irrelevant: [
    '根据以往经验',
    '老师曾经这样出过题',
    '这道题在考试中出现过',
    '小明用这种方法解题',
    '通常的做法是',
    '很多人会这样想',
    '有一种简便方法',
    '实际上还有另一种解法',
  ],
  misleading: [
    '提示：可以尝试移项',
    '注意：先合并同类项',
    '建议：从左边开始计算',
    '技巧：先把常数移到右边',
    '方法：观察方程结构',
  ],
  trap: [
    '注意：别忘了变号',
    '常见错误：忘记变号',
    '警示：符号别搞错',
    '小心：系数要乘进去',
    '注意：括号展开要变号',
  ],
};

export function getTemplate(spec: ComplexitySpec): QuestionTemplate | null {
  // 构建 key：structure_depth
  const structureKey = spec.structure;
  const depthKey = `d${spec.depth}`;

  // 尝试多种组合
  const keys = [
    `${structureKey}_${depthKey}`,
    `${structureKey}_d${Math.min(spec.depth, 4)}`,
    structureKey,
  ];

  for (const key of keys) {
    const templates = TEMPLATE_POOL[key];
    if (templates && templates.length > 0) {
      // 随机选择一个模板
      const index = Math.floor(Math.random() * templates.length);
      return templates[index];
    }
  }

  return null;
}

export function parseParamRange(range: string): { min: number; max: number } {
  const match = range.match(/^(-?\d+)\.\.(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid param range: ${range}`);
  }
  const min = parseInt(match[1], 10);
  const max = parseInt(match[2], 10);
  return { min, max };
}

export function sampleFromRange(range: string): number {
  const { min, max } = parseParamRange(range);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sampleParams(template: QuestionTemplate): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [key, range] of Object.entries(template.params as Record<string, string>)) {
    params[key] = sampleFromRange(range);
  }
  return params;
}

export function sampleWithConstraint(
  template: QuestionTemplate,
  maxRetries: number = 20
): Record<string, number> | null {
  for (let i = 0; i < maxRetries; i++) {
    const params = sampleParams(template);
    if (evaluateConstraint(template.constraint || '', params)) {
      return params;
    }
  }
  return null;
}

export function evaluateConstraint(
  constraint: string,
  params: Record<string, number>
): boolean {
  if (!constraint) return true;

  // Parse simple expressions
  const parts = constraint.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\w+)\s*(!=|==|>|<|>=|<=)\s*(\w+|-?\d+)$/);
    if (!match) continue;

    const [, left, op, right] = match;
    const leftValue = params[left];
    if (leftValue === undefined) continue;

    const rightValue = /^-?\d+$/.test(right)
      ? parseInt(right, 10)
      : params[right];

    if (rightValue === undefined) continue;

    let result = false;
    switch (op) {
      case '!=': result = leftValue !== rightValue; break;
      case '==': result = leftValue === rightValue; break;
      case '>': result = leftValue > rightValue; break;
      case '<': result = leftValue < rightValue; break;
      case '>=': result = leftValue >= rightValue; break;
      case '<=': result = leftValue <= rightValue; break;
    }
    if (!result) return false;
  }

  return true;
}

/**
 * Format specifier: {key:format} where format is like '+d' (signed decimal)
 */
export function fillTemplate(
  template: string,
  params: Record<string, number>
): string {
  const regex = /\{(\w+)(?::([^}]+))?\}/g;

  return template.replace(regex, (_, key, format) => {
    const value = params[key];
    if (value === undefined) {
      return `{${key}}`; // 保留未替换的占位符
    }

    if (!format) {
      return String(value);
    }

    if (format === '+d') {
      return value >= 0 ? `+${value}` : String(value);
    }

    return String(value);
  });
}

/**
 * 生成干扰文本
 */
export function generateDistraction(level: number): string[] {
  const distractors: string[] = [];

  if (level === 0) return distractors;

  // Level 1-2: Irrelevant info
  if (level >= 1) {
    const count = Math.min(level, 2);
    const shuffled = [...DISTRACTION_TEXT.irrelevant].sort(() => Math.random() - 0.5);
    distractors.push(...shuffled.slice(0, count));
  }

  // Level 2-3: Misleading
  if (level >= 2) {
    const shuffled = [...DISTRACTION_TEXT.misleading].sort(() => Math.random() - 0.5);
    distractors.push(shuffled[0]);
  }

  // Level 3: Adversarial trap
  if (level >= 3) {
    const shuffled = [...DISTRACTION_TEXT.trap].sort(() => Math.random() - 0.5);
    distractors.push(shuffled[0]);
    // Add second trap
    distractors.push(shuffled[1] || shuffled[0]);
  }

  return distractors;
}

/**
 * 将干扰文本融入题目
 */
export function embedDistraction(
  question: string,
  distractors: string[]
): string {
  if (distractors.length === 0) return question;

  // 随机选择一个位置嵌入干扰
  const insertType = Math.random();

  if (insertType < 0.3) {
    // 开头
    return distractors.join('，') + '，' + question;
  } else if (insertType < 0.6) {
    // 中间
    const parts = question.split(':');
    if (parts.length > 1) {
      return parts[0] + '，' + distractors[0] + '：' + parts.slice(1).join(':');
    }
    return question;
  } else {
    // 结尾
    return question + '（' + distractors.join('，') + '）';
  }
}