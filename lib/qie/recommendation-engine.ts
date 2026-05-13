/**
 * Recommendation Engine - 推荐服务编排
 *
 * 协调 UOK + QuestionRepository + DeepTutorGenerator
 * 实现统一的错误响应和题库空时的兜底生成逻辑
 */

import { prisma } from '@/lib/prisma';
import { UOK } from './uok';
import { QuestionRepository } from './question-repository';
import {
  ErrorCode,
  createErrorResponse,
  createSuccessResponse,
  createRecommendationResponse,
  type RecommendationResponse,
  type RecommendationSuccess,
} from './errors';
import type { Action, RecommendationRationale } from './types';

export interface GetNextQuestionRequest {
  studentId: string;
  excludeQuestionIds?: string[];
  knowledgePointFilter?: string[];
}

export interface GetNextQuestionResult {
  questionId: string;
  questionContent: unknown;
  knowledgePointId: string;
  beforeProbability: number;
  afterProbability?: number;
  rationale: string;
  complexity?: number;
  cognitiveLoad?: number;
  reasoningDepth?: number;
}

/**
 * 推荐引擎类
 * 协调 UOK、题库查询和题目生成
 */
export class RecommendationEngine {
  private uok: UOK;
  private questionRepository: QuestionRepository;

  constructor() {
    this.uok = new UOK();
    this.questionRepository = new QuestionRepository();
  }

  /**
   * 获取下一道推荐题目
   */
  async getNextQuestion(
    request: GetNextQuestionRequest
  ): Promise<RecommendationResponse> {
    const { studentId, excludeQuestionIds = [] } = request;

    try {
      // Step 1: 确保学生状态存在
      await this.ensureStudentState(studentId);

      // Step 2: 获取 UOK 决策
      const action = this.uok.act('next_question', studentId);

      // Step 3: 处理不同类型的响应
      return this.handleAction(action, studentId, excludeQuestionIds);
    } catch (error) {
      console.error('[RecommendationEngine] Error:', error);
      return createRecommendationResponse(false, undefined, createErrorResponse(
        ErrorCode.SYSTEM_ERROR,
        { originalError: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  /**
   * 确保学生状态存在 - 从 UserKnowledge 表加载（Phase 5: UOK 不直接访问数据库）
   */
  private async ensureStudentState(studentId: string): Promise<void> {
    // 从 UserKnowledge 表加载知识点掌握情况
    const userKnowledgeRecords = await prisma.userKnowledge.findMany({
      where: { userId: studentId },
      select: {
        knowledgePointId: true,
        mastery: true,
      },
    });

    // 构建知识点 Map
    const knowledgeData = new Map<string, number>();
    for (const record of userKnowledgeRecords) {
      knowledgeData.set(record.knowledgePointId, record.mastery);
    }

    // 加载到 UOK（UOK 不直接访问数据库）
    this.uok.loadKnowledge(studentId, knowledgeData);
  }

  /**
   * 处理 UOK 返回的动作
   */
  private async handleAction(
    action: Action,
    studentId: string,
    excludeQuestionIds: string[]
  ): Promise<RecommendationResponse> {
    switch (action.type) {
      case 'recommend':
        return await this.handleRecommend(action.topic, studentId, excludeQuestionIds);

      case 'recommend_question':
        return await this.handleRecommend(action.topic, studentId, excludeQuestionIds);

      case 'done':
        return createRecommendationResponse(false, undefined, createErrorResponse(
          ErrorCode.ALL_TOPICS_MASTERED,
          { reason: action.reason }
        ));

      case 'gap_report':
        return createRecommendationResponse(false, undefined, createErrorResponse(
          ErrorCode.NO_LEARNING_PATH,
          { gaps: action.gaps }
        ));

      case 'error':
        // 分析错误原因
        if (action.reason?.includes('diagnostic')) {
          return createRecommendationResponse(false, undefined, createErrorResponse(
            ErrorCode.NEEDS_DIAGNOSTIC
          ));
        }
        return createRecommendationResponse(false, undefined, createErrorResponse(
          ErrorCode.SYSTEM_ERROR,
          { reason: action.reason }
        ));

      default:
        return createRecommendationResponse(false, undefined, createErrorResponse(
          ErrorCode.SYSTEM_ERROR,
          { actionType: (action as { type: string }).type }
        ));
    }
  }

  /**
   * 处理推荐请求 - 查找题目
   */
  private async handleRecommend(
    topicId: string,
    studentId: string,
    excludeQuestionIds: string[]
  ): Promise<RecommendationResponse> {
    // 获取学生当前状态
    const explanation = this.uok.explain({ studentId });
    if (explanation.type !== 'student') {
      return createRecommendationResponse(false, undefined, createErrorResponse(
        ErrorCode.SYSTEM_ERROR
      ));
    }

    const mastery = explanation.weakTopics.find(t => t.topic === topicId)?.mastery ?? 0.5;
    const targetComplexity = 0.3 + mastery * 0.5;

    // Step 1: 使用 ID 查询题目
    let question = await this.questionRepository.findBestMatchByComplexity(
      topicId,
      targetComplexity,
      excludeQuestionIds,
      50
    );

    // Step 2: 如果题库为空，触发生成
    if (!question) {
      const generationResult = await this.triggerQuestionGeneration(topicId);
      if (!generationResult.success) {
        return createRecommendationResponse(false, undefined, createErrorResponse(
          generationResult.errorCode ?? ErrorCode.GENERATION_FAILED,
          generationResult.details
        ));
      }
      // 重新查询刚生成的题目
      question = await this.questionRepository.findAvailableQuestion(topicId, excludeQuestionIds);
    }

    // Step 3: 返回题目
    if (!question) {
      return createRecommendationResponse(false, undefined, createErrorResponse(
        ErrorCode.TOPIC_NO_QUESTIONS
      ));
    }

    const beforeProbability = this.uok.predict(studentId, question.id, {
      difficulty: 0.5,
      complexity: question.complexity ?? 0.5,
    });

    return createRecommendationResponse(true, createSuccessResponse(
      question,
      topicId,
      beforeProbability,
      `推荐难度 ${question.difficulty} 的题目`
    ));
  }

  /**
   * 触发题目生成
   */
  private async triggerQuestionGeneration(
    topicId: string
  ): Promise<{ success: boolean; errorCode?: ErrorCode; details?: Record<string, unknown> }> {
    console.log(`[RecommendationEngine] Triggering question generation for topic: ${topicId}`);

    // TODO: Phase 3 实现真正的 DeepTutor 集成
    // 目前返回错误，提示系统繁忙
    return {
      success: false,
      errorCode: ErrorCode.TOPIC_NO_QUESTIONS,
      details: { topicId },
    };
  }

  /**
   * 记录学生答题结果
   */
  async recordAnswer(
    studentId: string,
    questionId: string,
    knowledgePointId: string,
    correct: boolean
  ): Promise<{ beforeProbability: number; afterProbability: number }> {
    // 获取题目信息
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        cognitiveLoad: true,
        reasoningDepth: true,
        complexity: true,
        difficulty: true,
      },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    // 获取预测前概率
    const beforeProbability = this.uok.predict(studentId, questionId, {
      difficulty: question.difficulty ?? 0.5,
      complexity: question.complexity ?? 0.5,
    });

    // 编码题目到 UOK
    this.uok.encodeQuestion({
      id: questionId,
      content: '',
      topics: [knowledgePointId],
    });

    // 编码答案
    const afterProbability = this.uok.encodeAnswer(studentId, questionId, correct);

    // Phase 5: 状态持久化由调用方负责（RecommendationEngine 不直接写数据库）
    // 调用方需要将新的 mastery 值写回 UserKnowledge 表

    // 记录到 RL 控制器（如果启用）
    // TODO: 集成 RL 控制器

    return { beforeProbability, afterProbability };
  }

  /**
   * 保存学生状态（由调用方使用）
   * 将 UOK 中的 mastery 写回 UserKnowledge 表
   */
  async persistStudentState(studentId: string): Promise<void> {
    const student = this.uok.getStudentState(studentId);
    if (!student) return;

    // 批量更新 UserKnowledge 表
    const updates = Array.from(student.knowledge.entries()).map(([kpId, mastery]) =>
      prisma.userKnowledge.upsert({
        where: {
          userId_knowledgePointId: {
            userId: studentId,
            knowledgePointId: kpId,
          },
        },
        create: {
          userId: studentId,
          knowledgePointId: kpId,
          mastery,
        },
        update: {
          mastery,
          lastPractice: new Date(),
          practiceCount: { increment: 1 },
        },
      })
    );

    await prisma.$transaction(updates);
  }

  /**
   * 获取学生解释
   */
  getStudentExplanation(studentId: string) {
    return this.uok.explain({ studentId });
  }
}

// 导出单例
export const recommendationEngine = new RecommendationEngine();