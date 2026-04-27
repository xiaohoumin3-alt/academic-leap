// tests/qie/types.test.ts
import {
  Context,
  QuestionFeatures,
  ModelExport,
  QuestionState,
  StudentState,
  UOKState,
  SpaceState,
  Explanation,
  Action,
  Gap
} from '$lib/qie/types';

describe('QIE Types', () => {
  describe('Context', () => {
    it('should create a valid context', () => {
      const ctx: Context = {
        difficulty: 0.5,
        complexity: 0.7
      };
      expect(ctx.difficulty).toBe(0.5);
      expect(ctx.complexity).toBe(0.7);
    });
  });

  describe('QuestionFeatures', () => {
    it('should create valid features', () => {
      const features: QuestionFeatures = {
        cognitiveLoad: 0.5,
        reasoningDepth: 2,
        complexity: 0.6,
        difficulty: 0.5
      };
      expect(features.cognitiveLoad).toBe(0.5);
      expect(features.reasoningDepth).toBe(2);
    });
  });

  describe('SpaceState', () => {
    it('should update topic counts', () => {
      const space = new SpaceState();
      const features: QuestionFeatures = {
        cognitiveLoad: 0.5,
        reasoningDepth: 2,
        complexity: 0.6,
        difficulty: 0.5
      };

      space.update(['algebra', 'geometry'], features);

      expect(space.topics.has('algebra')).toBe(true);
      expect(space.topics.has('geometry')).toBe(true);
      expect(space.getCount('algebra')).toBe(1);
      expect(space.getCount('geometry')).toBe(1);

      space.update(['algebra'], features);
      expect(space.getCount('algebra')).toBe(2);
      expect(space.getCount('geometry')).toBe(1);
    });

    it('should return 0 for non-existent topics', () => {
      const space = new SpaceState();
      expect(space.getCount('nonexistent')).toBe(0);
    });
  });

  describe('UOKState', () => {
    it('should create valid state structure', () => {
      const features: QuestionFeatures = {
        cognitiveLoad: 0.5,
        reasoningDepth: 2,
        complexity: 0.6,
        difficulty: 0.5
      };

      const questionState: QuestionState = {
        id: 'q1',
        topics: ['algebra'],
        features,
        quality: 0.8,
        attemptCount: 10,
        correctCount: 7
      };

      const studentState: StudentState = {
        id: 's1',
        knowledge: new Map([['algebra', 0.7]]),
        attemptCount: 10,
        correctCount: 7
      };

      const uokState: UOKState = {
        questions: new Map([['q1', questionState]]),
        students: new Map([['s1', studentState]]),
        space: new SpaceState(),
        trace: []
      };

      expect(uokState.questions.get('q1')?.id).toBe('q1');
      expect(uokState.students.get('s1')?.id).toBe('s1');
      expect(uokState.trace.length).toBe(0);
    });
  });

  describe('Explanation types', () => {
    it('should create student explanation', () => {
      const explanation: Explanation = {
        type: 'student',
        studentId: 's1',
        ability: 0.75,
        weakTopics: [{ topic: 'algebra', mastery: 0.4 }],
        totalAttempts: 10
      };
      expect(explanation.type).toBe('student');
    });

    it('should create question explanation', () => {
      const features: QuestionFeatures = {
        cognitiveLoad: 0.5,
        reasoningDepth: 2,
        complexity: 0.6,
        difficulty: 0.5
      };
      const explanation: Explanation = {
        type: 'question',
        questionId: 'q1',
        topics: ['algebra'],
        quality: 0.8,
        attempts: 10,
        features
      };
      expect(explanation.type).toBe('question');
    });

    it('should create system explanation', () => {
      const explanation: Explanation = {
        type: 'system',
        totalQuestions: 100,
        totalStudents: 20,
        totalAttempts: 500,
        topics: ['algebra', 'geometry'],
        traceLength: 500
      };
      expect(explanation.type).toBe('system');
    });

    it('should create error explanation', () => {
      const explanation: Explanation = {
        type: 'error',
        message: 'Something went wrong'
      };
      expect(explanation.type).toBe('error');
    });
  });

  describe('Action types', () => {
    it('should create recommend action', () => {
      const action: Action = {
        type: 'recommend',
        topic: 'algebra',
        reason: 'Weak mastery detected'
      };
      expect(action.type).toBe('recommend');
    });

    it('should create gap_report action', () => {
      const gaps: Gap[] = [
        { topic: 'algebra', mastery: 0.4, type: 'weak_knowledge' },
        { topic: 'calculus', mastery: 0, type: 'missing_questions', count: 0 }
      ];
      const action: Action = {
        type: 'gap_report',
        gaps
      };
      expect(action.type).toBe('gap_report');
      expect(action.gaps).toHaveLength(2);
    });

    it('should create done action', () => {
      const action: Action = {
        type: 'done',
        reason: 'All topics mastered'
      };
      expect(action.type).toBe('done');
    });

    it('should create error action', () => {
      const action: Action = {
        type: 'error',
        reason: 'Invalid input'
      };
      expect(action.type).toBe('error');
    });
  });
});
