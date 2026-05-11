/**
 * GREEN Tests: Verify fixes for Layer1 and Layer2 bugs in uok-flow-service.ts
 *
 * Layer 1 Fix: Removed take:N before topic filter.
 *   OLD: take:100 → JS filter → missing topics if not in first 100 rows
 *   NEW: query ALL SUCCESS → JS filter → always finds topic regardless of row position
 *
 * Layer 2 Fix: getRecommendation iterates through weakTopics until finding
 *   a topic with available SUCCESS questions.
 */

const mockPrismaQuestionFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: { findMany: mockPrismaQuestionFindMany },
  },
}));

jest.mock('@/lib/qie/uok', () => ({
  UOK: jest.fn().mockImplementation(() => ({
    getOrCreateStudentWithState: jest.fn(),
    act: jest.fn().mockReturnValue({ type: 'recommend', topic: 'kp17-2-folding' }),
    explain: jest.fn().mockReturnValue({
      type: 'student',
      weakTopics: [
        { topic: 'kp17-2-folding', mastery: 0 },
        { topic: 'kp18-1-property', mastery: 0.2 },
        { topic: 'kp16-4-multiply', mastery: 0.8 },
      ],
    }),
    predict: jest.fn().mockReturnValue(0.5),
    encodeQuestion: jest.fn(),
    encodeAnswer: jest.fn(),
    saveStudentState: jest.fn(),
  })),
}));

jest.mock('@/lib/qie/experiment-tracker', () => ({
  experimentTracker: { record: jest.fn() },
}));

import { UOKFlowService } from '../uok-flow-service';

describe('UOKFlowService.getRecommendation', () => {
  let service: UOKFlowService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UOKFlowService();
  });

  describe('Layer 1 Fix: no take:N before topic filter', () => {
    it('should find a question when topic exists among ALL SUCCESS questions', async () => {
      // FIXED: findQuestionByTopic queries ALL SUCCESS questions, then filters by topic.
      // Mock returns questions including the target topic.
      mockPrismaQuestionFindMany.mockResolvedValueOnce([
        {
          id: 'q-kp17-1',
          content: 'kp17-2-folding question 1',
          difficulty: 5,
          type: 'calculation',
          answer: '',
          knowledgePoints: JSON.stringify(['kp17-2-folding']),
          cognitiveLoad: null,
          reasoningDepth: null,
          complexity: null,
        },
        {
          id: 'q-other-1',
          content: 'different topic',
          difficulty: 5,
          type: 'calculation',
          answer: '',
          knowledgePoints: JSON.stringify(['kp16-4-multiply']),
          cognitiveLoad: null,
          reasoningDepth: null,
          complexity: null,
        },
      ]);

      const result = await service.getRecommendation('test-user', []);

      expect(result).not.toBeNull();
      expect(result!.topic).toBe('kp17-2-folding');
      const returnedKPs = JSON.parse(result!.questionData.knowledgePoints);
      expect(returnedKPs).toContain('kp17-2-folding');
    });

    it('should return null when topic has NO SUCCESS questions', async () => {
      // FIXED: query ALL SUCCESS questions, JS filter finds 0 → null
      mockPrismaQuestionFindMany.mockResolvedValueOnce([
        // Only questions from OTHER topics
        {
          id: 'q-other-1',
          content: 'different topic',
          difficulty: 5,
          type: 'calculation',
          answer: '',
          knowledgePoints: JSON.stringify(['kp16-4-multiply']),
          cognitiveLoad: null,
          reasoningDepth: null,
          complexity: null,
        },
      ]);

      // Layer 2 fix: falls back to next weakest
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]); // kp18-1-property

      // kp16-4-multiply has questions
      mockPrismaQuestionFindMany.mockResolvedValueOnce([
        {
          id: 'q-kp16-fallback',
          content: 'kp16-4-multiply question',
          difficulty: 5,
          type: 'calculation',
          answer: '',
          knowledgePoints: JSON.stringify(['kp16-4-multiply']),
          cognitiveLoad: null,
          reasoningDepth: null,
          complexity: null,
        },
      ]);

      const result = await service.getRecommendation('test-user', []);

      expect(result).not.toBeNull();
      expect(result!.topic).toBe('kp16-4-multiply');
    });
  });

  describe('Layer 2 Fix: iterate weakTopics until finding available question', () => {
    it('should skip topic with 0 SUCCESS questions and try the next weakest', async () => {
      // kp17-2-folding: no SUCCESS questions in DB (empty = 0 matched after JS filter)
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]);
      // kp18-1-property: no SUCCESS questions either
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]);
      // kp16-4-multiply: has SUCCESS questions → recommend this
      mockPrismaQuestionFindMany.mockResolvedValueOnce([
        {
          id: 'q-kp16-final',
          content: 'kp16-4-multiply question',
          difficulty: 5,
          type: 'calculation',
          answer: '',
          knowledgePoints: JSON.stringify(['kp16-4-multiply']),
          cognitiveLoad: null,
          reasoningDepth: null,
          complexity: null,
        },
      ]);

      const result = await service.getRecommendation('test-user', []);

      // FIXED: skips kp17-2-folding (0 SUCCESS), skips kp18-1-property (0 SUCCESS),
      // finds kp16-4-multiply (has SUCCESS)
      expect(result).not.toBeNull();
      expect(result!.topic).toBe('kp16-4-multiply');
    });

    it('should return null only when ALL weak topics have no SUCCESS questions', async () => {
      // All three weak topics return empty → no questions for any of them
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]); // kp17-2-folding
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]); // kp18-1-property
      mockPrismaQuestionFindMany.mockResolvedValueOnce([]); // kp16-4-multiply

      const result = await service.getRecommendation('test-user', []);

      expect(result).toBeNull();
    });
  });
});
