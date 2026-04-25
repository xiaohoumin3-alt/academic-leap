/**
 * 教材解析器
 * 解析YAML格式的教材内容，提取章节结构和知识点
 */

import yaml from 'yaml';
import type { ParseResult, TextbookChapter } from '../types';

interface TextbookYaml {
  textbook?: {
    grade?: number;
    subject?: string;
    name?: string;
    year?: string;
  };
  chapters?: Array<{
    number?: number;
    name?: string;
    knowledgePoints?: Array<{ name?: string; weight?: number }>;
  }>;
}

export function parseTextbook(
  yamlContent: string
): ParseResult<{
  textbook: {
    grade: number;
    subject: string;
    name: string;
    year?: string;
  };
  chapters: TextbookChapter[];
}> {
  const errors: Array<{ field: string; message: string }> = [];

  let parsed: TextbookYaml;
  try {
    parsed = yaml.parse(yamlContent);
  } catch (e) {
    return {
      success: false,
      errors: [{ field: 'content', message: 'YAML解析失败' }]
    };
  }

  // 验证必填字段
  if (!parsed.textbook?.name) {
    errors.push({ field: 'textbook.name', message: '教材名称必填' });
  }
  if (!parsed.textbook?.grade) {
    errors.push({ field: 'textbook.grade', message: '年级必填' });
  }
  if (!parsed.textbook?.subject) {
    errors.push({ field: 'textbook.subject', message: '学科必填' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const chapters: TextbookChapter[] = (parsed.chapters || []).map((ch, idx) => ({
    number: ch.number ?? idx + 1,
    name: ch.name ?? `章节${idx + 1}`,
    knowledgePoints: (ch.knowledgePoints || []).map((kp) => ({
      name: kp.name ?? '未命名知识点',
      weight: kp.weight ?? 3
    }))
  }));

  return {
    success: true,
    data: {
      textbook: {
        grade: parsed.textbook!.grade!,
        subject: parsed.textbook!.subject!,
        name: parsed.textbook!.name!,
        year: parsed.textbook?.year
      },
      chapters
    }
  };
}