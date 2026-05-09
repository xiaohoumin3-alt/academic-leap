/**
 * 测评相关工具函数
 */

/**
 * 根据年级获取难度范围
 */
export function getGradeDifficultyRange(grade: number) {
  if (grade <= 3) return { min: 1, max: 2 };
  if (grade <= 6) return { min: 1, max: 3 };
  if (grade <= 9) return { min: 2, max: 4 };
  return { min: 3, max: 5 };
}

/**
 * 根据年级和目标分数获取测评起始难度
 */
export function getAssessmentStartLevel(grade: number, targetScore: number) {
  if (grade <= 3) return 1;
  if (grade <= 6) return 2;
  if (grade <= 9) return 3;
  if (grade >= 10 && targetScore >= 90) return 4;
  if (grade >= 10 && targetScore >= 80) return 3;
  return 2;
}
