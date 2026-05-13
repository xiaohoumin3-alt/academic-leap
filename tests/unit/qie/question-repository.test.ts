/**
 * Unit tests for lib/qie/question-repository.ts
 * 基于 ID 的题库查询测试
 */

import { QuestionRepository, QuestionWithFeatures } from '@/lib/qie/question-repository';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    question: {
      findMany: jest.fn(),
    },
    questionKnowledgePoint: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('QuestionRepository', () => {
  let repository: QuestionRepository;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    repository = new QuestionRepository();
    jest.clearAllMocks();
  });

  describe('findByTopicIds', () => {
    it('should return empty array when topicIds is empty', async () => {
      const result = await repository.findByTopicIds([]);
      expect(result).toEqual([]);
      expect(mockPrisma.question.findMany).not.toHaveBeenCalled();
    });

    it('should query questions by topic IDs with correct filters', async () => {
      const mockQuestions = [
        {
          id: 'q-1',
          content: { text: 'Question 1' },
          difficulty: 0.5,
          extractionStatus: 'SUCCESS',
          cognitiveLoad: 1,
          reasoningDepth: 1,
          complexity: 0.5,
          questionKnowledgePoints: [{ knowledgePointId: 'kp-1' }],
        },
      ];

      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await repository.findByTopicIds(['kp-1', 'kp-2'], ['exclude-1'], 10);

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            extractionStatus: 'SUCCESS',
            complexity: { not: null },
            id: { notIn: ['exclude-1'] },
            questionKnowledgePoints: {
              some: {
                knowledgePointId: { in: ['kp-1', 'kp-2'] },
              },
            },
          }),
          take: 10,
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q-1');
      expect(result[0].knowledgePointIds).toEqual(['kp-1']);
    });

    it('should transform questionKnowledgePoints to knowledgePointIds array', async () => {
      const mockQuestions = [
        {
          id: 'q-2',
          content: {},
          difficulty: 0.3,
          extractionStatus: 'SUCCESS',
          cognitiveLoad: 2,
          reasoningDepth: 2,
          complexity: 0.7,
          questionKnowledgePoints: [
            { knowledgePointId: 'kp-a' },
            { knowledgePointId: 'kp-b' },
          ],
        },
      ];

      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await repository.findByTopicIds(['kp-a']);

      expect(result[0].knowledgePointIds).toEqual(['kp-a', 'kp-b']);
    });
  });

  describe('findAvailableQuestion', () => {
    it('should return single question from findByTopicIds', async () => {
      const mockQuestion = {
        id: 'q-3',
        content: { text: 'Available question' },
        difficulty: 0.4,
        extractionStatus: 'SUCCESS',
        cognitiveLoad: 1,
        reasoningDepth: 1,
        complexity: 0.6,
        questionKnowledgePoints: [],
      };

      mockPrisma.question.findMany.mockResolvedValue([mockQuestion]);

      const result = await repository.findAvailableQuestion('kp-1', ['exclude-1']);

      expect(result?.id).toBe('q-3');
    });

    it('should return null when no questions available', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);

      const result = await repository.findAvailableQuestion('kp-1');

      expect(result).toBeNull();
    });
  });

  describe('findBestMatchByComplexity', () => {
    it('should return question with closest complexity', async () => {
      const mockQuestions = [
        { id: 'q-a', complexity: 0.3, cognitiveLoad: 1, reasoningDepth: 1, difficulty: 0.5, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
        { id: 'q-b', complexity: 0.7, cognitiveLoad: 2, reasoningDepth: 2, difficulty: 0.6, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
        { id: 'q-c', complexity: 0.5, cognitiveLoad: 1, reasoningDepth: 1, difficulty: 0.4, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
      ];

      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);

      // Target complexity 0.55, q-c (0.5) is closest
      const result = await repository.findBestMatchByComplexity('kp-1', 0.55, [], 50);

      expect(result?.id).toBe('q-c');
    });

    it('should filter out questions without complexity', async () => {
      const mockQuestions = [
        { id: 'q-1', complexity: null, cognitiveLoad: 1, reasoningDepth: 1, difficulty: 0.5, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
        { id: 'q-2', complexity: 0.8, cognitiveLoad: 2, reasoningDepth: 2, difficulty: 0.6, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
      ];

      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await repository.findBestMatchByComplexity('kp-1', 0.5);

      expect(result?.id).toBe('q-2');
    });

    it('should return null when no questions with complexity', async () => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 'q-1', complexity: null, cognitiveLoad: 1, reasoningDepth: 1, difficulty: 0.5, content: {}, extractionStatus: 'SUCCESS', questionKnowledgePoints: [] },
      ]);

      const result = await repository.findBestMatchByComplexity('kp-1', 0.5);

      expect(result).toBeNull();
    });
  });

  describe('createQuestionKnowledgePointLinks', () => {
    it('should not call prisma when knowledgePointIds is empty', async () => {
      await repository.createQuestionKnowledgePointLinks('q-1', []);

      expect(mockPrisma.questionKnowledgePoint.createMany).not.toHaveBeenCalled();
    });

    it('should create links with skipDuplicates', async () => {
      await repository.createQuestionKnowledgePointLinks('q-1', ['kp-1', 'kp-2']);

      expect(mockPrisma.questionKnowledgePoint.createMany).toHaveBeenCalledWith({
        data: [
          { questionId: 'q-1', knowledgePointId: 'kp-1' },
          { questionId: 'q-1', knowledgePointId: 'kp-2' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('deleteQuestionKnowledgePointLinks', () => {
    it('should delete all links for question', async () => {
      await repository.deleteQuestionKnowledgePointLinks('q-1');

      expect(mockPrisma.questionKnowledgePoint.deleteMany).toHaveBeenCalledWith({
        where: { questionId: 'q-1' },
      });
    });
  });

  describe('getQuestionKnowledgePointIds', () => {
    it('should return knowledge point IDs array', async () => {
      mockPrisma.questionKnowledgePoint.findMany.mockResolvedValue([
        { knowledgePointId: 'kp-1' },
        { knowledgePointId: 'kp-2' },
      ]);

      const result = await repository.getQuestionKnowledgePointIds('q-1');

      expect(result).toEqual(['kp-1', 'kp-2']);
    });
  });

  describe('hasKnowledgePoints', () => {
    it('should return true when links exist', async () => {
      mockPrisma.questionKnowledgePoint.count.mockResolvedValue(3);

      const result = await repository.hasKnowledgePoints('q-1');

      expect(result).toBe(true);
    });

    it('should return false when no links exist', async () => {
      mockPrisma.questionKnowledgePoint.count.mockResolvedValue(0);

      const result = await repository.hasKnowledgePoints('q-1');

      expect(result).toBe(false);
    });
  });
});