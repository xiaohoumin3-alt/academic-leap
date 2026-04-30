// Phase 2: Core Reinforcement - Barrel Export

// CW-TS
export { CWThompsonSamplingBandit } from './bandit/cw-thompson-sampling';
export type { CWTSBanditState } from './bandit/cw-thompson-sampling';

// TD-CA
export { applyTimeDecay, calculateDecayWeight } from './reward/time-decay-credit';
export type { DecayResult } from './reward/time-decay-credit';

// Distribution Monitor
export { DistributionMonitor } from './monitor/distribution';
export { detectDifficultyDrift } from './monitor/difficulty-drift';
export { detectAbilityDrift } from './monitor/ability-drift';
export { detectRewardDrift } from './monitor/reward-drift';
export type {
  DistributionAlert,
  DistributionCheckInput,
  DistributionMonitorState,
} from './monitor/distribution';
export type { DifficultyDrift } from './monitor/difficulty-drift';
export type { AbilityDrift } from './monitor/ability-drift';
export type { RewardDrift } from './monitor/reward-drift';
export type { QuestionAttempt } from './monitor/difficulty-drift';

// Config
export {
  PHASE_2_FEATURES,
  getFeatureConfig,
  isFeatureEnabled,
} from './config/phase2-features';
export type {
  CWTSConfig,
  TDCAConfig,
  DistMonConfig,
  FeatureConfig,
} from './config/phase2-features';
