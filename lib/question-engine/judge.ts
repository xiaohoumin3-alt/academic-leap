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
import { StepProtocolV2 } from './protocol-v2';
import { judgeStepV2 } from './judge-v2';

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

  // 四舍五入到2位小数进行比较（与formatNumber显示精度一致）
  const roundedCorrect = Math.round(correctAnswer * 100) / 100;
  const roundedUser = Math.round(userNum * 100) / 100;

  const tol = tolerance ?? 0.001;
  const diff = Math.abs(roundedUser - roundedCorrect);

  if (diff <= tol) {
    return { isCorrect: true, errorType: null };
  }

  // 判断错误类型
  if (diff > Math.abs(roundedCorrect) * 0.5) {
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
 * 支持 v1/v2 双协议
 */
export function judgeStep(
  step: StepProtocol | StepProtocolV2,
  params: Record<string, number>,
  userInput: string,
  duration?: number
): JudgeResult {
  // v2 协议检测：检查是否有 expectedAnswer 字段
  if ('expectedAnswer' in step) {
    return judgeStepV2(step as StepProtocolV2, userInput, duration);
  }

  // v1 协议：原有逻辑保持不变
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

    // ========== 二次根式 (Chapter 16) ==========
    case StepType.COMPUTE_SQRT: {
      // params 包含 radicand（被开方数）和 answer（答案：1=有意义，0=无意义）
      const { answer } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: answer === 1 ? '1（有意义）' : '0（无意义）',
          errorType: 'format_error',
          hint: '请输入 1 表示有意义，或 0 表示无意义',
        };
      } else {
        const isCorrect = userNum === answer;
        result = {
          isCorrect,
          correctAnswer: answer === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (answer === 1 ? '该二次根式有意义' : '该二次根式无意义'),
        };
      }
      break;
    }

    case StepType.SIMPLIFY_SQRT: {
      // params 包含 radicand（原数）和 simplified（化简结果，如 5√2）
      const { radicand, simplified } = params;
      // 用户可能输入简化形式或数值形式
      const userInputTrimmed = userInput.trim().toLowerCase();

      // 尝试解析输入
      const userNum = parseFloat(userInputTrimmed);

      if (isNaN(userNum)) {
        // 可能是表达式形式如 "5√2"，暂时标记为格式问题
        result = {
          isCorrect: false,
          correctAnswer: formatSqrtExpression(simplified),
          errorType: 'format_error',
          hint: `化简结果：√${radicand} = ${formatSqrtExpression(simplified)}`,
        };
      } else {
        const correctValue = Math.sqrt(radicand);
        const compare = compareNumber(userInput, correctValue, 0.01);
        result = {
          isCorrect: compare.isCorrect,
          correctAnswer: formatSqrtExpression(simplified),
          errorType: compare.isCorrect ? null : compare.errorType,
          hint: compare.isCorrect ? undefined : `√${radicand} = ${formatSqrtExpression(simplified)} ≈ ${correctValue.toFixed(2)}`,
        };
      }
      break;
    }

    case StepType.SQRT_PROPERTY: {
      // √(a²) = |a|，params 包含 radicand 和 result
      const { radicand, result: correct } = params;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `√(${radicand}) = ${formatNumber(correct)}`,
      };
      break;
    }

    case StepType.SQRT_MIXED: {
      // 二次根式混合运算，如 √a × √b = √(ab) 或 √a / √b = √(a/b)
      const { a, b, result: correct } = params;
      // 如果 result 未提供，动态计算
      const computedCorrect = correct !== undefined ? correct : Math.sqrt(a / b);
      const compare = compareNumber(userInput, computedCorrect, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(computedCorrect),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `√${a} / √${b} = √(${a}/${b}) = ${formatNumber(computedCorrect)}`,
      };
      break;
    }

    // ========== 三角形判定 (Chapter 17) ==========
    case StepType.VERIFY_RIGHT_ANGLE: {
      // 验证三角形是否为直角三角形
      // params 包含 side1, side2, side3（三边），isRightTriangle（答案：1=是，0=否）
      const { isRightTriangle } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: isRightTriangle === 1 ? '1（是直角三角形）' : '0（不是直角三角形）',
          errorType: 'format_error',
          hint: '请输入 1 表示是，或 0 表示不是',
        };
      } else {
        const isCorrect = userNum === isRightTriangle;
        result = {
          isCorrect,
          correctAnswer: isRightTriangle === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (isRightTriangle === 1 ? '根据勾股定理逆定理判断' : '三边不满足勾股定理'),
        };
      }
      break;
    }

    // ========== 四边形判定与性质 (Chapter 18) ==========
    case StepType.VERIFY_PARALLELOGRAM: {
      // 平行四边形判定
      // params 包含 side1, side2, side3, side4, isParallelogram
      const { isParallelogram } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: isParallelogram === 1 ? '1（是）' : '0（否）',
          errorType: 'format_error',
          hint: '请输入 1 表示是平行四边形，或 0 表示不是',
        };
      } else {
        const isCorrect = userNum === isParallelogram;
        result = {
          isCorrect,
          correctAnswer: isParallelogram === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (isParallelogram === 1 ? '满足平行四边形判定条件' : '不满足平行四边形判定条件'),
        };
      }
      break;
    }

    case StepType.VERIFY_RECTANGLE: {
      // 矩形判定
      const { isRectangle } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: isRectangle === 1 ? '1（是矩形）' : '0（不是矩形）',
          errorType: 'format_error',
          hint: '请输入 1 表示是矩形，或 0 表示不是',
        };
      } else {
        const isCorrect = userNum === isRectangle;
        result = {
          isCorrect,
          correctAnswer: isRectangle === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (isRectangle === 1 ? '满足矩形判定条件' : '不满足矩形判定条件'),
        };
      }
      break;
    }

    case StepType.VERIFY_RHOMBUS: {
      // 菱形判定
      const { isRhombus } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: isRhombus === 1 ? '1（是菱形）' : '0（不是菱形）',
          errorType: 'format_error',
          hint: '请输入 1 表示是菱形，或 0 表示不是',
        };
      } else {
        const isCorrect = userNum === isRhombus;
        result = {
          isCorrect,
          correctAnswer: isRhombus === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (isRhombus === 1 ? '满足菱形判定条件' : '不满足菱形判定条件'),
        };
      }
      break;
    }

    case StepType.VERIFY_SQUARE: {
      // 正方形判定
      const { isSquare } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: isSquare === 1 ? '1（是正方形）' : '0（不是正方形）',
          errorType: 'format_error',
          hint: '请输入 1 表示是正方形，或 0 表示不是',
        };
      } else {
        const isCorrect = userNum === isSquare;
        result = {
          isCorrect,
          correctAnswer: isSquare === 1 ? '1' : '0',
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : (isSquare === 1 ? '满足正方形判定条件' : '不满足正方形判定条件'),
        };
      }
      break;
    }

    case StepType.COMPUTE_RECT_PROPERTY: {
      // 矩形性质计算（对角线、周长、面积等）
      const { result: correct } = params;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `计算矩形性质`,
      };
      break;
    }

    case StepType.COMPUTE_RHOMBUS_PROPERTY: {
      // 菱形性质计算
      const { result: correct } = params;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `计算菱形性质`,
      };
      break;
    }

    case StepType.COMPUTE_SQUARE_PROPERTY: {
      // 正方形性质计算
      const { result: correct } = params;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `计算正方形性质`,
      };
      break;
    }

    // ========== 一元二次方程 (Chapter 19) ==========
    case StepType.IDENTIFY_QUADRATIC: {
      // 识别一元二次方程的系数
      // params 包含 a, b, c 和 answer
      const { answer } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: answer.toString(),
          errorType: 'format_error',
          hint: '请输入系数值',
        };
      } else {
        const isCorrect = userNum === answer;
        result = {
          isCorrect,
          correctAnswer: answer.toString(),
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : `系数应为 ${answer}`,
        };
      }
      break;
    }

    case StepType.SOLVE_DIRECT_ROOT: {
      // 直接开平方法
      // params 包含 x（解）
      const { x } = params;
      const compare = compareNumber(userInput, x, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(x),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `x = ±√${x * x} = ${formatNumber(x)}`,
      };
      break;
    }

    case StepType.SOLVE_COMPLETE_SQUARE: {
      // 配方法
      // params 包含 result（配方程结果）
      const { result: correct } = params;
      const compare = compareNumber(userInput, correct, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(correct),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `配方法求解`,
      };
      break;
    }

    case StepType.SOLVE_QUADRATIC_FORMULA: {
      // 公式法
      // params 包含 x1, x2（两个解）或 x（唯一解）
      const { x1, x2 } = params;
      const userInputTrimmed = userInput.trim().toLowerCase();

      // 尝试解析为坐标形式
      const coordMatch = userInputTrimmed.match(/^\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*]\s*$/);
      if (coordMatch) {
        const userX1 = parseFloat(coordMatch[1]);
        const userX2 = parseFloat(coordMatch[2]);
        // 检查是否与正确答案匹配（顺序无关）
        const isCorrect =
          (Math.abs(userX1 - x1) < 0.01 && Math.abs(userX2 - x2) < 0.01) ||
          (Math.abs(userX1 - x2) < 0.01 && Math.abs(userX2 - x1) < 0.01);
        result = {
          isCorrect,
          correctAnswer: `[${formatNumber(x1)}, ${formatNumber(x2)}]`,
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : `x₁=${formatNumber(x1)}, x₂=${formatNumber(x2)}`,
        };
      } else {
        // 尝试解析为单一数值
        const userNum = parseFloat(userInputTrimmed);
        if (isNaN(userNum)) {
          result = {
            isCorrect: false,
            correctAnswer: `[${formatNumber(x1)}, ${formatNumber(x2)}]`,
            errorType: 'format_error',
            hint: `请输入解集，格式如 [x1, x2] 或 [${formatNumber(x1)}, ${formatNumber(x2)}]`,
          };
        } else {
          // 检查是否匹配任一解
          const isCorrect = Math.abs(userNum - x1) < 0.01 || Math.abs(userNum - x2) < 0.01;
          result = {
            isCorrect,
            correctAnswer: Math.abs(x1 - x2) < 0.01 ? formatNumber(x1) : `[${formatNumber(x1)}, ${formatNumber(x2)}]`,
            errorType: isCorrect ? null : 'concept_error',
            hint: isCorrect ? undefined : `x₁=${formatNumber(x1)}, x₂=${formatNumber(x2)}`,
          };
        }
      }
      break;
    }

    case StepType.SOLVE_FACTORIZE: {
      // 因式分解法
      // params 包含 factors（如 "x1*x2"）
      const { result: correct } = params;
      result = {
        isCorrect: userInput.trim() === correct.toString(),
        correctAnswer: correct.toString(),
        errorType: userInput.trim() === correct.toString() ? null : 'concept_error',
        hint: userInput.trim() === correct.toString() ? undefined : `因式分解结果应为 ${correct}`,
      };
      break;
    }

    case StepType.QUADRATIC_APPLICATION: {
      // 一元二次方程应用题
      // params 包含 answer
      const { answer } = params;
      const compare = compareNumber(userInput, answer, step.tolerance ?? 0.01);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(answer),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `应用题答案`,
      };
      break;
    }

    // ========== 数据分析 (Chapter 20) ==========
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

    case StepType.COMPUTE_MEDIAN: {
      const { median } = params;
      const compare = compareNumber(userInput, median, step.tolerance);
      result = {
        isCorrect: compare.isCorrect,
        correctAnswer: formatNumber(median),
        errorType: compare.isCorrect ? null : compare.errorType,
        hint: compare.isCorrect ? undefined : `中位数 = ${formatNumber(median)}`,
      };
      break;
    }

    case StepType.COMPUTE_MODE: {
      const { mode } = params;
      const userNum = parseFloat(userInput.trim());

      if (isNaN(userNum)) {
        result = {
          isCorrect: false,
          correctAnswer: formatNumber(mode),
          errorType: 'format_error',
          hint: `众数 = ${formatNumber(mode)}`,
        };
      } else {
        const isCorrect = Math.abs(userNum - mode) < 0.01;
        result = {
          isCorrect,
          correctAnswer: formatNumber(mode),
          errorType: isCorrect ? null : 'concept_error',
          hint: isCorrect ? undefined : `众数 = ${formatNumber(mode)}`,
        };
      }
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
        hint: '未知的步骤类型，请联系管理员添加判题逻辑',
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
 * 格式化二次根式表达式
 */
function formatSqrtExpression(simplified: number): string {
  // 如果是完全平方数，返回整数
  const sqrt = Math.sqrt(simplified);
  if (Number.isInteger(sqrt)) {
    return sqrt.toString();
  }
  // 否则返回化简形式（如 5√2 表示为 5*√2）
  // 这里简化处理，实际可能需要更复杂的化简逻辑
  return `√${simplified}`;
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
