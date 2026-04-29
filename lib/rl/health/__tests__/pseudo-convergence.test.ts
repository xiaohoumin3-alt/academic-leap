import { detectPseudoConvergence } from '../pseudo-convergence';
import type { HealthMetrics } from '../types';

describe('PseudoConvergenceDetector', () => {
  it('should detect pseudo-convergence when CS is high but LE is near zero', () => {
    const metrics: HealthMetrics = {
      le: 0.005,
      cs: 0.85,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };

    const result = detectPseudoConvergence(metrics);

    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('CS高但LE接近0');
  });

  it('should detect pseudo-convergence when LE is negative', () => {
    const metrics: HealthMetrics = {
      le: -0.1,
      cs: 0.8,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };

    const result = detectPseudoConvergence(metrics);

    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('LE为负');
  });

  it('should not detect pseudo-convergence when LE is healthy', () => {
    const metrics: HealthMetrics = {
      le: 0.2,
      cs: 0.85,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.0,
      isPseudoConverged: false,
    };

    const result = detectPseudoConvergence(metrics);

    expect(result.isPseudoConverged).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('should detect pseudo-convergence when reward variance is high with moderate CS', () => {
    const metrics: HealthMetrics = {
      le: 0.01,
      cs: 0.75,
      dfi: 1.0,
      labelNoiseRate: 0.05,
      feedbackDelaySteps: 0,
      rewardLossRate: 0.6,
      isPseudoConverged: false,
    };

    const result = detectPseudoConvergence(metrics);

    expect(result.isPseudoConverged).toBe(true);
    expect(result.reason).toContain('Reward方差高');
  });
});
