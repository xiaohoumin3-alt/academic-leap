/**
 * Learning Path Analyzer
 *
 * 分析学习路径状态，生成路径调整建议
 */

import type { PathKnowledgeNode } from './types';

/**
 * 路径调整建议类型
 */
export type PathAdjustmentRecommendationType =
  | 'add_weak_points'        // 增加薄弱知识点
  | 'increase_priority'      // 提高优先级
  | 'regenerate_path'        // 重新生成路径
  | 'continue_current'       // 继续当前路径
  | 'broaden_scope';         // 扩大学习范围

/**
 * 路径调整建议
 */
export interface PathAdjustmentRecommendation {
  id: string;
  type: PathAdjustmentRecommendationType;
  title: string;
  description: string;
  reason: string;
  impact: string;
  actionable: boolean;
  actionData?: {
    targetNodeIds?: string[];
    newPriorities?: Record<string, number>;
  };
  priority: number;
}

/**
 * 路径分析输入
 */
export interface PathAnalysisInput {
  currentPath: {
    nodes: PathKnowledgeNode[];
    currentIndex: number;
  };
  diagnosticScore: number;
  targetScore: number;
  scoreGap: number;
  masteredCount: number;
  totalCount: number;
  staleCount?: number;
  weakNodeIds?: string[];  // 薄弱知识点ID列表（掌握度 < 0.5）
}

/**
 * 整体状态
 */
export type OverallStatus = 'on_track' | 'behind' | 'ahead' | 'stagnant';

/**
 * 分数差距分析
 */
export interface ScoreGapAnalysis {
  diagnosticScore: number;
  targetScore: number;
  gap: number;
  percentage: number;
  urgent: boolean;
}

/**
 * 路径进度分析
 */
export interface PathProgressAnalysis {
  masteredCount: number;
  totalCount: number;
  progressPercentage: number;
  currentIndex: number;
}

/**
 * 下一里程碑
 */
export interface NextMilestone {
  targetScore: number;
  expectedNodes: number;
}

/**
 * 路径分析输出
 */
export interface PathAnalysisOutput {
  overallStatus: OverallStatus;
  scoreGapAnalysis: ScoreGapAnalysis;
  pathProgress: PathProgressAnalysis;
  recommendations: PathAdjustmentRecommendation[];
  nextMilestone?: NextMilestone;
}

/**
 * 分析路径并生成调整建议
 */
export function analyzePathForAdjustments(input: PathAnalysisInput): PathAnalysisOutput {
  const {
    currentPath,
    diagnosticScore,
    targetScore,
    scoreGap,
    masteredCount,
    totalCount,
    staleCount = 0,
    weakNodeIds = [],
  } = input;

  // 计算进度百分比
  const progressPercentage = totalCount > 0 ? (masteredCount / totalCount) * 100 : 0;
  const gapPercentage = targetScore > 0 ? (diagnosticScore / targetScore) * 100 : 0;

  // 判断整体状态
  let overallStatus: OverallStatus;
  if (scoreGap <= 10 && progressPercentage > 50) {
    overallStatus = 'on_track';
  } else if (scoreGap > 30 || progressPercentage < 20) {
    overallStatus = 'behind';
  } else if (scoreGap < 0) {
    overallStatus = 'ahead';
  } else {
    overallStatus = 'stagnant';
  }

  // 判断是否急需调整
  const urgent = scoreGap > 30 || progressPercentage < 20 || staleCount > 5;

  // 分数差距分析
  const scoreGapAnalysis: ScoreGapAnalysis = {
    diagnosticScore,
    targetScore,
    gap: scoreGap,
    percentage: Math.round(gapPercentage),
    urgent,
  };

  // 路径进度分析
  const pathProgress: PathProgressAnalysis = {
    masteredCount,
    totalCount,
    progressPercentage: Math.round(progressPercentage),
    currentIndex: currentPath.currentIndex,
  };

  // 生成建议
  const recommendations: PathAdjustmentRecommendation[] = [];

  // 规则1: 分数差距大 + 路径进度慢 → 重新生成路径
  if (scoreGap > 30 && progressPercentage < 30) {
    recommendations.push({
      id: 'regenerate-path',
      type: 'regenerate_path',
      title: '重新规划学习路径',
      description: `当前诊断分数${diagnosticScore}与目标${targetScore}差距较大`,
      reason: '路径进度较慢，可能需要更激进的学习策略',
      impact: '将根据最新测评结果重新生成路径',
      actionable: true,
      priority: 1,
    });
  }

  // 规则2: 分数差距中等 + 有薄弱知识点 → 增加薄弱知识点
  if (scoreGap > 10 && scoreGap <= 30 && weakNodeIds.length > 0) {
    recommendations.push({
      id: 'add-weak-points',
      type: 'add_weak_points',
      title: '增加薄弱知识点练习',
      description: `发现${Math.min(weakNodeIds.length, 3)}个薄弱知识点需要加强`,
      reason: '这些是提分关键',
      impact: '增加后练习会更聚焦薄弱环节',
      actionable: true,
      actionData: {
        targetNodeIds: weakNodeIds.slice(0, 3),
      },
      priority: 2,
    });
  }

  // 规则3: 有遗忘知识点 → 扩大学习范围
  if (staleCount > 0) {
    recommendations.push({
      id: 'broaden-scope',
      type: 'broaden_scope',
      title: '复习已学知识点',
      description: `发现${staleCount}个知识点可能需要复习`,
      reason: '长时间未练习可能导致遗忘',
      impact: '复习后能巩固基础，提高后续学习效率',
      actionable: true,
      priority: 3,
    });
  }

  // 规则4: 分数差距小 → 继续当前路径
  if (scoreGap <= 10 && overallStatus !== 'behind') {
    recommendations.push({
      id: 'continue-current',
      type: 'continue_current',
      title: '保持当前学习节奏',
      description: '当前学习路径合理，继续保持',
      reason: '诊断分数稳定，路径进度正常',
      impact: '按计划完成当前路径即可达到目标',
      actionable: false,
      priority: 4,
    });
  }

  // 规则5: 超过目标分数 → 挑战更高目标
  if (scoreGap < 0) {
    recommendations.push({
      id: 'increase-target',
      type: 'continue_current',
      title: '恭喜！已超过目标分数',
      description: `当前分数${diagnosticScore}已超过目标${targetScore}`,
      reason: '你的学习效果很好',
      impact: '建议设置更高的目标分数挑战自己',
      actionable: false,
      priority: 5,
    });
  }

  // 计算下一里程碑
  const nextMilestone: NextMilestone = {
    targetScore: Math.min(targetScore, diagnosticScore + 20),
    expectedNodes: Math.ceil((scoreGap / 20) * (totalCount - masteredCount)),
  };

  return {
    overallStatus,
    scoreGapAnalysis,
    pathProgress,
    recommendations: recommendations.sort((a, b) => a.priority - b.priority),
    nextMilestone,
  };
}

/**
 * 获取状态对应的中文标签
 */
export function getStatusLabel(status: OverallStatus): string {
  const labels: Record<OverallStatus, string> = {
    on_track: '进度正常',
    behind: '需要加油',
    ahead: '超出预期',
    stagnant: '保持稳定',
  };
  return labels[status];
}

/**
 * 获取状态对应的颜色类名
 */
export function getStatusColor(status: OverallStatus): string {
  const colors: Record<OverallStatus, string> = {
    on_track: 'text-primary',
    behind: 'text-error',
    ahead: 'text-success',
    stagnant: 'text-warning',
  };
  return colors[status];
}

/**
 * 获取建议类型对应的图标
 */
export function getRecommendationIcon(type: PathAdjustmentRecommendationType): string {
  const icons: Record<PathAdjustmentRecommendationType, string> = {
    add_weak_points: 'add_circle',
    increase_priority: 'trending_up',
    regenerate_path: 'refresh',
    continue_current: 'check_circle',
    broaden_scope: 'expand',
  };
  return icons[type];
}
