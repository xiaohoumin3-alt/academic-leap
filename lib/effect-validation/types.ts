// ============================================================================
// Shadow Mode
// ============================================================================

export interface ShadowAttempt {
  id: string;
  templateId: string;
  userId: string;
  knowledgePoint: string;
  isCorrect: boolean;
  duration: number;
  leDelta?: number;
  recordedAt: Date;
}

// ============================================================================
// Experiment
// ============================================================================

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type Variant = 'control' | 'treatment';
export type TargetMetric = 'accuracy' | 'le';

export interface ExperimentConfig {
  name: string;
  controlTemplateId: string;
  treatmentTemplateId: string;
  targetMetric: TargetMetric;
  minSampleSize: number;
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  userId: string;
  variant: Variant;
  assignedAt: Date;
}

export interface Observation {
  id: string;
  experimentId: string;
  userId: string;
  variant: Variant;
  metricName: string;
  value: number;
  timestamp: Date;
}

export interface ExperimentResult {
  controlMean: number;
  controlSample: number;
  treatmentMean: number;
  treatmentSample: number;
  uplift: number;
  pValue: number;
  significant: boolean;
  recommendation: 'promote' | 'demote' | 'need_more_data';
}

// ============================================================================
// Canary
// ============================================================================

export type CanaryStatus = 'pending' | 'running' | 'paused' | 'completed' | 'rolled_back';
export type HealthStatus = 'healthy' | 'warning' | 'danger';

export const CANARY_STAGES = [5, 10, 25, 50, 100] as const;
export const STAGE_DURATION_HOURS = 24;

export interface CanaryRelease {
  id: string;
  templateId: string;
  currentStage: number;
  trafficPercent: number;
  status: CanaryStatus;
  startedAt?: Date;
  lastHealthCheck?: Date;
  healthStatus?: HealthStatus;
}

export interface CanaryStageHistory {
  id: string;
  canaryId: string;
  stage: number;
  trafficPercent: number;
  enteredAt: Date;
  exitedAt?: Date;
  leValue?: number;
  accuracyValue?: number;
}

// ============================================================================
// LE Analysis
// ============================================================================

export type Trend = 'improving' | 'stable' | 'declining';

export interface LEResult {
  knowledgePointId: string;
  le: number;
  confidence: number;
  sampleSize: number;
  trend: Trend;
}

export interface GlobalLEResult {
  le: number;
  confidence: number;
  trend: Trend;
  byKnowledgePoint: LEResult[];
}

// ============================================================================
// Degradation
// ============================================================================

export type Severity = 'warning' | 'danger' | 'critical';
export type Strategy = 'rl' | 'rule_engine';

export interface DegradationRule {
  severity: Severity;
  action: 'increase_exploration' | 'switch_to_rule_engine' | 'immediate_rollback';
  description: string;
}

export interface DegradationStatus {
  templateId: string;
  status: 'healthy' | 'warning' | 'degraded' | 'stopped';
  currentStrategy: Strategy;
  degradationReason?: string;
  degradedAt?: Date;
}

// ============================================================================
// Dashboard
// ============================================================================

export interface ValidationDashboard {
  activeCanaries: CanaryRelease[];
  activeExperiments: Array<{
    id: string;
    name: string;
    status: ExperimentStatus;
    progress: number;
  }>;
  globalLE: GlobalLEResult;
  anomalies: AnomalyReport[];
}

export interface AnomalyReport {
  type: 'le_drop' | 'accuracy_drop' | 'variance_spike';
  severity: Severity;
  details: {
    metric: string;
    expected: number;
    actual: number;
    deviation: number;
  };
  detectedAt: Date;
}
