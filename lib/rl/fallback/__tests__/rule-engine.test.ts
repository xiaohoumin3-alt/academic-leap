import { ruleEngineRecommendation } from '../rule-engine';

describe('RuleEngine', () => {
  it('should recommend difficulty 1 for theta=0', () => {
    expect(ruleEngineRecommendation(0)).toBe(1);
  });

  it('should recommend difficulty 1 for very low theta', () => {
    expect(ruleEngineRecommendation(-2)).toBe(1);
  });

  it('should recommend difficulty 5 for very high theta', () => {
    expect(ruleEngineRecommendation(4)).toBe(5);
  });

  it('should handle boundary values', () => {
    expect(ruleEngineRecommendation(3.5)).toBe(4);
    expect(ruleEngineRecommendation(4)).toBe(5);
    expect(ruleEngineRecommendation(4.5)).toBe(5);
  });

  it('should handle negative theta', () => {
    expect(ruleEngineRecommendation(-0.5)).toBe(1);
    expect(ruleEngineRecommendation(-1.5)).toBe(1);
  });
});
