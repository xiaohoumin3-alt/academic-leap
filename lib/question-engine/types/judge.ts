/**
 * 错误类型（用于判题结果和前端提示）
 */
export type ErrorType =
  | 'format_error'      // 格式错误（如坐标格式不对）
  | 'calculation_error' // 计算错误（数值不对）
  | 'concept_error'     // 概念错误（判断/选择错误）
  | 'system_error'      // 系统错误（未知题型/配置错误）

/**
 * 判题结果
 */
export interface JudgeResult {
  isCorrect: boolean;           // 是否正确
  correctAnswer: string;        // 正确答案（用户可读格式）
  errorType: ErrorType | null;  // 错误类型（正确时为 null）
  hint?: string;                // 提示信息
}
