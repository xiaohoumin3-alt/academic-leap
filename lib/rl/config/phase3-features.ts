/**
 * Phase 3 Feature Flags Configuration
 *
 * Environment-based feature toggles for Phase 3 RL enhancements:
 * - LQM: Label Quality Monitor (noise detection & handling)
 * - Normalizer: Reward/Prediction Normalizer
 * - Adaptation: Exploration Rate Adaptation
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface LQMConfig {
  noiseThreshold: number;
  minAttempts: number;
  decayRate: number;
}

export interface NormalizerConfig {
  windowSize: number;
}

export interface AdaptationConfig {
  baseExplorationRate: number;
  minExplorationRate: number;
  adaptationSpeed: number;
  confidenceThreshold: number;
}

export interface UokIntegrationConfig {
  baseCandidateCount: number;
  maxCandidateCount: number;
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

function parseEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Feature Configurations
// ============================================================================

/**
 * LQM (Label Quality Monitor) Configuration
 *
 * Environment Variables:
 * - RL_LQM_ENABLED: Enable/disable feature (default: true)
 * - RL_LQM_NOISE_THRESHOLD: Threshold for noise detection (default: 0.7)
 * - RL_LQM_MIN_ATTEMPTS: Minimum attempts before noise evaluation (default: 20)
 * - RL_LQM_DECAY_RATE: Decay rate for noise estimate (default: 0.95)
 */
const lqmConfig: FeatureConfig<LQMConfig> = {
  enabled: parseEnvBool('RL_LQM_ENABLED', true),
  config: {
    noiseThreshold: parseEnvNumber('RL_LQM_NOISE_THRESHOLD', 0.7),
    minAttempts: parseEnvNumber('RL_LQM_MIN_ATTEMPTS', 20),
    decayRate: parseEnvNumber('RL_LQM_DECAY_RATE', 0.95),
  },
};

/**
 * Normalizer Configuration
 *
 * Environment Variables:
 * - RL_NORMALIZER_ENABLED: Enable/disable feature (default: true)
 * - RL_NORMALIZER_WINDOW: Window size for normalization (default: 1000)
 */
const normalizerConfig: FeatureConfig<NormalizerConfig> = {
  enabled: parseEnvBool('RL_NORMALIZER_ENABLED', true),
  config: {
    windowSize: parseEnvNumber('RL_NORMALIZER_WINDOW', 1000),
  },
};

/**
 * Adaptation (Exploration Rate Adaptation) Configuration
 *
 * Environment Variables:
 * - RL_ADAPTATION_ENABLED: Enable/disable feature (default: true)
 * - RL_ADAPTATION_BASE_RATE: Base exploration rate (default: 0.1)
 * - RL_ADAPTATION_MIN_RATE: Minimum exploration rate (default: 0.01)
 * - RL_ADAPTATION_SPEED: Adaptation speed (default: 0.1)
 * - RL_ADAPTATION_CONFIDENCE_THRESHOLD: Confidence threshold for adaptation (default: 0.8)
 */
const adaptationConfig: FeatureConfig<AdaptationConfig> = {
  enabled: parseEnvBool('RL_ADAPTATION_ENABLED', true),
  config: {
    baseExplorationRate: parseEnvNumber('RL_ADAPTATION_BASE_RATE', 0.1),
    minExplorationRate: parseEnvNumber('RL_ADAPTATION_MIN_RATE', 0.01),
    adaptationSpeed: parseEnvNumber('RL_ADAPTATION_SPEED', 0.1),
    confidenceThreshold: parseEnvNumber('RL_ADAPTATION_CONFIDENCE_THRESHOLD', 0.8),
  },
};

/**
 * UOK Integration Configuration
 *
 * Environment Variables:
 * - RL_UOK_INTEGRATION_ENABLED: Enable/disable feature (default: true)
 * - RL_BASE_CANDIDATE_COUNT: Base candidate count (default: 2)
 * - RL_MAX_CANDIDATE_COUNT: Maximum candidate count (default: 5)
 */
const uokIntegrationConfig: FeatureConfig<UokIntegrationConfig> = {
  enabled: parseEnvBool('RL_UOK_INTEGRATION_ENABLED', true),
  config: {
    baseCandidateCount: parseEnvInt('RL_BASE_CANDIDATE_COUNT', 2),
    maxCandidateCount: parseEnvInt('RL_MAX_CANDIDATE_COUNT', 5),
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Phase 3 feature flags configuration
 */
export const PHASE_3_FEATURES = {
  lqm: lqmConfig,
  normalizer: normalizerConfig,
  adaptation: adaptationConfig,
  uokIntegration: uokIntegrationConfig,
} as const;

/**
 * Get configuration for a specific feature
 *
 * @param name - Feature name ('lqm' | 'normalizer' | 'adaptation' | 'uokIntegration')
 * @returns Feature configuration object
 *
 * @example
 * ```ts
 * const lqmConfig = getFeatureConfig<LQMConfig>('lqm');
 * console.log(lqmConfig.noiseThreshold); // 0.7
 * ```
 */
export function getFeatureConfig<T>(name: keyof typeof PHASE_3_FEATURES): T {
  const feature = PHASE_3_FEATURES[name];
  if (!feature) {
    throw new Error(`Unknown feature: ${name}`);
  }
  return feature.config as T;
}

/**
 * Check if a feature is enabled
 *
 * @param name - Feature name ('lqm' | 'normalizer' | 'adaptation' | 'uokIntegration')
 * @returns true if feature is enabled, false otherwise
 *
 * @example
 * ```ts
 * if (isFeatureEnabled('lqm')) {
 *   // Use label quality monitoring
 * }
 * ```
 */
export function isFeatureEnabled(name: keyof typeof PHASE_3_FEATURES): boolean {
  const feature = PHASE_3_FEATURES[name];
  if (!feature) {
    return false;
  }
  return feature.enabled;
}
