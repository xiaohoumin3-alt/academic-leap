/**
 * 判题引擎（Judge Engine）
 * 100%确定性的裁判系统
 * 只看：step.type + params + 用户输入
 * 不看：题目文本 + AI输出
 */

import {
  StepProtocol,
  StepType,
  JudgeResult,
  ErrorType,
  Coordinate,
} from './protocol';
import { formatNumber } from './difficulty';

/**
 * 解析坐标输入
 */
function parseCoordinate(input: string): Coordinate | null {
  // 匹配 (x, y) 或 (x,y) 格式
  const match = input.trim().match(/^\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)\s*$/);
  if (!match) {
    return null;
  }
  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
  };
}

/**
 * 比较数值
 */
function compareNumber(
  userAnswer: string,
  correctAnswer: number,
  tolerance?: number
): { isCorrect: boolean; errorType: ErrorType | null } {
  const userNum = parseFloat(userAnswer.trim());

  if (isNaN(userNum)) {
    return { isCorrect: false, errorType: 'format_error' };
  }

  const tol = tolerance ?? 0.001;
  const diff = Math.abs(userNum - correctAnswer);

  if (diff <= tol) {
    return { isCorrect: true, errorType: null };
  }

  // 判断错误类型
  if (diff > Math.abs(correctAnswer) * 0.5) {
    // 差距太大，可能是概念错误
    return { isCorrect: false, errorType: 'concept_error' };
  }

  return { isCorrect: false, errorType: 'calculation_error' };
}

/**
 * 比较坐标
 */
function compareCoordinate(
  userAnswer: string,
  correctX: number,
  correctY: number
): { isCorrect: boolean; errorType: ErrorType | null; correctAnswer: string } {
  const user = parseCoordinate(userAnswer);

  if (!user) {
    return {
      isCorrect: false,
      errorType: 'format_error',
      correctAnswer: `(${formatNumber(correctX)}, ${formatNumber(correctY)})`,
    };
  }

  const xCorrect = Math.abs(user.x - correctX) < 0.01;
  const yCorrect = Math.abs(user.y - correctY) < 0.01;

  if (xCorrect && yCorrect) {
    return {
      isCorrect: true,
      errorType: null,
      correctAnswer: `(${formatNumber(correctX)}, ${formatNumber(correctY)})`,
    };
  }

  // 判断错误类型
  if (!xCorrect && !yCorrect) {
    return {
      isCorrect: false,
      errorType: 'concept_error',
      correctAnswer: `(${formatNumber(correctX)}, ${formatNumber(correctY)})`,
    };
  }

  return {
    isCorrect: false,
    errorType: 'calculation_error',
    correctAnswer: `(${formatNumber(correctX)}, ${formatNumber(correctY)})`,
  };
}

/**
 * 判题核心函数
 */
export function judgeStep(
  step: StepProtocol,
  params: Record<string, number>,
  userInput: string,
  duration?: number
): JudgeResult {
  // 检测猜测（响应时间过快）
  const isGuess = duration !== undefined && duration < 1000; // 1秒内可能是在猜测

  let result: Omit<JudgeResult, 'behaviorTag'>;

  switch (step.type) {
    // ========== 二次函数 ==========
    case StepType.COMPUTE_VERTEX_X: {
      const { a, b } = params;
      const correct = -b / (2 * a);
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `使用公式 x = -b/(2a) = ${-b}/(2×${a})`,
      };
      break;
    }

    case StepType.COMPUTE_VERTEX_Y: {
      const { a, b, c } = params;
      const correct = (4 * a * c - b * b) / (4 * a);
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `使用公式 y = (4ac-b²)/(4a)`,
      };
      break;
    }

    case StepType.FINAL_COORDINATE: {
      const { a, b, c } = params;
      const x = -b / (2 * a);
      const y = (4 * a * c - b * b) / (4 * a);
      const compare = compareCoordinate(userInput, x, y);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: compare.correctAnswer,
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `顶点坐标是 (${formatNumber(x)}, ${formatNumber(y)})`,
      };
      break;
    }

    case StepType.COMPUTE_VALUE: {
      const { a, b, c, x } = params;
      const correct = a * x * x + b * x + c;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `y = ${a}×${x}² ${b >= 0 ? '+' : ''}${b}×${x} ${c >= 0 ? '+' : ''}${c}`,
      };
      break;
    }

    // ========== 勾股定理 ==========
    case StepType.PYTHAGOREAN_C_SQUARE: {
      const { a, b } = params;
      const correct = a * a + b * b;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: correct.toString(),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `c² = ${a}² + ${b}² = ${a * a} + ${b * b}`,
      };
      break;
    }

    case StepType.PYTHAGOREAN_C: {
      const { a, b } = params;
      const correct = Math.sqrt(a * a + b * b);
      const compare = compareNumber(userInput, correct, 0.01);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: correct.toFixed(2),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `c = √${a * a + b * b} ≈ ${correct.toFixed(2)}`,
      };
      break;
    }

    // ========== 一元一次方程 ==========
    case StepType.SOLVE_LINEAR_EQUATION: {
      const { a, b, c } = params;
      const correct = (c - b) / a;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: correct.toString(),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `${a}x = ${c - b}, x = ${(c - b) / a}`,
      };
      break;
    }

    // ========== 概率统计 ==========
    case StepType.COMPUTE_PROBABILITY: {
      const { total, favorable } = params;
      const correct = favorable / total;
      const compare = compareNumber(userInput, correct, 0.01);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: correct.toFixed(2),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `概率 = ${favorable}/${total} = ${correct.toFixed(2)}`,
      };
      break;
    }

    // ========== 数据分析（第20章）==========
    case StepType.COMPUTE_MEAN: {
      const { mean } = params;
      const compare = compareNumber(userInput, mean, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(mean),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `平均数 = ${formatNumber(mean)}`,
      };
      break;
    }

    case StepType.COMPUTE_VARIANCE: {
      const { variance } = params;
      const compare = compareNumber(userInput, variance, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(variance),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `方差 = ${formatNumber(variance)}`,
      };
      break;
    }

    case StepType.COMPUTE_STDDEV: {
      const { stddev } = params;
      const compare = compareNumber(userInput, stddev, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(stddev),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `标准差 = √方差 = ${formatNumber(stddev)}`,
      };
      break;
    }

    default:
      result = {
        isCorrect: false,
        correctAnswer: '未知',
        errorType: 'concept_error',
        hint: '未知的步骤类型',
      };
  }

  // 处理猜测检测
  let behaviorTag = '未分类';
  if (result.isCorrect) {
    behaviorTag = isGuess ? '正确（可能猜测）' : '正确';
  } else {
    if (isGuess) {
      behaviorTag = '猜测';
      result.errorType = 'guess';
    } else if (result.errorType === 'calculation_error') {
      behaviorTag = '计算错误';
    } else if (result.errorType === 'concept_error') {
      behaviorTag = '概念错误';
    } else if (result.errorType === 'format_error') {
      behaviorTag = '格式错误';
    } else {
      behaviorTag = '错误';
    }
  }

  return {
    ...result,
    behaviorTag,
  };
}

/**
 * 批量判题（用于练习完成后的统计）
 */
export function judgeSteps(
  steps: StepProtocol[],
  params: Record<string, number>,
  userAnswers: Array<{ input: string; duration?: number }>
): Array<JudgeResult & { stepId: string }> {
  return steps.map((step, index) => {
    const result = judgeStep(step, params, userAnswers[index].input, userAnswers[index].duration);
    return {
      stepId: step.stepId,
      ...result,
    };
  });
}
