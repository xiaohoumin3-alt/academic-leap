import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  calculateEquivalentScore,
  getKnowledgeLevel,
  getRecommendedDifficulty,
  getLevelName,
} from '@/lib/scoring';
import {
  calculateNextDiagnosticDifficulty,
  shouldEnterPracticeMode,
  isDiagnosticBoundaryCase,
} from '@/lib/adaptive-difficulty';

/**
 * POST /api/assessment/finish
 * 完成测评并计算等效分
 *
 * 功能：
 * 1. 从数据库获取已提交的答题记录，或使用前端传递的答案
 * 2. 计算各知识点掌握率
 * 3. 计算等效分：Σ(单知识点考试分值 × 掌握率) - 波动修正
 * 4. 生成波动区间（±3分）
 * 5. 计算诊断决策（adaptiveAction）
 * 6. 更新User表的initialAssessment字段
 * 7. 初始化UserKnowledge（记录初始掌握度）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { attemptId, answers, questionIds, currentDifficulty = 6, frontendAccuracy, frontendCorrectCount } = await req.json();

    // 调试日志
    console.log('[Assessment Finish] Request data:', {
      attemptId,
      answersCount: answers?.length,
      questionIdsCount: questionIds?.length,
      currentDifficulty,
      frontendAccuracy,
      frontendCorrectCount,
      answersSample: answers?.slice(0, 3),
    });

    if (!attemptId) {
      return NextResponse.json({ error: '参数错误：缺少 attemptId' }, { status: 400 });
    }

    // 注意：answers/questionIds 在有数据库记录时可选（AttemptStep 已在数据库）
    // 只有当前端需要自定义答案时才传递
    const hasAnswers = Array.isArray(answers) && answers.length > 0;
    const hasQuestionIds = Array.isArray(questionIds) && questionIds.length > 0;

    // 从数据库获取已提交的答题记录（如果存在）
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: '测评记录不存在' }, { status: 404 });
    }

    // 从数据库获取已提交的答题记录（如果存在）
    let attemptSteps = await prisma.attemptStep.findMany({
      where: { attemptId },
      orderBy: { submittedAt: 'asc' },
    });

    // 如果没有答题记录但前端传递了答案，使用前端传递的答案
    if (attemptSteps.length === 0 && answers && questionIds) {
      // 获取题目信息（用于获取知识点）
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds as string[] } },
        select: { id: true, knowledgePoints: true, answer: true },
      });

      console.log('[Assessment Finish] Fetched questions:', questions.map(q => ({ id: q.id, kp: q.knowledgePoints })));

      const questionMap = new Map(questions.map(q => [q.id, q]));

      // 创建临时的 attemptSteps 格式数据
      attemptSteps = answers.map((userAnswer: string | null, index: number) => {
        const questionId = questionIds[index];
        const question = questionMap.get(questionId);
        if (!question) return null;

        // 检查答案是否正确
        const isCorrect = checkAnswer(userAnswer, question.answer);

        return {
          questionId,
          isCorrect,
          duration: 0,
          knowledgePoints: question.knowledgePoints,
        };
      }).filter(Boolean);
    }

    // 辅助函数：检查答案是否正确
    function checkAnswer(userAnswer: string | null, correctAnswer: string): boolean {
      if (!userAnswer) return false;
      if (!correctAnswer) return false;  // 防御：正确答案为空时返回 false

      // 标准化答案：如果是选择题（格式如 "A. xxx"），提取首字母
      const normalizeAnswer = (ans: string): string => {
        const trimmed = ans.trim();
        // 检查是否是选择题格式（A. B. C. D. 开头）
        const match = trimmed.match(/^([A-D])[.\s]/);
        if (match) {
          return match[1].toUpperCase();
        }
        return trimmed;
      };

      return normalizeAnswer(userAnswer).toLowerCase() === normalizeAnswer(correctAnswer).toLowerCase();
    }

    // 获取步骤关联的题目信息（仅当有数据库记录时）
    const stepIds = attemptSteps.map(s => (s as any).questionStepId).filter(Boolean);
    let questionSteps: any[] = [];
    if (stepIds.length > 0) {
      questionSteps = await prisma.questionStep.findMany({
        where: { id: { in: stepIds as string[] } },
        include: {
          question: {
            select: { knowledgePoints: true },
          },
        },
      });
    }

    const questionStepMap = new Map(questionSteps.map(s => [s.id, s]));

    // 获取参与测评的知识点（按用户教材过滤）- 需要在构建答题记录前获取
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { selectedTextbookId: true },
    });

    const knowledgePointWhere: any = {
      inAssess: true,
      status: 'active',
    };
    if (user?.selectedTextbookId) {
      knowledgePointWhere.chapter = {
        textbookId: user.selectedTextbookId,
      };
    }

    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: knowledgePointWhere,
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    // 构建答题记录
    // 修复：如果一道题覆盖多个知识点，答题结果计入所有相关知识点
    // 注意：题目中存储的是知识点 ID（不是名称！）
    const answerRecords: Array<{ knowledgePointId: string; knowledgePointName: string; isCorrect: boolean; duration?: number }> = [];
    for (const step of attemptSteps as any[]) {
      let knowledgePointIds: string[] = [];

      // 从数据库记录获取知识点
      if (step.questionStepId) {
        const questionStep = questionStepMap.get(step.questionStepId);
        try {
          if (questionStep?.question?.knowledgePoints) {
            knowledgePointIds = JSON.parse(questionStep.question.knowledgePoints);
          }
        } catch (e) {}
      }
      // 从前端传递的数据获取知识点
      else if (step.knowledgePoints) {
        try {
          knowledgePointIds = JSON.parse(step.knowledgePoints);
        } catch (e) {
          // knowledgePoints 可能已经是数组
          if (Array.isArray(step.knowledgePoints)) {
            knowledgePointIds = step.knowledgePoints;
          }
        }
      }

      // 如果有知识点，将答题结果计入每个知识点
      if (knowledgePointIds.length > 0) {
        console.log('[Assessment Finish] Processing step with knowledgePoints:', knowledgePointIds);
        for (const kpId of knowledgePointIds) {
          // 优先通过 ID 匹配（题目存储的是 ID）
          let kpInfo = knowledgePoints.find(kp => kp.id === kpId);
          // 如果 ID 匹配失败，尝试用名称匹配（兼容旧数据）
          if (!kpInfo) {
            kpInfo = knowledgePoints.find(kp => kp.name === kpId);
          }

          // 只记录在用户教材范围内的知识点
          if (kpInfo) {
            answerRecords.push({
              knowledgePointId: kpInfo.id,
              knowledgePointName: kpInfo.name,
              isCorrect: step.isCorrect,
              duration: step.duration,
            });
          } else {
            console.log('[Assessment Finish] Knowledge point not found in user textbook:', kpId);
          }
        }
      } else {
        console.log('[Assessment Finish] Step has no knowledgePoints');
      }
    }

    // 如果没有有效答题记录，添加一个"综合"记录避免计算错误
    console.log('[Assessment Finish] Total answerRecords:', answerRecords.length);
    if (answerRecords.length === 0) {
      console.log('[Assessment Finish] No valid answerRecords, adding general record');
      answerRecords.push({
        knowledgePointId: 'general',
        knowledgePointName: '综合',
        isCorrect: false,
        duration: 0,
      });
    }

    // 获取用户信息用于分层指导
    const userInfo = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        grade: true,
        targetScore: true,
      },
    });

    // Build name -> id map for UserKnowledge creation
    const kpNameToId = new Map(knowledgePoints.map(kp => [kp.name, kp.id]));

    // 计算等效分
    const scoreResult = calculateEquivalentScore(answerRecords, knowledgePoints);

    // 计算推荐难度
    const totalLevel = Object.values(scoreResult.knowledgeLevels).reduce((a, b) => a + b.level, 0);
    const avgLevel = Object.keys(scoreResult.knowledgeLevels).length > 0
      ? totalLevel / Object.keys(scoreResult.knowledgeLevels).length
      : 0;
    const { difficultyMultiplier: recommendedDifficulty } = getRecommendedDifficulty(avgLevel);

    // 使用事务包裹所有数据库操作
    const createdAssessmentId = await prisma.$transaction(async (tx) => {
      // 幂等性检查：如果该 attempt 已经有 score，说明已经计算过，直接返回已有的 Assessment
      const existingAttempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        select: { score: true, completedAt: true }
      });

      if (existingAttempt?.completedAt) {
        // 已经计算过，直接返回已有的 Assessment
        const existingAssessment = await tx.assessment.findFirst({
          where: { userId: session.user.id },
          orderBy: { completedAt: 'desc' }
        });
        if (existingAssessment) {
          // 返回已有的结果，但需要重新计算 knowledgeLevels
          return {
            assessmentId: existingAssessment.id,
            scoreResult,
            isExisting: true
          };
        }
      }

      // 更新Attempt记录
      await tx.attempt.update({
        where: { id: attemptId },
        data: {
          score: scoreResult.score,
          completedAt: new Date(),
        },
      });

      // 创建Assessment记录
      const assessment = await tx.assessment.create({
        data: {
          userId: session.user.id,
          type: 'initial',
          score: scoreResult.score,
          scoreRangeLow: scoreResult.range[0],
          scoreRangeHigh: scoreResult.range[1],
          knowledgeData: scoreResult.knowledgeLevels as unknown as Prisma.InputJsonValue,
        },
      });

      // 更新User表
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          initialAssessmentCompleted: true,
          initialAssessmentScore: scoreResult.score,
          initialAssessmentDate: new Date(),
          currentLevel: Math.round(avgLevel),
        },
      });

      // 初始化UserKnowledge记录
      // 只处理用户当前教材中存在的知识点（避免外键约束错误）
      const validKnowledgePointIds = new Set(knowledgePoints.map(kp => kp.id));
      for (const [kpId, kpData] of Object.entries(scoreResult.knowledgeLevels)) {
        // 跳过不在用户当前教材中的知识点
        if (!validKnowledgePointIds.has(kpId)) {
          continue;
        }

        const kpAnswers = answerRecords.filter(a => a.knowledgePointId === kpId);
        const correctCount = kpAnswers.filter(a => a.isCorrect).length;
        const mastery = kpAnswers.length > 0 ? correctCount / kpAnswers.length : 0;

        await tx.userKnowledge.upsert({
          where: {
            userId_knowledgePointId: {
              userId: session.user.id,
              knowledgePointId: kpId,
            },
          },
          create: {
            userId: session.user.id,
            knowledgePointId: kpId,
            mastery,
            practiceCount: kpAnswers.length,
          },
          update: {
            mastery,
            practiceCount: { increment: kpAnswers.length },
          },
        });
      }

      // 返回 assessment ID
      return assessment.id;
    });

    // 获取薄弱知识点（level <= 1）
    const weakKnowledgePoints = Object.values(scoreResult.knowledgeLevels)
      .filter(data => data.level <= 1)
      .map(data => data.name);

    // 获取掌握的知识点（level >= 3）
    const masteredKnowledgePoints = Object.values(scoreResult.knowledgeLevels)
      .filter(data => data.level >= 3)
      .map(data => data.name);

    // 获取未测试的知识点（系统有但测评没测到的）
    const testedKpIds = new Set(Object.keys(scoreResult.knowledgeLevels));
    const untestedKnowledgePoints = knowledgePoints
      .filter(kp => !testedKpIds.has(kp.id))
      .map(kp => kp.name);

    // 获取每道题的详细结果（需要在计算 accuracy 之前）
    let questionResults: Array<{
      questionId: string;
      questionContent: string;
      userAnswer: string | null;
      correctAnswer: string;
      isCorrect: boolean;
      knowledgePoints: string[];
    }> = [];

    if (answers && questionIds) {
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds as string[] } },
        select: { id: true, content: true, answer: true, knowledgePoints: true },
      });

      const questionMap = new Map(questions.map(q => [q.id, q]));

      questionResults = answers.map((userAnswer: string | null, index: number) => {
        const questionId = questionIds[index];
        const question = questionMap.get(questionId);
        if (!question) return null;

        let questionContent = '';
        try {
          const content = typeof question.content === 'string'
            ? JSON.parse(question.content)
            : question.content;
          questionContent = content.question || question.content || '';
        } catch {
          questionContent = '题目内容解析失败';
        }

        let kpList: string[] = [];
        try {
          kpList = JSON.parse(question.knowledgePoints || '[]');
        } catch {
          kpList = [];
        }

        return {
          questionId,
          questionContent,
          userAnswer,
          correctAnswer: question.answer,
          isCorrect: checkAnswer(userAnswer, question.answer),
          knowledgePoints: kpList,
        };
      }).filter(Boolean);
    }

    // ========== 计算 accuracy 和 adaptiveAction（诊断决策） ==========
    // 优先使用前端传递的 accuracy（避免重复计算导致不一致）
    let accuracy: number;
    let correctCount: number;
    const totalQuestions = answers?.length || attemptSteps.length || 0;

    console.log('[Assessment Finish] Calculating accuracy:', {
      frontendAccuracy,
      totalQuestions,
      attemptStepsLength: attemptSteps.length,
      questionResultsLength: questionResults.length,
    });

    if (frontendAccuracy !== undefined) {
      // 前端已计算，直接使用
      accuracy = frontendAccuracy;
      correctCount = frontendCorrectCount ?? Math.round((accuracy * totalQuestions) / 100);
      console.log('[Assessment Finish] Using frontend accuracy:', accuracy);
    } else if (questionResults.length > 0) {
      // 从 questionResults 计算（兼容没有前端 accuracy 的情况）
      correctCount = questionResults.filter((r: any) => r && r.isCorrect).length;
      accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      console.log('[Assessment Finish] Calculated from questionResults:', accuracy);
    } else {
      // 降级：从 attemptSteps 计算
      correctCount = attemptSteps.filter((s: any) => s.isCorrect).length;
      accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      console.log('[Assessment Finish] Calculated from attemptSteps:', accuracy);
    }

    // 计算 adaptiveAction
    const boundary = isDiagnosticBoundaryCase(currentDifficulty, accuracy);
    let adaptiveAction: { type: 'enter_practice' | 'retry_diagnostic'; nextDifficulty?: number; reason?: string };

    if (boundary.isBoundary) {
      adaptiveAction = { type: 'enter_practice', reason: boundary.reason };
    } else if (shouldEnterPracticeMode(accuracy)) {
      adaptiveAction = { type: 'enter_practice' };
    } else {
      adaptiveAction = {
        type: 'retry_diagnostic',
        nextDifficulty: calculateNextDiagnosticDifficulty(currentDifficulty, accuracy),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        assessmentId: createdAssessmentId,  // 返回 assessmentId 用于学习路径生成
        attemptId,  // 也返回 attemptId 保持兼容
        // 诊断决策
        accuracy,
        adaptiveAction,
        // 等效分相关
        score: scoreResult.score,
        range: `${scoreResult.range[0]}-${scoreResult.range[1]}`,
        rangeLow: scoreResult.range[0],
        rangeHigh: scoreResult.range[1],
        knowledgeLevels: Object.fromEntries(
          Object.entries(scoreResult.knowledgeLevels).map(([id, data]) => [data.name, getLevelName(data.level)])
        ),
        knowledgeData: scoreResult.knowledgeLevels,
        recommendedDifficulty,
        // 知识点分析
        weakKnowledgePoints,
        masteredKnowledgePoints,
        untestedKnowledgePoints,
        // 题目详情
        questionResults,
      },
    });
  } catch (error) {
    console.error('完成测评错误:', error);
    return NextResponse.json({ success: false, error: '完成失败' }, { status: 500 });
  }
}
