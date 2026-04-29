export interface KnowledgeData {
  knowledgePoint: string;
  mastery: number;
  stability?: number;
  status?: 'high' | 'medium' | 'low';
}

export interface DiagnosticAttempt {
  id: string;
  score: number;
  completedAt: string;
}

export interface OverviewInner {
  totalAttempts: number;
  averageScore: number;
  lowestScore: number;
  completedAttempts: number;
  totalMinutes: number;
  completionRate: number;
  dataReliability: 'high' | 'medium' | 'low';
  volatilityRange: number;
  initialAssessmentCompleted: boolean;
  initialAssessmentScore: number;
  needsCalibration: boolean;
  calibratedStartingScore: number | null;
  startingScoreCalibrated: boolean;
  totalQuestions: number;
  correctRate: number;
  diagnosticAttempts: DiagnosticAttempt[];
  trainingAvgScore: number;
  trainingCount: number;
  trainingQuestions: number;
  trainingCorrectRate: number;
  trainingMinutes: number;
  diagnosticDataReliability: 'high' | 'medium' | 'low';
  diagnosticVolatilityRange: number;
  diagnosticAttemptsCount: number;
  trainingKnowledgeMastery: Array<{ knowledgePoint: string; mastery: number; recentAccuracy?: number }>;
}

export interface Recommendation {
  type: 'practice' | 'review' | 'challenge' | 'tip';
  title: string;
  description: string;
  priority?: number;
}

export interface Insights {
  weakPoints?: string[];
  strongPoints?: string[];
  avgScore?: number;
  speedLevel?: string;
  achievements?: Array<{
    name: string;
    description: string;
  }>;
}

export interface RecommendationsData {
  // 路径调整建议（API 返回的 recommendations 字段）
  recommendations?: PathAdjustmentRecommendation[];

  // 旧字段保留以兼容
  todayPractice?: Array<{
    knowledgePoint: string;
    suggestedCount: number;
    reason: string;
  }>;
  insights?: Insights;

  // 路径状态
  overallStatus?: 'on_track' | 'behind' | 'ahead' | 'stagnant';
  overallStatusLabel?: string;
  overallStatusColor?: string;
  scoreGapAnalysis?: ScoreGapAnalysis;
  pathProgress?: PathProgressAnalysis;
  nextMilestone?: NextMilestone;
  message?: Message;

  // 最新测评ID（用于重新生成学习路径）
  latestAssessmentId?: string | null;
}

export interface ScoreGapAnalysis {
  diagnosticScore: number;
  targetScore: number;
  gap: number;
  percentage: number;
  urgent: boolean;
}

export interface PathProgressAnalysis {
  masteredCount: number;
  totalCount: number;
  progressPercentage: number;
  currentIndex: number;
}

export type PathAdjustmentRecommendationType =
  | 'add_weak_points'
  | 'increase_priority'
  | 'regenerate_path'
  | 'continue_current'
  | 'broaden_scope';

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
    weakPointNames?: string[];  // 具体薄弱知识点名称
  };
  priority: number;
}

export interface NextMilestone {
  targetScore: number;
  expectedNodes: number;
}

export interface Message {
  title: string;
  subtitle: string;
  primaryAction?: {
    text: string;
    action: string;
  };
}

export interface TimelineData {
  date: string;
  count: number;
  avgScore: number;
}
