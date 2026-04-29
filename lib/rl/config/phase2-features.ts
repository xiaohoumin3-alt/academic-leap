/**
 * Phase 2 Feature Flags Configuration
 *
 * Environment-based feature toggles for Phase 2 RL enhancements:
 * - CW-TS: Confidence-Weighted Thompson Sampling
 * - TD-CA: Time-Decayed Credit Assignment
 * - Distribution Monitor: Comprehensive distribution tracking
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface CWTSConfig {
  confidenceScale: number;
  minConfidence: number;
  enableCutoff: boolean;
  cutoffThreshold: number;
}

export interface TDCAConfig {
  decayHalfLife: number;
  maxDelay: number;
  minWeight: number;
}

export interface DistMonConfig {
  checkInterval: number;
  alertThreshold: number;
  difficultyWindowSize: number;
  abilityWindowSize: number;
  rewardWindowSize: number;
}

export interface FeatureConfig<T> {
  enabled: boolean;
  config: T;
}

// ============================================================================
// Environment Variable Helpers
// ============================================================================

function parseEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function parseEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Feature Configurations
// ============================================================================

/**
 * CW-TS (Confidence-Weighted Thompson Sampling) Configuration
 *
 * Environment Variables:
 * - RL_CWTS_ENABLED: Enable/disable feature (default: true)
 * - RL_CWTS_CONFIDENCE_SCALE: Scale factor for confidence values (default: 100)
 * - RL_CWTS_MIN_CONFIDENCE: Minimum confidence threshold (default: 0.3)
 * - RL_CWTS_ENABLE_CUTOFF: Enable confidence cutoff (default: false)
 * - RL_CWTS_CUTOFF_THRESHOLD: Cutoff threshold value (default: 0.1)
 */
const cwtsConfig: FeatureConfig<CWTSConfig> = {
  enabled: parseEnvBool('RL_CWTS_ENABLED', true),
  config: {
    confidenceScale: parseEnvNumber('RL_CWTS_CONFIDENCE_SCALE', 100),
    minConfidence: parseEnvNumber('RL_CWTS_MIN_CONFIDENCE', 0.3),
    enableCutoff: parseEnvBool('RL_CWTS_ENABLE_CUTOFF', false),
    cutoffThreshold: parseEnvNumber('RL_CWTS_CUTOFF_THRESHOLD', 0.1),
  },
};

/**
 * TD-CA (Time-Decayed Credit Assignment) Configuration
 *
 * Environment Variables:
 * - RL_TDCA_ENABLED: Enable/disable feature (default: true)
 * - RL_TDCA_DECAY_HALFLIFE: Decay half-life in ms (default: 1800000 = 30min)
 * - RL_TDCA_MAX_DELAY: Maximum delay for credit assignment in ms (default: 7200000 = 2h)
 * - RL_TDCA_MIN_WEIGHT: Minimum weight for delayed rewards (default: 0.1)
 */
const tdcaConfig: FeatureConfig<TDCAConfig> = {
  enabled: parseEnvBool('RL_TDCA_ENABLED', true),
  config: {
    decayHalfLife: parseEnvNumber('RL_TDCA_DECAY_HALFLIFE', 1800000), // 30 minutes
    maxDelay: parseEnvNumber('RL_TDCA_MAX_DELAY', 7200000), // 2 hours
    minWeight: parseEnvNumber('RL_TDCA_MIN_WEIGHT', 0.1),
  },
};

/**
 * Distribution Monitor Configuration
 *
 * Environment Variables:
 * - RL_DISTMON_ENABLED: Enable/disable feature (default: true)
 * - RL_DISTMON_CHECK_INTERVAL: Check interval (default: 100)
 * - RL_DISTMON_ALERT_THRESHOLD: Alert threshold for drift (default: 0.2)
 * - RL_DISTMON_DIFFICULTY_WINDOW: Window size for difficulty tracking (default: 100)
 * - RL_DISTMON_ABILITY_WINDOW: Window size for ability tracking (default: 200)
 * - RL_DISTMON_REWARD_WINDOW: Window size for reward tracking (default: 50)
 */
const distmonConfig: FeatureConfig<DistMonConfig> = {
  enabled: parseEnvBool('RL_DISTMON_ENABLED', true),
  config: {
    checkInterval: parseEnvNumber('RL_DISTMON_CHECK_INTERVAL', 100),
    alertThreshold: parseEnvNumber('RL_DISTMON_ALERT_THRESHOLD', 0.2),
    difficultyWindowSize: parseEnvNumber('RL_DISTMON_DIFFICULTY_WINDOW', 100),
    abilityWindowSize: parseEnvNumber('RL_DISTMON_ABILITY_WINDOW', 200),
    rewardWindowSize: parseEnvNumber('RL_DISTMON_REWARD_WINDOW', 50),
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Phase 2 feature flags configuration
 */
export const PHASE_2_FEATURES = {
  cwts: cwtsConfig,
  tdca: tdcaConfig,
  distmon: distmonConfig,
} as const;

/**
 * Get configuration for a specific feature
 *
 * @param name - Feature name ('cwts' | 'tdca' | 'distmon')
 * @returns Feature configuration object
 *
 * @example
 * ```ts
 * const cwtsConfig = getFeatureConfig<CWTSConfig>('cwts');
 * console.log(cwtsConfig.confidenceScale); // 100
 * ```
 */
export function getFeatureConfig<T>(name: keyof typeof PHASE_2_FEATURES): T {
  const feature = PHASE_2_FEATURES[name];
  if (!feature) {
    throw new Error(`Unknown feature: ${name}`);
  }
  return feature.config as T;
}

/**
 * Check if a feature is enabled
 *
 * @param name - Feature name ('cwts' | 'tdca' | 'distmon')
 * @returns true if feature is enabled, false otherwise
 *
 * @example
 * ```ts
 * if (isFeatureEnabled('cwts')) {
 *   // Use confidence-weighted sampling
 * }
 * ```
 */
export function isFeatureEnabled(name: keyof typeof PHASE_2_FEATURES): boolean {
  const feature = PHASE_2_FEATURES[name];
  if (!feature) {
    return false;
  }
  return feature.enabled;
}
