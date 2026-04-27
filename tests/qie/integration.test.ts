// tests/qie/integration.test.ts

import { UOK } from '$lib/qie';

describe('QIE Integration', () => {
  describe('Learning Loop', () => {
    it('should learn and improve predictions', () => {
      const uok = new UOK();

      uok.encodeQuestion({
        id: 'q1',
        content: 'Test question',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };
      const p1 = uok.predict('s1', 'q1', ctx);

      // Train with correct answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('s1', 'q1', true);
      }

      const p2 = uok.predict('s1', 'q1', ctx);
      expect(p2).toBeGreaterThan(p1);
    });

    it('should distinguish between strong and weak students', () => {
      const uok = new UOK();

      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };

      // Strong student gets correct answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('strong', 'q1', true);
      }

      // Weak student gets wrong answers
      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('weak', 'q1', false);
      }

      const pStrong = uok.predict('strong', 'q1', ctx);
      const pWeak = uok.predict('weak', 'q1', ctx);

      expect(pStrong).toBeGreaterThan(pWeak);
    });
  });

  describe('Full Workflow', () => {
    it('should handle question ingestion to recommendation', () => {
      const uok = new UOK();

      // 1. Ingest questions
      uok.encodeQuestion({
        id: 'q1',
        content: '代数计算题',
        topics: ['代数']
      });
      uok.encodeQuestion({
        id: 'q2',
        content: '几何证明题',
        topics: ['几何']
      });

      // 2. Record answers
      uok.encodeAnswer('s1', 'q1', false);
      uok.encodeAnswer('s1', 'q2', true);

      // 3. Check student state
      const studentExplanation = uok.explain({ studentId: 's1' });
      if (studentExplanation.type === 'student') {
        expect(studentExplanation.ability).toBe(0.5);
      }

      // 4. Get recommendation
      const action = uok.act('next_question', 's1');
      if (action.type === 'recommend') {
        expect(action.topic).toBe('代数');
      }

      // 5. Check gaps
      const gapAction = uok.act('gap_analysis', 's1');
      if (gapAction.type === 'gap_report') {
        expect(gapAction.gaps.some(g => g.topic === '代数')).toBe(true);
      }
    });

    it('should maintain trace audit trail', () => {
      const uok = new UOK();

      uok.encodeQuestion({ id: 'q1', content: 'Test', topics: ['test'] });
      uok.encodeAnswer('s1', 'q1', true);
      uok.encodeAnswer('s1', 'q1', false);

      const explanation = uok.explain();
      if (explanation.type === 'system') {
        expect(explanation.traceLength).toBe(3); // 1 encode + 2 answers
      }
    });
  });

  describe('State Consistency', () => {
    it('should keep _ml as part of state', () => {
      const uok = new UOK();
      const state = (uok as any).state;

      expect(state._ml).toBeDefined();
      expect(state._ml.embeddings).toBeDefined();
      expect(state._ml.weights).toBeDefined();
    });

    it('should update ML state through learnML only', () => {
      const uok = new UOK();
      uok.encodeQuestion({ id: 'q1', content: 'Test', topics: ['test'] });

      const stateBefore = (uok as any).state._ml;
      const w1Before = Array.from(stateBefore.weights.w1);

      uok.encodeAnswer('s1', 'q1', true);

      const stateAfter = (uok as any).state._ml;
      const w1After = Array.from(stateAfter.weights.w1);

      expect(w1Before).not.toEqual(w1After);
    });
  });
});
