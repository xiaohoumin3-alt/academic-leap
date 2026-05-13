/**
 * Question Repository - 基于 ID 的题库查询
 *
 * 使用 QuestionKnowledgePoint 多对多关系进行知识点匹配，
 * 替代旧的 knowledgePoints JSON 字段名称匹配。
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface QuestionWithFeatures {
  id: string;
  content: unknown;
  difficulty: number;
  knowledgePointIds: string[];
  cognitiveLoad: number | null;
  reasoningDepth: number | null;
  complexity: number | null;
  extractionStatus: string;
  steps?: unknown[];
}

export class QuestionRepository {
  /**
   * 根据知识点 ID 列表查找可用题目
   * @param topicIds 知识点 ID 列表
   * @param excludeIds 排除的题目 ID 列表
   * @param limit 返回数量限制
   */
  async findByTopicIds(
    topicIds: string[],
    excludeIds: string[] = [],
    limit: number = 100
  ): Promise<QuestionWithFeatures[]> {
    if (topicIds.length === 0) return [];

    return prisma.question.findMany({
      where: {
        extractionStatus: 'SUCCESS',
        complexity: { not: null },
        id: { notIn: excludeIds },
        questionKnowledgePoints: {
          some: {
            knowledgePointId: { in: topicIds },
          },
        },
      },
      select: {
        id: true,
        content: true,
        difficulty: true,
        extractionStatus: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        complexity: true,
        questionKnowledgePoints: {
          select: {
            knowledgePointId: true,
          },
        },
      },
      take: limit,
    }).then(questions => questions.map(q => ({
      id: q.id,
      content: q.content,
      difficulty: q.difficulty,
      knowledgePointIds: q.questionKnowledgePoints.map(kp => kp.knowledgePointId),
      cognitiveLoad: q.cognitiveLoad,
      reasoningDepth: q.reasoningDepth,
      complexity: q.complexity,
      extractionStatus: q.extractionStatus,
    })));
  }

  /**
   * 查找单个可用题目（用于推荐）
   * @param topicId 知识点 ID
   * @param excludeIds 排除的题目 ID 列表
   */
  async findAvailableQuestion(
    topicId: string,
    excludeIds: string[] = []
  ): Promise<QuestionWithFeatures | null> {
    const questions = await this.findByTopicIds([topicId], excludeIds, 1);
    return questions[0] ?? null;
  }

  /**
   * 查找与目标复杂度最接近的题目
   * @param topicId 知识点 ID
   * @param targetComplexity 目标复杂度
   * @param excludeIds 排除的题目 ID 列表
   */
  async findBestMatchByComplexity(
    topicId: string,
    targetComplexity: number,
    excludeIds: string[] = [],
    limit: number = 50
  ): Promise<QuestionWithFeatures | null> {
    const questions = await this.findByTopicIds([topicId], excludeIds, limit);

    if (questions.length === 0) return null;

    // 按复杂度差距排序
    const scored = questions
      .filter(q => q.complexity !== null)
      .map(q => ({
        question: q,
        gap: Math.abs(q.complexity! - targetComplexity),
      }))
      .sort((a, b) => a.gap - b.gap);

    return scored[0]?.question ?? null;
  }

  /**
   * 创建题目与知识点的关联
   */
  async createQuestionKnowledgePointLinks(
    questionId: string,
    knowledgePointIds: string[]
  ): Promise<void> {
    if (knowledgePointIds.length === 0) return;

    const data = knowledgePointIds.map(kpId => ({
      questionId,
      knowledgePointId: kpId,
    }));

    await prisma.questionKnowledgePoint.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * 删除题目与知识点的关联
   */
  async deleteQuestionKnowledgePointLinks(
    questionId: string
  ): Promise<void> {
    await prisma.questionKnowledgePoint.deleteMany({
      where: { questionId },
    });
  }

  /**
   * 更新题目的知识点关联
   */
  async updateQuestionKnowledgePointLinks(
    questionId: string,
    knowledgePointIds: string[]
  ): Promise<void> {
    // 先删除旧的，再创建新的
    await this.deleteQuestionKnowledgePointLinks(questionId);
    await this.createQuestionKnowledgePointLinks(questionId, knowledgePointIds);
  }

  /**
   * 通知推荐服务题目可用
   * （用于 DeepTutor 生成后的回调）
   */
  async notifyQuestionAvailable(questionId: string): Promise<void> {
    // TODO: 实现发布/订阅机制通知推荐服务
    // 目前为空实现，等待 Phase 4 实现通知机制
    console.log(`[QuestionRepository] Question available: ${questionId}`);
  }

  /**
   * 获取题目的知识点 ID 列表
   */
  async getQuestionKnowledgePointIds(questionId: string): Promise<string[]> {
    const links = await prisma.questionKnowledgePoint.findMany({
      where: { questionId },
      select: { knowledgePointId: true },
    });
    return links.map(l => l.knowledgePointId);
  }

  /**
   * 检查题目是否已有关联知识点
   */
  async hasKnowledgePoints(questionId: string): Promise<boolean> {
    const count = await prisma.questionKnowledgePoint.count({
      where: { questionId },
    });
    return count > 0;
  }
}

// 导出单例
export const questionRepository = new QuestionRepository();