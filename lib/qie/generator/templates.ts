import { QuestionTemplate } from './types';

export const TEMPLATES: Map<string, QuestionTemplate> = new Map([
  // linear + depth 1
  ['linear_1_0', {
    template: '解方程: {a}x {b:+d} = {c}',
    answer: 'x = {x}',
    params: {
      a: '1..10',
      b: '-10..10',
      c: '-20..20',
    },
    constraint: 'a != 0',
  }],

  ['linear_1_1', {
    template: '已知 x 是一个实数，解方程: {a}x {b:+d} = {c}',
    answer: 'x = {x}',
    params: {
      a: '1..10',
      b: '-10..10',
      c: '-20..20',
    },
    constraint: 'a != 0',
  }],

  // linear + depth 2
  ['linear_2_0', {
    template: '解方程: {a}x {b:+d} = {c}x {d:+d}',
    answer: 'x = {x}',
    params: {
      a: '1..10',
      b: '-10..10',
      c: '1..10',
      d: '-10..10',
    },
    constraint: 'a != c',
  }],

  // nested + depth 2
  ['nested_2_0', {
    template: '解方程: {a}(x {b:+d}) = {c}',
    answer: 'x = {x}',
    hint: '先展开括号',
    params: {
      a: '2..5',
      b: '-5..5',
      c: '10..30',
    },
    constraint: 'a != 0',
  }],
]);

export function getTemplate(spec: {
  structure: string;
  depth: number;
  distraction: number;
}): QuestionTemplate | null {
  const key = `${spec.structure}_${spec.depth}_${spec.distraction}`;
  return TEMPLATES.get(key) || null;
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

export function sampleParams(
  template: QuestionTemplate
): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [key, range] of Object.entries(template.params)) {
    params[key] = sampleFromRange(range);
  }
  return params;
}

export function sampleWithConstraint(
  template: QuestionTemplate,
  maxRetries: number = 10
): Record<string, number> | null {
  for (let i = 0; i < maxRetries; i++) {
    const params = sampleParams(template);
    if (evaluateConstraint(template.constraint || '', params)) {
      return params;
    }
  }
  return null;
}

/**
 * Evaluate constraint expressions.
 * Supports: param != param, param != number, param == number, param > number, param < number
 */
export function evaluateConstraint(
  constraint: string,
  params: Record<string, number>
): boolean {
  if (!constraint) return true;

  // Parse simple binary expressions: left op right
  // Supported ops: !=, ==, >, <, >=, <=
  const match = constraint.match(/^(\w+)\s*(!=|==|>|<|>=|<=)\s*(\w+|-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid constraint: ${constraint}`);
  }

  const [, left, op, right] = match;
  const leftValue = params[left];
  if (leftValue === undefined) {
    throw new Error(`Unknown param in constraint: ${left}`);
  }

  const rightValue = /^\d+$/.test(right) || /^-?\d+$/.test(right)
    ? parseInt(right, 10)
    : params[right];

  if (rightValue === undefined) {
    throw new Error(`Unknown param in constraint: ${right}`);
  }

  switch (op) {
    case '!=':
      return leftValue !== rightValue;
    case '==':
      return leftValue === rightValue;
    case '>':
      return leftValue > rightValue;
    case '<':
      return leftValue < rightValue;
    case '>=':
      return leftValue >= rightValue;
    case '<=':
      return leftValue <= rightValue;
    default:
      throw new Error(`Unsupported operator: ${op}`);
  }
}

/**
 * Format specifier: {key:format} where format is like '+d' (signed decimal) or '+f' (signed float)
 * Examples: {b:+d} → "+5" or "-3", {c} → "5"
 */
export function fillTemplate(
  template: string,
  params: Record<string, number>
): string {
  // Match {key} or {key:format}
  const regex = /\{(\w+)(?::([^}]+))?\}/g;

  return template.replace(regex, (_, key, format) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing param: ${key}`);
    }

    if (!format) {
      return String(value);
    }

    // Handle format specifiers: '+d' for signed integer, '+f' for signed float
    if (format === '+d') {
      return value >= 0 ? `+${value}` : String(value);
    }
    if (format === '+f') {
      return value >= 0 ? `+${value}` : String(value);
    }

    return String(value);
  });
}
