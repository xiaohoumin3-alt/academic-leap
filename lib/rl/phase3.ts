/**
 * Phase 3: Core Reconstruction
 *
 * Barrel export for Phase 3 RL components:
 * - LQM: Label Quality Model for noisy label detection/correction
 * - Normalizer: z-score feature normalization
 * - Adaptation: Adaptive exploration rate control
 */

// Label Quality Model
export { LabelQualityModel } from './quality/label-quality';
export type {
  QuestionAttempt,
  QuestionQuality,
  CorrectedLabel,
  StudentResponse,
  QuestionHistory,
} from './quality/types';

// Feature Normalizer
export { FeatureNormalizer } from './normalize/feature-normalizer';
export type { NormalizationStats } from './normalize/feature-normalizer';

// Adaptation Controller
export { AdaptationController } from './control/adaptation-controller';
export type { AdaptationState, HealthMetrics } from './control/adaptation-controller';

// Config (prefixed to avoid conflict with phase2 exports)
export {
  PHASE_3_FEATURES,
  getFeatureConfig as getPhase3FeatureConfig,
  isFeatureEnabled as isPhase3FeatureEnabled,
} from './config/phase3-features';
export type {
  LQMConfig,
  NormalizerConfig,
  AdaptationConfig,
  FeatureConfig as Phase3FeatureConfig,
} from './config/phase3-features';
