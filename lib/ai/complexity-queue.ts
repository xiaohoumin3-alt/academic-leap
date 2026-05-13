/**
 * Complexity Queue - 复杂度提取队列
 *
 * 实现题目生成后自动触发复杂度提取的闭环逻辑。
 * 状态流程: PENDING → PROCESSING → SUCCESS/FAILED
 */

import { prisma } from '@/lib/prisma';
import {
  extractComplexityForQuestion,
  type ExtractionResult,
} from '../qie/complexity-extractor';

export interface QueueItem {
  questionId: string;
  enqueuedAt: Date;
  retries: number;
}

export interface ProcessingResult {
  questionId: string;
  success: boolean;
  result?: ExtractionResult;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Complexity Queue 类
 * 管理复杂度提取任务队列
 */
export class ComplexityQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private onExtractionComplete?: (questionId: string, result: ExtractionResult) => void;

  constructor(
    onExtractionComplete?: (questionId: string, result: ExtractionResult) => void
  ) {
    this.onExtractionComplete = onExtractionComplete;
  }

  /**
   * 将题目加入复杂度提取队列
   */
  enqueueComplexityExtraction(questionId: string): void {
    // 检查是否已在队列中
    const exists = this.queue.some(item => item.questionId === questionId);
    if (exists) {
      console.log(`[ComplexityQueue] Question ${questionId} already in queue`);
      return;
    }

    this.queue.push({
      questionId,
      enqueuedAt: new Date(),
      retries: 0,
    });

    console.log(`[ComplexityQueue] Enqueued question: ${questionId}`);

    // 异步开始处理
    this.processQueue();
  }

  /**
   * 批量加入队列
   */
  enqueueBatch(questionIds: string[]): void {
    for (const id of questionIds) {
      this.enqueueComplexityExtraction(id);
    }
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await this.processExtraction(item);
      } catch (error) {
        console.error(`[ComplexityQueue] Failed to process ${item.questionId}:`, error);

        // 重试逻辑
        if (item.retries < MAX_RETRIES) {
          item.retries++;
          // 延迟重试
          await this.delay(RETRY_DELAY_MS * item.retries);
          this.queue.unshift(item);
        } else {
          // 标记为失败
          await this.markExtractionFailed(item.questionId, String(error));
        }
      }
    }

    this.processing = false;
  }

  /**
   * 处理单个题目的复杂度提取
   */
  private async processExtraction(item: QueueItem): Promise<void> {
    const { questionId } = item;

    // 更新状态为 PROCESSING
    await prisma.question.update({
      where: { id: questionId },
      data: {
        extractionStatus: 'PROCESSING',
      },
    });

    console.log(`[ComplexityQueue] Processing: ${questionId}`);

    // 获取题目内容
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        content: true,
        knowledgePoints: true,
      },
    });

    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    // 执行复杂度提取
    const result = await extractComplexityForQuestion(questionId, question.content);

    // 更新题目复杂度特征
    await prisma.question.update({
      where: { id: questionId },
      data: {
        extractionStatus: 'SUCCESS',
        cognitiveLoad: result.features.cognitiveLoad,
        reasoningDepth: result.features.reasoningDepth,
        complexity: result.features.complexity,
        featuresExtractedAt: new Date(),
      },
    });

    console.log(`[ComplexityQueue] Completed: ${questionId}`, result.features);

    // 回调通知
    if (this.onExtractionComplete) {
      this.onExtractionComplete(questionId, result);
    }
  }

  /**
   * 标记提取失败
   */
  private async markExtractionFailed(questionId: string, error: string): Promise<void> {
    await prisma.question.update({
      where: { id: questionId },
      data: {
        extractionStatus: 'FAILED',
        extractionError: error,
        featuresExtractedAt: new Date(),
      },
    });

    console.error(`[ComplexityQueue] Marked as FAILED: ${questionId} - ${error}`);
  }

  /**
   * 延迟工具
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * 同步处理 PENDING 状态的题目
   * 用于启动时恢复队列
   */
  async syncPendingQuestions(): Promise<number> {
    const pending = await prisma.question.findMany({
      where: {
        extractionStatus: 'PENDING',
      },
      select: { id: true },
      take: 100,
    });

    for (const q of pending) {
      this.enqueueComplexityExtraction(q.id);
    }

    return pending.length;
  }
}

// 全局队列实例
let globalQueue: ComplexityQueue | null = null;

/**
 * 获取全局复杂度队列实例
 */
export function getComplexityQueue(): ComplexityQueue {
  if (!globalQueue) {
    globalQueue = new ComplexityQueue();
  }
  return globalQueue;
}

/**
 * 便捷函数：触发生成后自动调用复杂度提取
 */
export function enqueueAfterGeneration(questionId: string): void {
  const queue = getComplexityQueue();
  queue.enqueueComplexityExtraction(questionId);
}

/**
 * 便捷函数：批量触发生成后自动调用复杂度提取
 */
export function enqueueBatchAfterGeneration(questionIds: string[]): void {
  const queue = getComplexityQueue();
  queue.enqueueBatch(questionIds);
}

/**
 * 处理已生成题目（用于启动时恢复）
 */
export async function processPendingQuestions(): Promise<number> {
  const queue = getComplexityQueue();
  return queue.syncPendingQuestions();
}