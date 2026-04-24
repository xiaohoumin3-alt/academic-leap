/**
 * 学期相关工具函数
 */

export interface SemesterDates {
  start: Date;
  end: Date;
}

export interface ProgressInfo {
  progress: number;      // 0-100
  message?: string;      // 状态消息
  isValid: boolean;      // 学期是否有效
}

/**
 * 根据当前月份推断默认学期
 */
export function inferDefaultSemester(): SemesterDates {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // 3-7月：春季学期
  if (month >= 3 && month <= 7) {
    return {
      start: new Date(year, 2, 1),     // 3月1日
      end: new Date(year, 6, 15),      // 7月15日
    };
  }

  // 9-1月：秋季学期
  if (month >= 9 || month <= 1) {
    const endYear = month <= 1 ? year : year + 1;
    return {
      start: new Date(year, 8, 1),     // 9月1日
      end: new Date(endYear, 0, 20),   // 1月20日
    };
  }

  // 其他月份（2月或8月），默认使用秋季学期
  return {
    start: new Date(year, 8, 1),       // 9月1日
    end: new Date(year + 1, 0, 20),    // 次年1月20日
  };
}

/**
 * 计算学习进度
 */
export function calculateProgress(semesterStart?: Date, semesterEnd?: Date): ProgressInfo {
  const now = new Date();

  // 未设置学期
  if (!semesterStart || !semesterEnd) {
    return {
      progress: 0,
      message: '请设置学期时间',
      isValid: false
    };
  }

  const start = new Date(semesterStart);
  const end = new Date(semesterEnd);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  now.setHours(12, 0, 0, 0);

  // 学期未开始
  if (now < start) {
    return {
      progress: 0,
      message: '学期未开始',
      isValid: true
    };
  }

  // 学期已结束
  if (now > end) {
    return {
      progress: 100,
      message: '学期已结束',
      isValid: true
    };
  }

  // 计算进度
  const totalDuration = end.getTime() - start.getTime();
  const elapsedDuration = now.getTime() - start.getTime();
  const progress = Math.round((elapsedDuration / totalDuration) * 100);

  return {
    progress: Math.max(0, Math.min(100, progress)),
    isValid: true
  };
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析日期输入
 */
export function parseDateInput(input: string): Date | null {
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
