// tests/qie/uok.test.ts

import { UOK } from '$lib/qie/uok';

describe('UOK', () => {
  describe('initialization', () => {
    it('should initialize with valid state structure', () => {
      const uok = new UOK();

      const explanation = uok.explain();
      expect(explanation.type).toBe('system');
      if (explanation.type === 'system') {
        expect(explanation.totalQuestions).toBe(0);
        expect(explanation.totalStudents).toBe(0);
      }
    });

    it('should initialize ML weights with correct dimensions', () => {
      const uok = new UOK();
      const state = (uok as any).state;
      expect(state._ml.weights.w1).toHaveLength(67 * 32); // (32*2 + 3) * 32
      expect(state._ml.weights.b1).toHaveLength(32);
      expect(state._ml.weights.w2).toHaveLength(32);
    });
  });
});
