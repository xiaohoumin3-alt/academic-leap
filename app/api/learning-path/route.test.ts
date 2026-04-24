import { GET } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    learningPath: {
      findFirst: jest.fn(),
    },
    knowledgePoint: {
      findMany: jest.fn(),
    },
    userKnowledge: {
      findMany: jest.fn(),
    },
    attempt: {
      findMany: jest.fn(),
    },
    assessment: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

describe('GET /api/learning-path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBeDefined();
    });
  });

  describe('Active Path Retrieval', () => {
    it('should return 404 when no active learning path exists', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('未找到活跃的学习路径');
    });

    it('should retrieve the latest active learning path', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '基于测评的学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: ['权重高(5)'] },
          { nodeId: 'kp2', priority: 2.5, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: ['权重中(3)'] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '二次函数' },
        { id: 'kp2', name: '一元二次方程' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.9 },
            { knowledgePoint: 'kp2', mastery: 0.5 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.path.id).toBe('path1');
      expect(prisma.learningPath.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: 'active',
        },
        orderBy: {
          generatedAt: 'desc',
        },
      });
    });
  });

  describe('Roadmap Building', () => {
    it('should build roadmap with correct node status based on mastery', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
          { nodeId: 'kp2', priority: 2.5, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
          { nodeId: 'kp3', priority: 2.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1' },
        { id: 'kp2', name: '知识点2' },
        { id: 'kp3', name: '知识点3' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.85 },
            { knowledgePoint: 'kp2', mastery: 0.5 },
            { knowledgePoint: 'kp3', mastery: 0.3 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.roadmap).toHaveLength(3);
      expect(data.data.roadmap[0].status).toBe('completed');
      expect(data.data.roadmap[0].mastery).toBe(0.85);
      expect(data.data.roadmap[1].status).toBe('current');
      expect(data.data.roadmap[2].status).toBe('pending');
    });

    it('should include knowledge point names in roadmap', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '二次函数图像与性质' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.5 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.roadmap[0].name).toBe('二次函数图像与性质');
      expect(data.data.roadmap[0].nodeId).toBe('kp1');
    });
  });

  describe('Weekly Summary', () => {
    it('should calculate practicedCount from attempts in last 7 days', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [{ id: 'kp1', name: '知识点1' }];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.5 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);

      // Mock attempts from last 7 days - only return 2 recent attempts
      (prisma.attempt.findMany as jest.Mock).mockImplementation((args: any) => {
        // If the query is filtering by startedAt >= 7 days ago, only return recent ones
        if (args?.where?.startedAt?.gte) {
          return Promise.resolve([
            { startedAt: new Date() },
            { startedAt: new Date() },
          ]);
        }
        return Promise.resolve([]);
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.weeklySummary.practicedCount).toBe(2);
    });

    it('should calculate masteredCount from userKnowledge with mastery >= 0.8 in last 7 days', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [{ id: 'kp1', name: '知识点1' }];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // Mock userKnowledge - return different data based on query
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.5 },
          ]);
        }
        // If the query is filtering by lastPractice >= 7 days ago, only return recent ones
        if (args?.where?.lastPractice?.gte) {
          return Promise.resolve([
            { mastery: 0.85, lastPractice: threeDaysAgo },
            { mastery: 0.9, lastPractice: threeDaysAgo },
            { mastery: 0.7, lastPractice: threeDaysAgo },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.weeklySummary.masteredCount).toBe(2);
    });

    it('should calculate weakCount as pending nodes in roadmap', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
          { nodeId: 'kp2', priority: 2.5, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
          { nodeId: 'kp3', priority: 2.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [
        { id: 'kp1', name: '知识点1' },
        { id: 'kp2', name: '知识点2' },
        { id: 'kp3', name: '知识点3' },
      ];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.85 },
            { knowledgePoint: 'kp2', mastery: 0.5 },
            { knowledgePoint: 'kp3', mastery: 0.3 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.weeklySummary.weakCount).toBe(2);
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const mockUser = { id: 'user1' };
      (auth as jest.Mock).mockResolvedValue({ user: mockUser });

      const mockPath = {
        id: 'path1',
        name: '学习路径',
        type: 'initial',
        status: 'active',
        knowledgeData: JSON.stringify([
          { nodeId: 'kp1', priority: 3.0, status: 'pending', addedAt: '2024-01-01T00:00:00.000Z', reasons: [] },
        ]),
        generatedAt: new Date('2024-01-01'),
      };
      (prisma.learningPath.findFirst as jest.Mock).mockResolvedValue(mockPath);

      const mockKnowledgePoints = [{ id: 'kp1', name: '知识点1' }];
      (prisma.knowledgePoint.findMany as jest.Mock).mockResolvedValue(mockKnowledgePoints);

      // Mock userKnowledge batch data
      (prisma.userKnowledge.findMany as jest.Mock).mockImplementation((args: any) => {
        // If no lastPractice filter, return mastery data
        if (!args?.where?.lastPractice) {
          return Promise.resolve([
            { knowledgePoint: 'kp1', mastery: 0.5 },
          ]);
        }
        return Promise.resolve([]);
      });

      (prisma.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attempt.findMany as jest.Mock).mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: {
          path: {
            id: expect.any(String),
            name: expect.any(String),
            status: expect.any(String),
            currentIndex: expect.any(Number),
          },
          roadmap: expect.any(Array),
          weeklySummary: {
            practicedCount: expect.any(Number),
            masteredCount: expect.any(Number),
            weakCount: expect.any(Number),
          },
        },
      });
    });
  });
});
