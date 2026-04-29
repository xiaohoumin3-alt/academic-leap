// lib/rl/reward/time-decay-credit.ts

import type { TDCAConfig } from '../config/phase2-features';

export interface DecayResult {
  adjustedReward: number;
  originalReward: number;
  decayWeight: number;
  delayMs: number;
  isIgnored: boolean;
}

/**
 * Calculate decay weight based on response delay
 *
 * Formula: decayWeight = exp(-delayMs / decayHalfLife)
 *
 * @param delayMs - Time elapsed since response in milliseconds
 * @param decayHalfLife - Half-life for decay in milliseconds
 * @param minWeight - Minimum weight floor (prevents complete decay to zero)
 * @returns Decay weight between minWeight and 1.0
 */
export function calculateDecayWeight(
  delayMs: number,
  decayHalfLife: number,
  minWeight: number
): number {
  const decayFactor = Math.exp(-delayMs / decayHalfLife);
  return Math.max(decayFactor, minWeight);
}

/**
 * Apply time-decay credit assignment to a base reward
 *
 * Adjusts the reward based on the delay between the learning event
 * and the response. Delayed responses receive reduced credit to
 * ensure temporal alignment in RL updates.
 *
 * Decay scenarios:
 * - < 1 minute: weight > 0.95 (no significant decay)
 * - ~30 minutes: weight ~0.5 (moderate decay, at half-life)
 * - > 2 hours: isIgnored = true (too delayed, ignore entirely)
 *
 * @param baseReward - Original reward value (typically 0-1)
 * @param responseTimestamp - Timestamp when the response was recorded
 * @param config - TDCA configuration including decay parameters
 * @returns Decay result with adjusted reward and metadata
 */
export function applyTimeDecay(
  baseReward: number,
  responseTimestamp: number,
  config: TDCAConfig
): DecayResult {
  const now = Date.now();
  const delayMs = Math.max(0, now - responseTimestamp);

  // Check if delay exceeds maximum threshold
  if (delayMs > config.maxDelay) {
    return {
      adjustedReward: 0,
      originalReward: baseReward,
      decayWeight: 0,
      delayMs,
      isIgnored: true
    };
  }

  // Calculate decay weight
  const decayWeight = calculateDecayWeight(
    delayMs,
    config.decayHalfLife,
    config.minWeight
  );

  // Apply decay to base reward
  const adjustedReward = baseReward * decayWeight;

  return {
    adjustedReward,
    originalReward: baseReward,
    decayWeight,
    delayMs,
    isIgnored: false
  };
}
