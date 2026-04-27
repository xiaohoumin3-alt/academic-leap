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

  describe('learnML (via encodeAnswer)', () => {
    it('should update weights after feedback', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const stateBefore = (uok as any).state;
      const w1Before = Array.from(stateBefore._ml.weights.w1);

      uok.encodeAnswer('s1', 'q1', true);

      const stateAfter = (uok as any).state;
      const w1After = Array.from(stateAfter._ml.weights.w1);

      expect(w1Before).not.toEqual(w1After);
    });

    it('should increase prediction for correct answers', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };
      const pBefore = uok.predict('s1', 'q1', ctx);

      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('s1', 'q1', true);
      }

      const pAfter = uok.predict('s1', 'q1', ctx);
      expect(pAfter).toBeGreaterThan(pBefore);
    });

    it('should decrease prediction for incorrect answers', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const ctx = { difficulty: 0.5, complexity: 0.5 };
      const pBefore = uok.predict('s2', 'q1', ctx);

      for (let i = 0; i < 10; i++) {
        uok.encodeAnswer('s2', 'q1', false);
      }

      const pAfter = uok.predict('s2', 'q1', ctx);
      expect(pAfter).toBeLessThan(pBefore);
    });

    it('should return pre-learning probability', () => {
      const uok = new UOK();
      uok.encodeQuestion({
        id: 'q1',
        content: 'Test',
        topics: ['test']
      });

      const probability = uok.encodeAnswer('s1', 'q1', true);
      expect(typeof probability).toBe('number');
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    });
  });

  describe('act', () => {
    beforeEach(() => {
      // Setup test questions
    });

    it('should recommend weakest topic', () => {
      const uok = new UOK();
      uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });
      uok.encodeQuestion({ id: 'q2', content: '几何题', topics: ['几何'] });

      uok.encodeAnswer('s1', 'q1', false);
      uok.encodeAnswer('s1', 'q2', true);

      const action = uok.act('next_question', 's1');
      expect(action.type).toBe('recommend');
      if (action.type === 'recommend') {
        expect(action.topic).toBe('代数');
      }
    });

    it('should return done when no topics exist', () => {
      const uok = new UOK();
      // Create a student but with no topics (edge case: questions without topics)
      uok.encodeQuestion({ id: 'q1', content: '题', topics: [] });

      uok.encodeAnswer('s1', 'q1', true);

      const action = uok.act('next_question', 's1');
      // Student exists but has no topics in knowledge map
      expect(action.type).toBe('done');
    });

    it('should return error for unknown student', () => {
      const uok = new UOK();
      const action = uok.act('next_question', 'unknown');
      expect(action.type).toBe('error');
    });

    it('should analyze gaps', () => {
      const uok = new UOK();
      uok.encodeQuestion({ id: 'q1', content: '代数题', topics: ['代数'] });

      uok.encodeAnswer('s1', 'q1', false);

      const action = uok.act('gap_analysis', 's1');
      expect(action.type).toBe('gap_report');
      if (action.type === 'gap_report') {
        expect(action.gaps.length).toBeGreaterThan(0);
      }
    });
  });
});
