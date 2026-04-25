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
  recommendations?: Recommendation[];
  todayPractice?: Array<{
    knowledgePoint: string;
    suggestedCount: number;
    reason: string;
  }>;
  insights?: Insights;
}

export interface TimelineData {
  date: string;
  count: number;
  avgScore: number;
}
