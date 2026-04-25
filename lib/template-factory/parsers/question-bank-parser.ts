/**
 * 题库解析器
 * 解析YAML格式的题库内容，提取题目样本
 */

import yaml from 'yaml';
import type { ParseResult, QuestionSample, StepTypeKey } from '../types';

// 有效的StepType列表
const VALID_STEP_TYPES: StepTypeKey[] = [
  'COMPUTE_SQRT', 'SIMPLIFY_SQRT', 'SQRT_MIXED',
  'VERIFY_RIGHT_ANGLE', 'VERIFY_PARALLELOGRAM', 'VERIFY_RECTANGLE',
  'VERIFY_RHOMBUS', 'VERIFY_SQUARE', 'COMPUTE_RECT_PROPERTY',
  'COMPUTE_RHOMBUS_PROPERTY', 'COMPUTE_SQUARE_PROPERTY',
  'IDENTIFY_QUADRATIC', 'SOLVE_DIRECT_ROOT', 'SOLVE_COMPLETE_SQUARE',
  'SOLVE_QUADRATIC_FORMULA', 'SOLVE_FACTORIZE', 'QUADRATIC_APPLICATION',
  'COMPUTE_MEAN', 'COMPUTE_MEDIAN', 'COMPUTE_MODE',
  'COMPUTE_VARIANCE', 'COMPUTE_STDDEV'
];

interface QuestionBankYaml {
  questions?: Array<{
    content?: string;
    difficulty?: number;
    answer?: string;
    stepType?: string;
    knowledgePoint?: string;
  }>;
}

export function parseQuestionBank(yamlContent: string): ParseResult<{
  questions: QuestionSample[];
}> {
  const errors: Array<{ field: string; message: string }> = [];

  let parsed: QuestionBankYaml;
  try {
    parsed = yaml.parse(yamlContent);
  } catch (e) {
    return {
      success: false,
      errors: [{ field: 'content', message: 'YAML解析失败' }]
    };
  }

  if (!parsed.questions || parsed.questions.length === 0) {
    return {
      success: false,
      errors: [{ field: 'questions', message: '题目列表不能为空' }]
    };
  }

  const questions: QuestionSample[] = [];

  parsed.questions.forEach((q, idx) => {
    // 验证stepType
    if (!q.stepType) {
      errors.push({ field: `questions[${idx}].stepType`, message: 'stepType必填' });
    } else if (!VALID_STEP_TYPES.includes(q.stepType as StepTypeKey)) {
      errors.push({
        field: `questions[${idx}].stepType`,
        message: `无效的stepType: ${q.stepType}`
      });
    }

    // 验证difficulty
    if (q.difficulty !== undefined && (q.difficulty < 1 || q.difficulty > 5)) {
      errors.push({
        field: `questions[${idx}].difficulty`,
        message: 'difficulty必须在1-5之间'
      });
    }

    if (q.content && q.answer && q.stepType && q.knowledgePoint) {
      questions.push({
        content: q.content,
        difficulty: q.difficulty ?? 1,
        answer: q.answer,
        stepType: q.stepType as StepTypeKey,
        knowledgePoint: q.knowledgePoint
      });
    }
  });

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { questions } };
}