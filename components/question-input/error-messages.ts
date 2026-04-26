import { ErrorType } from '@/lib/question-engine/types/judge';

export type ErrorHintBuilder = (correctAnswer: string) => string;

export const ERROR_HINTS: Record<ErrorType, string | ErrorHintBuilder> = {
  format_error: '输入格式不正确，请检查',
  calculation_error: (correctAnswer: string) => `正确答案是：${correctAnswer}`,
  concept_error: '再仔细想想题目条件',
  system_error: '题目配置错误，请联系管理员',
};

/**
 * 获取错误提示
 */
export function getErrorHint(
  errorType: ErrorType | null,
  correctAnswer: string
): string | undefined {
  if (!errorType) return undefined;

  const hint = ERROR_HINTS[errorType];
  return typeof hint === 'function' ? hint(correctAnswer) : hint;
}
