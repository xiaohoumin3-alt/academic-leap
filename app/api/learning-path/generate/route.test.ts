import { POST } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { calculatePriority, generatePriorityReasons, getUserMastery, getDaysSincePractice, getRecentFailureRate } from '@/lib/learning-path/priority';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    assessment: {
      findUnique: jest.fn(),
    },
    userEnabledKnowledge: {
      findMany: jest.fn(),
    },
    knowledgePoint: {
      findMany: jest.fn(),
    },
    learningPath: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/learning-path/priority', () => ({
  calculatePriority: jest.fn(),
  generatePriorityReasons: jest.fn(),
  getUserMastery: jest.fn(),
  getDaysSincePractice: jest.fn(),
  getRecentFailureRate: jest.fn(),
}));

describe('POST /api/learning-path/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Assessment Score Validation', () => {
    it('should return 400 when assessment score is below 60', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockAssessment = {
        score: 55,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('测评分数不在可生成学习路径的范围内');
    });

    it('should return 400 when assessment score is 90 or above', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockAssessment = {
        score: 92,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('测评分数不在可生成学习路径的范围内');
    });

    it('should accept assessment score between 60 and 89', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockAssessment = {
        score: 75,
        knowledgeData: { kp1: { mastery: 0.6 } },
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const mockEnabledKnowledge = [
        { nodeId: 'kp1', nodeType: 'point' },
        { nodeId: 'kp2', nodeType: 'point' },
      ];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 3, chapterId: 'ch1' },
        { id: 'kp2', name: '知识点2', weight: 4, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock).mockResolvedValue(0.6);
      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);
      (calculatePriority as jest.Mock).mockReturnValue({ score: 2.5, breakdown: { baseScore: 2.5, failureBonus: 1, stalePenalty: 1 } });
      (generatePriorityReasons as jest.Mock).mockReturnValue(['权重高(4)']);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp2', priority: 2.5, status: 'pending', addedAt: new Date().toISOString(), reasons: ['权重高(4)'] },
          { nodeId: 'kp1', priority: 2.0, status: 'pending', addedAt: new Date().toISOString(), reasons: ['权重中(3)'] },
        ]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.pathId).toBe('path1');
    });
  });

  describe('Path Generation Logic', () => {
    it('should skip fully mastered knowledge points (mastery >= 0.9)', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockAssessment = {
        score: 70,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const mockEnabledKnowledge = [
        { nodeId: 'kp1', nodeType: 'point' },
        { nodeId: 'kp2', nodeType: 'point' },
      ];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 3, chapterId: 'ch1' },
        { id: 'kp2', name: '知识点2', weight: 4, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock)
        .mockResolvedValueOnce(0.95) // kp1 - fully mastered, should be skipped
        .mockResolvedValueOnce(0.6);  // kp2 - not mastered

      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);
      (calculatePriority as jest.Mock).mockReturnValue({ score: 2.5, breakdown: { baseScore: 2.5, failureBonus: 1, stalePenalty: 1 } });
      (generatePriorityReasons as jest.Mock).mockReturnValue(['权重高(4)']);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp2', priority: 2.5, status: 'pending', addedAt: new Date().toISOString(), reasons: ['权重高(4)'] },
        ]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.knowledgeData).toHaveLength(1);
      expect(data.data.knowledgeData[0].nodeId).toBe('kp2');
    });

    it('should apply user edits to add and remove nodes', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockAssessment = {
        score: 70,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const mockEnabledKnowledge = [
        { nodeId: 'kp1', nodeType: 'point' },
        { nodeId: 'kp2', nodeType: 'point' },
      ];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 3, chapterId: 'ch1' },
        { id: 'kp2', name: '知识点2', weight: 4, chapterId: 'ch1' },
        { id: 'kp3', name: '知识点3', weight: 5, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock).mockResolvedValue(0.6);
      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);
      (calculatePriority as jest.Mock).mockReturnValue({ score: 2.5, breakdown: { baseScore: 2.5, failureBonus: 1, stalePenalty: 1 } });
      (generatePriorityReasons as jest.Mock).mockReturnValue(['权重高(4)']);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({
          assessmentId: 'assessment1',
          userEdits: {
            add: ['kp3'],
            remove: ['kp1'],
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should have kp2 (from enabled) and kp3 (from userEdits.add), but not kp1 (removed)
      const nodeIds = data.data.knowledgeData.map((node: any) => node.nodeId);
      expect(nodeIds).toContain('kp2');
      expect(nodeIds).toContain('kp3');
      expect(nodeIds).not.toContain('kp1');
    });

    it('should sort knowledge points by priority descending', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockAssessment = {
        score: 70,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const mockEnabledKnowledge = [
        { nodeId: 'kp1', nodeType: 'point' },
        { nodeId: 'kp2', nodeType: 'point' },
        { nodeId: 'kp3', nodeType: 'point' },
      ];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 2, chapterId: 'ch1' },
        { id: 'kp2', name: '知识点2', weight: 4, chapterId: 'ch1' },
        { id: 'kp3', name: '知识点3', weight: 3, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock).mockResolvedValue(0.5);
      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);

      (calculatePriority as jest.Mock)
        .mockImplementation((input) => ({
          score: input.weight * (1 - input.mastery),
          breakdown: { baseScore: input.weight * (1 - input.mastery), failureBonus: 1, stalePenalty: 1 },
        }));

      (generatePriorityReasons as jest.Mock).mockImplementation((input) => [`权重${input.weight}`]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const knowledgeData = data.data.knowledgeData;
      // Should be sorted by priority descending: kp2 (4*0.5=2), kp3 (3*0.5=1.5), kp1 (2*0.5=1)
      expect(knowledgeData[0].nodeId).toBe('kp2');
      expect(knowledgeData[1].nodeId).toBe('kp3');
      expect(knowledgeData[2].nodeId).toBe('kp1');
    });

    it('should archive old paths when creating new one', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockAssessment = {
        score: 70,
        knowledgeData: {},
      };
      (prisma.assessment.findUnique as jest.Mock).mockResolvedValue(mockAssessment);

      const mockEnabledKnowledge = [{ nodeId: 'kp1', nodeType: 'point' }];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 3, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock).mockResolvedValue(0.6);
      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);
      (calculatePriority as jest.Mock).mockReturnValue({ score: 2.5, breakdown: { baseScore: 2.5, failureBonus: 1, stalePenalty: 1 } });
      (generatePriorityReasons as jest.Mock).mockReturnValue(['权重高(4)']);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 2.5, status: 'pending', addedAt: new Date().toISOString(), reasons: ['权重高(4)'] },
        ]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({ assessmentId: 'assessment1' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prisma.learningPath.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: 'active',
        },
        data: {
          status: 'archived',
        },
      });
    });
  });

  describe('Without Assessment ID', () => {
    it('should generate path without assessment when assessmentId not provided', async () => {
      const mockUser = { id: 'user1', grade: 9, selectedTextbookId: 'textbook1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        selectedTextbookId: 'textbook1',
        includeStale: false,
      });

      const mockEnabledKnowledge = [{ nodeId: 'kp1', nodeType: 'point' }];
      (prisma.userEnabledKnowledge.findMany as jest.Mock).mockResolvedValue(mockEnabledKnowledge);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1', weight: 3, chapterId: 'ch1' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      (getUserMastery as jest.Mock).mockResolvedValue(0.6);
      (getDaysSincePractice as jest.Mock).mockResolvedValue(5);
      (getRecentFailureRate as jest.Mock).mockResolvedValue(0.3);
      (calculatePriority as jest.Mock).mockReturnValue({ score: 2.5, breakdown: { baseScore: 2.5, failureBonus: 1, stalePenalty: 1 } });
      (generatePriorityReasons as jest.Mock).mockReturnValue(['权重高(4)']);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const mockLearningPath = {
        id: 'path1',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 2.5, status: 'pending', addedAt: new Date().toISOString(), reasons: ['权重高(4)'] },
        ]),
      };
      (prisma.learningPath.create as jest.Mock).mockResolvedValue(mockLearningPath);
      (prisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost:3000/api/learning-path/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.assessment.findUnique).not.toHaveBeenCalled();
    });
  });
});
