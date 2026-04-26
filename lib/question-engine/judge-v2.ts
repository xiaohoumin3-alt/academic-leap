/**
 * 判题引擎 v2
 *
 * 基于 protocol-v2 的类型安全判题实现
 * 支持所有 ExpectedAnswer 类型的判题
 */

import { StepProtocolV2, ExpectedAnswer } from './protocol-v2';
import { JudgeResult, ErrorType } from './types/judge';
import { ErrorType as ProtocolErrorType } from './protocol';

/**
 * 扩展的判题结果（包含 behaviorTag）
 * 与 v1 判题结果格式兼容
 */
interface ExtendedJudgeResult {
  isCorrect: boolean;
  correctAnswer: string;
  errorType: ProtocolErrorType | null;
  behaviorTag: string;
  hint?: string;
}

/**
 * 通用判题引擎 v2
 */
export function judgeStepV2(
  step: StepProtocolV2,
  userInput: string,
  duration?: number
): ExtendedJudgeResult {
  const { expectedAnswer } = step;

  // 检测猜测（响应时间过快）
  const isGuess = duration !== undefined && duration < 1000;

  let baseResult: { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string };

  switch (expectedAnswer.type) {
    case 'number':
      baseResult = judgeNumber(userInput, expectedAnswer);
      break;
    case 'string':
      baseResult = judgeString(userInput, expectedAnswer);
      break;
    case 'coordinate':
      baseResult = judgeCoordinate(userInput, expectedAnswer);
      break;
    case 'yes_no':
      baseResult = judgeYesNo(userInput, expectedAnswer);
      break;
    case 'choice':
      baseResult = judgeChoice(userInput, expectedAnswer);
      break;
    case 'expression':
      baseResult = judgeExpression(userInput, expectedAnswer);
      break;
    case 'multi_fill':
      baseResult = judgeMultiFill(userInput, expectedAnswer);
      break;
    case 'order':
      baseResult = judgeOrder(userInput, expectedAnswer);
      break;
    case 'match':
      baseResult = judgeMatch(userInput, expectedAnswer);
      break;
    default:
      baseResult = {
        isCorrect: false,
        correctAnswer: '未知题型',
        errorType: 'system_error',
        hint: '题目配置错误，请联系管理员',
      };
  }

  // 添加 behaviorTag，映射错误类型到 v1 协议
  let behaviorTag = '未分类';
  let finalErrorType: ProtocolErrorType | null = null;

  if (baseResult.isCorrect) {
    behaviorTag = isGuess ? '正确（可能猜测）' : '正确';
  } else {
    if (isGuess) {
      behaviorTag = '猜测';
      finalErrorType = 'guess';
    } else if (baseResult.errorType === 'system_error') {
      behaviorTag = '系统错误';
      finalErrorType = 'system_error';
    } else if (baseResult.errorType === 'calculation_error') {
      behaviorTag = '计算错误';
      finalErrorType = 'calculation_error';
    } else if (baseResult.errorType === 'concept_error') {
      behaviorTag = '概念错误';
      finalErrorType = 'concept_error';
    } else if (baseResult.errorType === 'format_error') {
      behaviorTag = '格式错误';
      finalErrorType = 'format_error';
    } else {
      behaviorTag = '错误';
      finalErrorType = 'concept_error'; // 默认为概念错误
    }
  }

  return {
    isCorrect: baseResult.isCorrect,
    correctAnswer: baseResult.correctAnswer,
    errorType: finalErrorType,
    behaviorTag,
    hint: baseResult.hint,
  };
}

/**
 * 数值判题函数
 */
function judgeNumber(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'number' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 字符串判题函数
 */
function judgeString(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'string' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 判断题判题函数
 */
function judgeYesNo(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'yes_no' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 选择题判题函数
 */
function judgeChoice(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'choice' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 坐标判题函数
 */
function judgeCoordinate(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'coordinate' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
  // 支持多种格式：(x, y)、[x, y]、x y
  const match = userInput.trim().match(/^[\[\(]?\s*([-\d.]+)\s*[,，]\s*([-\d.]+)\s*[\]\)]?$/);

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

/**
 * 表达式判题函数
 */
function judgeExpression(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'expression' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 多空填空判题函数
 */
function judgeMultiFill(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'multi_fill' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 排序判题函数
 */
function judgeOrder(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'order' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
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

/**
 * 匹配判题函数
 */
function judgeMatch(
  userInput: string,
  expected: Extract<ExpectedAnswer, { type: 'match' }>
): { isCorrect: boolean; correctAnswer: string; errorType: ErrorType | null; hint?: string } {
  // 支持多种格式：
  // "A1,B2,C3" - 紧凑格式（字母后跟数字）
  // "A:1,B:2,C:3" - 冒号分隔
  // "A→1,B→2,C→3" - 箭头分隔
  const pairs = userInput.split(/[,，]/).filter(v => v.trim());

  const userMatches: Record<string, string> = {};
  for (const pair of pairs) {
    // 先尝试按分隔符分割
    let parts = pair.split(/[:：→]/);
    if (parts.length === 2) {
      const [key, value] = parts;
      if (key && value) {
        userMatches[key.trim().toLowerCase()] = value.trim().toLowerCase();
      }
    } else {
      // 紧凑格式：提取字母和数字
      const match = pair.trim().match(/^([a-zA-Z]+)\s*(\d+|[a-zA-Z]+)$/);
      if (match) {
        userMatches[match[1].toLowerCase()] = match[2].toLowerCase();
      }
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
