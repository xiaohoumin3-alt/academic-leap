/**
 * 健康指标 - 用于监控系统状态
 */
export interface HealthMetrics {
  // 核心KPI (来自 PRODUCT.md)
  /** Learning Effectiveness - 学生能力提升幅度 */
  le: number;
  /** Convergence Stability - 推荐稳定性 */
  cs: number;
  /** Data Flow Integrity - 数据链完整度 */
  dfi: number;

  // 异常检测指标
  /** 标签噪声率 - 答案与能力估计不一致的比例 */
  labelNoiseRate: number;
  /** 反馈延迟步数 - pending reward队列长度 */
  feedbackDelaySteps: number;
  /** Reward丢失率 */
  rewardLossRate: number;

  // 伪收敛检测
  /** 是否处于伪收敛状态 */
  isPseudoConverged: boolean;
  /** 伪收敛原因 */
  pseudoConvergenceReason?: string;
}

/**
 * 健康状态等级
 */
export type HealthLevel = 'healthy' | 'warning' | 'danger' | 'collapsed';

/**
 * 系统健康状态
 */
export interface HealthStatus {
  /** 健康等级 */
  level: HealthLevel;
  /** 当前指标 */
  metrics: HealthMetrics;
  /** 告警信息 */
  alerts: string[];
  /** 检测时间 */
  timestamp: Date;
}

/**
 * 降级行动类型
 */
export type DegradationActionType = 'continue' | 'increase_exploration' | 'switch_to_rule' | 'stop';

/**
 * 降级行动
 */
export interface DegradationAction {
  /** 行动类型 */
  type: DegradationActionType;
  /** 行动原因 */
  reason: string;
}

/**
 * 崩溃边界阈值
 */
export interface CollapseThresholds {
  healthy: number;
  warning: number;
  danger: number;
}

/**
 * 所有崩溃边界配置
 */
export interface ThresholdConfig {
  le: CollapseThresholds;
  cs: CollapseThresholds;
  labelNoise: CollapseThresholds;
  feedbackDelay: CollapseThresholds;
}

/**
 * 答题历史记录（用于计算LE和噪声率）
 */
export interface ResponseRecord {
  theta: number;
  deltaC: number;
  correct: boolean;
  timestamp: number;
}

/**
 * 推荐历史记录（用于计算CS）
 */
export interface RecommendationRecord {
  deltaC: number;
  timestamp: number;
}

/**
 * 检测结果
 */
export interface DetectionResult {
  /** 检测到的健康等级 */
  level: HealthLevel;
  /** 告警消息 */
  alerts: string[];
  /** 是否触发降级 */
  shouldDegrade: boolean;
}
