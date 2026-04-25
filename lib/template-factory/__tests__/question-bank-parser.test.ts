import { describe, test, expect } from '@jest/globals';
import { parseQuestionBank } from '../parsers/question-bank-parser';
import type { ParseResult, QuestionSample } from '../types';

describe('QuestionBankParser', () => {
  test('parses valid question bank yaml', () => {
    const yaml = `
questions:
  - content: "求√144的值"
    difficulty: 1
    answer: 12
    stepType: COMPUTE_SQRT
    knowledgePoint: "二次根式的定义"
  - content: "化简√50"
    difficulty: 3
    answer: "5√2"
    stepType: SIMPLIFY_SQRT
    knowledgePoint: "最简二次根式"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.questions).toHaveLength(2);
    expect(result.data?.questions[0].stepType).toBe('COMPUTE_SQRT');
  });

  test('validates stepType is valid enum', () => {
    const yaml = `
questions:
  - content: "测试"
    difficulty: 1
    answer: "1"
    stepType: INVALID_TYPE
    knowledgePoint: "测试"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field.includes('stepType'))).toBe(true);
  });

  test('returns error when questions array is empty', () => {
    const yaml = `
questions: []
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.[0].field).toBe('questions');
  });

  test('returns error when yaml is invalid', () => {
    const yaml = `
this is not valid yaml: [
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.[0].message).toBe('YAML解析失败');
  });

  test('returns error when stepType is missing', () => {
    const yaml = `
questions:
  - content: "测试"
    difficulty: 1
    answer: "1"
    knowledgePoint: "测试"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field.includes('stepType'))).toBe(true);
  });

  test('returns error when difficulty is out of range', () => {
    const yaml = `
questions:
  - content: "测试"
    difficulty: 0
    answer: "1"
    stepType: COMPUTE_SQRT
    knowledgePoint: "测试"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field.includes('difficulty'))).toBe(true);
  });

  test('uses default difficulty when not provided', () => {
    const yaml = `
questions:
  - content: "测试"
    answer: "1"
    stepType: COMPUTE_SQRT
    knowledgePoint: "测试"
`;

    const result = parseQuestionBank(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.questions[0].difficulty).toBe(1);
  });
});