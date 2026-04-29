// lib/rl/irt/estimator.ts

export interface IRTResponse {
  correct: boolean;
  deltaC: number;
}

export interface IRTConfig {
  thetaMin: number;
  thetaMax: number;
  thetaSteps: number;
  priorMean: number;
  priorStd: number;
}

export interface IRTResult {
  theta: number;
  confidence: number;
}

const DEFAULT_CONFIG: IRTConfig = {
  thetaMin: -3,
  thetaMax: 3,
  thetaSteps: 61,
  priorMean: 0,
  priorStd: 1
};

export function estimateAbilityEAP(
  responses: IRTResponse[],
  config?: Partial<IRTConfig>
): IRTResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { thetaMin, thetaMax, thetaSteps, priorMean, priorStd } = cfg;

  if (responses.length === 0) {
    return { theta: priorMean, confidence: priorStd };
  }

  const dTheta = (thetaMax - thetaMin) / (thetaSteps - 1);

  let numerator = 0;
  let denominator = 0;
  const posteriors: number[] = [];

  // Compute posterior for each theta
  for (let i = 0; i < thetaSteps; i++) {
    const theta = thetaMin + i * dTheta;

    // Compute likelihood
    let likelihood = 1;
    for (const r of responses) {
      const p = logistic(theta - r.deltaC);
      likelihood *= r.correct ? p : (1 - p);
    }

    // Multiply by prior
    const prior = gaussian(theta, priorMean, priorStd);
    const posterior = likelihood * prior;
    posteriors.push(posterior);

    numerator += theta * posterior * dTheta;
    denominator += posterior * dTheta;
  }

  if (denominator === 0) {
    return { theta: priorMean, confidence: priorStd };
  }

  const theta = numerator / denominator;

  // Compute confidence (posterior std)
  let variance = 0;
  for (let i = 0; i < thetaSteps; i++) {
    const thetaVal = thetaMin + i * dTheta;
    variance += posteriors[i] * Math.pow(thetaVal - theta, 2) * dTheta;
  }
  const confidence = Math.sqrt(variance / denominator);

  return { theta, confidence };
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function gaussian(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

// Helper: Convert deltaC to IRT difficulty scale
export function deltaCToDifficulty(deltaC: number): number {
  // deltaC ∈ [0, 10] maps to IRT difficulty ∈ [-3, 3]
  return (deltaC / 10) * 6 - 3;
}

// Helper: Convert IRT theta to deltaC
export function thetaToDeltaC(theta: number): number {
  // theta ∈ [-3, 3] maps to deltaC ∈ [0, 10]
  return ((theta + 3) / 6) * 10;
}
