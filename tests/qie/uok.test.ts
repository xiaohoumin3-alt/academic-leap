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

  describe('encodeQuestion', () => {
    it('should encode question and update state', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: '证明：若 f(x) = x²，则 f(2) = 4',
        topics: ['函数', '证明']
      });

      const explanation = uok.explain({ questionId: 'q1' });
      expect(explanation.type).toBe('question');
      if (explanation.type === 'question') {
        expect(explanation.questionId).toBe('q1');
        expect(explanation.topics).toEqual(['函数', '证明']);
      }
    });

    it('should extract cognitive features from content', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: '证明：若 f(x) 同时满足两个条件',
        topics: ['证明']
      });

      const explanation = uok.explain({ questionId: 'q1' });
      if (explanation.type === 'question') {
        expect(explanation.features.reasoningDepth).toBeGreaterThan(0);
        expect(explanation.features.cognitiveLoad).toBeGreaterThan(0);
      }
    });

    it('should add trace entry', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: '简单题目',
        topics: ['基础']
      });

      const state = (uok as any).state;
      expect(state.trace.length).toBe(1);
      expect(state.trace[0].type).toBe('encode');
    });
  });

  describe('predict', () => {
    it('should return probability between 0 and 1', () => {
      const uok = new UOK();
      const p = uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });

    it('should create new embeddings for unknown entities', () => {
      const uok = new UOK();
      uok.predict('new_student', 'new_question', { difficulty: 0.5, complexity: 0.5 });

      const state = (uok as any).state;
      expect(state._ml.embeddings.students.size).toBe(1);
      expect(state._ml.embeddings.questions.size).toBe(1);
    });

    it('should reuse embeddings for known entities', () => {
      const uok = new UOK();
      uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });
      uok.predict('student1', 'question1', { difficulty: 0.5, complexity: 0.5 });

      const state = (uok as any).state;
      expect(state._ml.embeddings.students.size).toBe(1);
      expect(state._ml.embeddings.questions.size).toBe(1);
    });
  });
});
