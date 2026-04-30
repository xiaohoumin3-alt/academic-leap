/**
 * Dead Letter Queue for Gamification Events
 *
 * 记录处理失败的游戏化事件，保证DFI（数据链完整度）
 */

import { prisma } from '@/lib/prisma';

// ============================================================
// 类型定义
// ============================================================

interface FailedEvent {
  eventId: string;
  attemptId: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  leDelta: number;
  duration: number;
  error: string;
  failedAt: Date;
}

// ============================================================
// Dead Letter Queue Service
// ============================================================

class DeadLetterQueue {
  /**
   * 记录失败事件
   *
   * 对于无法写入数据库的情况，记录到文件作为备份
   */
  async logFailure(
    event: FailedEvent
  ): Promise<void> {
    try {
      // 尝试写入数据库
      await prisma.gamificationFailure.create({
        data: {
          eventId: event.eventId,
          attemptId: event.attemptId,
          userId: event.userId,
          questionId: event.questionId,
          isCorrect: event.isCorrect,
          leDelta: event.leDelta,
          duration: event.duration,
          error: event.error,
          failedAt: event.failedAt,
        },
      });
    } catch (dbError) {
      // 数据库写入失败，记录到文件系统
      console.error('[DLQ] Database write failed, falling back to file:', dbError);

      const logEntry = {
        ...event,
        fallbackReason: 'database_unavailable',
      };

      // 追加到失败日志文件
      const fs = await import('fs/promises');
      const path = await import('path');

      const logDir = path.join(process.cwd(), 'logs', 'gamification-failures');
      await fs.mkdir(logDir, { recursive: true });

      const logFile = path.join(logDir, `failures-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    }
  }

  /**
   * 重试失败事件
   *
   * 管理员可以调用此方法来重试处理失败事件
   */
  async retryFailures(batchSize: number = 100): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
  }> {
    const failures = await prisma.gamificationFailure.findMany({
      take: batchSize,
      orderBy: { failedAt: 'asc' },
    });

    let succeeded = 0;
    let failed = 0;

    // 导入游戏化监听器（动态导入避免循环依赖）
    const { gamificationListener } = await import('./event-listener');

    for (const failure of failures) {
      try {
        await gamificationListener.processEvent({
          eventId: failure.eventId,
          attemptId: failure.attemptId,
          userId: failure.userId,
          questionId: failure.questionId,
          isCorrect: failure.isCorrect,
          leDelta: failure.leDelta,
          duration: failure.duration,
          timestamp: failure.failedAt,
        });

        // 成功后删除失败记录
        await prisma.gamificationFailure.delete({
          where: { id: failure.id },
        });

        succeeded++;
      } catch (error) {
        console.error(`[DLQ] Retry failed for event ${failure.eventId}:`, error);
        failed++;
      }
    }

    return {
      attempted: failures.length,
      succeeded,
      failed,
    };
  }

  /**
   * 获取失败事件统计
   */
  async getStats(): Promise<{
    total: number;
    byErrorType: Record<string, number>;
    oldestFailure: Date | null;
  }> {
    const failures = await prisma.gamificationFailure.findMany({
      select: { error: true, failedAt: true },
    });

    const byErrorType: Record<string, number> = {};
    let oldestFailure: Date | null = null;

    for (const failure of failures) {
      const errorType = failure.error.split(':')[0] || 'unknown';
      byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;

      if (!oldestFailure || failure.failedAt < oldestFailure) {
        oldestFailure = failure.failedAt;
      }
    }

    return {
      total: failures.length,
      byErrorType,
      oldestFailure,
    };
  }
}

// ============================================================
// 单例导出
// ============================================================

export const deadLetterQueue = new DeadLetterQueue();
