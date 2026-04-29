export function ruleEngineRecommendation(theta: number): number {
  const targetDifficulty = theta + 0.5;
  const rounded = Math.round(targetDifficulty);
  const clamped = Math.max(1, Math.min(5, rounded));
  return clamped;
}

export function ruleEngineRecommendationFloat(theta: number): number {
  const targetDifficulty = theta + 0.5;
  return Math.max(1, Math.min(5, targetDifficulty));
}
