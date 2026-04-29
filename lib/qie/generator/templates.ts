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
    template: '解方程: {a}x {b:+d} = {c}x {e:+f}',
    answer: 'x = {x}',
    params: {
      a: '1..10',
      b: '-10..10',
      c: '1..10',
      e: '-10..10',
      f: '-20..20',
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

export function evaluateConstraint(
  constraint: string,
  params: Record<string, number>
): boolean {
  if (!constraint) return true;
  if (constraint === 'a != 0') {
    return params.a !== 0;
  }
  if (constraint === 'a != c') {
    return params.a !== params.c;
  }
  return true;
}

export function fillTemplate(
  template: string,
  params: Record<string, number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}
