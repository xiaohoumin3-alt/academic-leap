/**
 * 断点恢复服务 - PracticeSessionService
 *
 * User Journey: As a 学生，我需要能够退出练习后稍后继续
 *
 * 功能：
 * 1. 创建和管理练习会话状态
 * 2. 支持会话暂停和恢复
 * 3. 处理跨设备会话冲突
 * 4. 24小时超时确认
 */

import { prisma } from '@/lib/prisma';

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface CreateSessionOptions {
  subject?: string;
  questionCount?: number;
  currentIndex?: number;
}

export interface UpdateProgressOptions {
  questionIndex: number;
  answer: { questionId: string; isCorrect: boolean };
}

export interface CompleteSessionOptions {
  score: number;
  totalQuestions: number;
}

export interface ConflictResolution {
  strategy: 'latest_timestamp' | 'keep_both';
  activeSessionId: string;
  pausedSessionIds: string[];
}

export interface SessionWithMetadata {
  id: string;
  userId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  answers: any[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  requiresConfirmation?: boolean;
}

const SESSION_TIMEOUT_HOURS = 24;

export class PracticeSessionService {
  /**
   * 创建新的练习会话
   */
  async createSession(
    userId: string,
    options: CreateSessionOptions = {}
  ): Promise<SessionWithMetadata> {
    const session = await prisma.practiceSession.create({
      data: {
        userId,
        status: 'active',
        currentQuestionIndex: options.currentIndex ?? 0,
        subject: options.subject,
        questionCount: options.questionCount,
        answers: JSON.stringify([])
      }
    });

    return this.formatSession(session);
  }

  /**
   * 暂停会话
   */
  async pauseSession(sessionId: string): Promise<SessionWithMetadata> {
    const session = await prisma.practiceSession.update({
      where: { id: sessionId },
      data: { status: 'paused' }
    });

    return this.formatSession(session);
  }

  /**
   * 恢复会话
   */
  async resumeSession(userId: string): Promise<SessionWithMetadata | null> {
    const session = await prisma.practiceSession.findFirst({
      where: {
        userId,
        status: { in: ['paused', 'active'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!session) {
      return null;
    }

    // 更新为active状态
    const updated = await prisma.practiceSession.update({
      where: { id: session.id },
      data: { status: 'active' }
    });

    return this.formatSession(updated);
  }

  /**
   * 获取用户的活跃会话（active或paused）
   */
  async getActiveSession(userId: string): Promise<SessionWithMetadata | null> {
    const session = await prisma.practiceSession.findFirst({
      where: {
        userId,
        status: { in: ['paused', 'active'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!session) {
      return null;
    }

    const formatted = this.formatSession(session);

    // 检查是否超过24小时需要确认
    if (session.status === 'paused') {
      const hoursSinceUpdate = (Date.now() - session.updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate > SESSION_TIMEOUT_HOURS) {
        formatted.requiresConfirmation = true;
      }
    }

    return formatted;
  }

  /**
   * 解决跨设备会话冲突
   * 策略：保留最新时间戳的会话为active，其他改为paused
   */
  async resolveConflict(userId: string): Promise<ConflictResolution> {
    return await prisma.$transaction(async (tx) => {
      // 查找所有active会话
      const activeSessions = await tx.practiceSession.findMany({
        where: {
          userId,
          status: 'active'
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (activeSessions.length <= 1) {
        return {
          strategy: 'latest_timestamp',
          activeSessionId: activeSessions[0]?.id || '',
          pausedSessionIds: []
        };
      }

      // 第一个是最新的，保持active
      const latestSession = activeSessions[0];
      const toPause = activeSessions.slice(1);

      // 暂停其他会话
      for (const session of toPause) {
        await tx.practiceSession.update({
          where: { id: session.id },
          data: { status: 'paused' }
        });
      }

      return {
        strategy: 'latest_timestamp',
        activeSessionId: latestSession.id,
        pausedSessionIds: toPause.map(s => s.id)
      };
    });
  }

  /**
   * 更新练习进度
   */
  async updateProgress(
    sessionId: string,
    options: UpdateProgressOptions
  ): Promise<SessionWithMetadata> {
    const session = await prisma.practiceSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const answers = JSON.parse(session.answers || '[]');
    answers.push(options.answer);

    const updated = await prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        currentQuestionIndex: options.questionIndex,
        answers: JSON.stringify(answers)
      }
    });

    return this.formatSession(updated);
  }

  /**
   * 完成练习会话
   */
  async completeSession(
    sessionId: string,
    options: CompleteSessionOptions
  ): Promise<SessionWithMetadata> {
    const session = await prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    return this.formatSession(session);
  }

  /**
   * 格式化会话数据
   */
  private formatSession(session: any): SessionWithMetadata {
    return {
      id: session.id,
      userId: session.userId,
      status: session.status as SessionStatus,
      currentQuestionIndex: session.currentQuestionIndex,
      answers: JSON.parse(session.answers || '[]'),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt
    };
  }
}

// 导出单例
export const sessionService = new PracticeSessionService();
