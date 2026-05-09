/**
 * 断点恢复功能测试
 *
 * User Journey: As a 学生，我需要能够退出练习后稍后继续
 *
 * 测试覆盖：
 * 1. PracticeSession创建和状态管理
 * 2. 会话暂停和恢复
 * 3. 跨设备会话冲突解决
 * 4. 超时处理（24小时）
 */

import { PracticeSessionService, SessionStatus } from '@/lib/practice/session-service';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    practiceSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn()
    },
    $transaction: jest.fn(async (fn) => fn({
      practiceSession: {
        findMany: jest.fn(),
        update: jest.fn()
      }
    }))
  }
}));

describe('断点恢复 - PracticeSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('创建练习会话', () => {
    it('应该创建active状态的会话', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.practiceSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        currentQuestionIndex: 0,
        answers: '[]',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const service = new PracticeSessionService();
      const session = await service.createSession('user-1', {
        subject: 'math',
        questionCount: 20
      });

      expect((session as any).status).toBe('active');
      expect(prisma.practiceSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            status: 'active'
          })
        })
      );
    });

    it('应该记录当前题目索引', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.practiceSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        currentQuestionIndex: 5,
        answers: '[]'
      });

      const service = new PracticeSessionService();
      const session = await service.createSession('user-1', {
        subject: 'math',
        questionCount: 20,
        currentIndex: 5
      });

      expect(session.currentQuestionIndex).toBe(5);
    });
  });

  describe('会话暂停和恢复', () => {
    it('应该能暂停active会话', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'paused'
      });

      const service = new PracticeSessionService();
      const session = await service.pauseSession('session-1');

      expect(session.status).toBe('paused');
    });

    it('应该能恢复paused会话', async () => {
      const { prisma } = require('@/lib/prisma');
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'paused',
        currentQuestionIndex: 10,
        answers: '["q1","q2","q3"]',
        createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        updatedAt: new Date()
      };
      prisma.practiceSession.findFirst.mockResolvedValue(mockSession);
      prisma.practiceSession.update.mockResolvedValue({
        ...mockSession,
        status: 'active'
      });

      const service = new PracticeSessionService();
      const session = await service.resumeSession('user-1');

      expect((session as any).status).toBe('active');
      expect((session as any).currentQuestionIndex).toBe(10);
    });

    it('超过24小时的paused会话应提示用户确认', async () => {
      const { prisma } = require('@/lib/prisma');
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
      prisma.practiceSession.findFirst.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'paused',
        currentQuestionIndex: 5,
        createdAt: yesterday,
        updatedAt: yesterday
      });

      const service = new PracticeSessionService();
      const session = await service.getActiveSession('user-1');

      expect(session).toBeDefined();
      expect((session as any).requiresConfirmation).toBe(true);
    });
  });

  describe('跨设备会话冲突', () => {
    it('应该暂停旧会话并激活新会话', async () => {
      const { prisma } = require('@/lib/prisma');

      // Mock transaction behavior
      const mockTx = {
        practiceSession: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'new-session', userId: 'user-1', status: 'active', updatedAt: new Date() },
            { id: 'old-session', userId: 'user-1', status: 'active', updatedAt: new Date(Date.now() - 10000) }
          ]),
          update: jest.fn()
        }
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        return await fn(mockTx);
      });

      mockTx.practiceSession.update.mockResolvedValue({ status: 'paused' });

      const service = new PracticeSessionService();
      const result = await service.resolveConflict('user-1');

      expect(result.strategy).toBe('latest_timestamp');
      expect(result.activeSessionId).toBe('new-session');
      expect(result.pausedSessionIds).toContain('old-session');
    });
  });

  describe('会话状态管理', () => {
    it('应该正确更新题目索引', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.practiceSession.findUnique.mockResolvedValue({
        id: 'session-1',
        answers: '[]'
      });
      prisma.practiceSession.update.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: 'active',
        currentQuestionIndex: 6,
        answers: '[{"questionId":"q6","isCorrect":true}]',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const service = new PracticeSessionService();
      const session = await service.updateProgress('session-1', {
        questionIndex: 6,
        answer: { questionId: 'q6', isCorrect: true }
      });

      expect(session.currentQuestionIndex).toBe(6);
    });

    it('完成练习时应标记会话为completed', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.practiceSession.update.mockResolvedValue({
        id: 'session-1',
        status: 'completed',
        completedAt: new Date()
      });

      const service = new PracticeSessionService();
      const session = await service.completeSession('session-1', {
        score: 85,
        totalQuestions: 20
      });

      expect(session.status).toBe('completed');
    });
  });
});
