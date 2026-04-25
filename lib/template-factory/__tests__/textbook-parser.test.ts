import { describe, test, expect } from '@jest/globals';
import { parseTextbook } from '../parsers/textbook-parser';

describe('TextbookParser', () => {
  test('parses valid textbook yaml', () => {
    const yaml = `
textbook:
  grade: 8
  subject: 数学
  name: 人教版八年级下册

chapters:
  - number: 16
    name: 二次根式
    knowledgePoints:
      - name: 二次根式的定义
        weight: 3
      - name: 二次根式的乘法法则
        weight: 5
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.chapters).toHaveLength(1);
    expect(result.data?.chapters[0].knowledgePoints).toHaveLength(2);
  });

  test('returns errors for invalid yaml', () => {
    const yaml = `
textbook:
  grade: invalid
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test('validates required fields', () => {
    const yaml = `
chapters:
  - number: 16
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === 'textbook.name')).toBe(true);
  });

  test('handles missing chapter names with defaults', () => {
    const yaml = `
textbook:
  grade: 7
  subject: 数学
  name: 人教版七年级上册

chapters:
  - number: 1
  - number: 2
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.chapters[0].name).toBe('章节1');
    expect(result.data?.chapters[1].name).toBe('章节2');
  });

  test('handles missing knowledge point names with defaults', () => {
    const yaml = `
textbook:
  grade: 9
  subject: 数学
  name: 人教版九年级

chapters:
  - number: 1
    name: 一元二次方程
    knowledgePoints:
      - weight: 3
`;

    const result = parseTextbook(yaml);

    expect(result.success).toBe(true);
    expect(result.data?.chapters[0].knowledgePoints[0].name).toBe('未命名知识点');
    expect(result.data?.chapters[0].knowledgePoints[0].weight).toBe(3);
  });
});