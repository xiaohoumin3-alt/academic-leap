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
import { generateGuidance, getTargetStrategy } from '@/lib/assessment-guidance';

/**
 * POST /api/assessment/finish
 * 完成测评并计算等效分
 *
 * 功能：
 * 1. 从数据库获取已提交的答题记录
 * 2. 计算各知识点掌握率
 * 3. 计算等效分：Σ(单知识点考试分值 × 掌握率) - 波动修正
 * 4. 生成波动区间（±3分）
 * 5. 生成分层指导
 * 6. 更新User表的initialAssessment字段
 * 7. 初始化UserKnowledge（记录初始掌握度）
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { attemptId } = await req.json();

    if (!attemptId) {
      return NextResponse.json({ error: '参数错误：缺少 attemptId' }, { status: 400 });
    }

    // 获取测评记录
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.userId !== session.user.id) {
      return NextResponse.json({ error: '测评记录不存在' }, { status: 404 });
    }

    // 从数据库获取已提交的答题记录
    const attemptSteps = await prisma.attemptStep.findMany({
      where: { attemptId },
      orderBy: { submittedAt: 'asc' },
    });

    // 获取步骤关联的题目信息
    const stepIds = attemptSteps.map(s => s.questionStepId).filter(Boolean);
    const questionSteps = await prisma.questionStep.findMany({
      where: { id: { in: stepIds as string[] } },
      include: {
        question: {
          select: { knowledgePoints: true },
        },
      },
    });

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
    // 注意：题目中存储的是知识点名称，需要映射到 ID
    const answerRecords: Array<{ knowledgePointId: string; knowledgePointName: string; isCorrect: boolean; duration?: number }> = [];
    for (const step of attemptSteps) {
      const questionStep = step.questionStepId ? questionStepMap.get(step.questionStepId) : null;
      let knowledgePointNames: string[] = [];
      try {
        if (questionStep?.question?.knowledgePoints) {
          knowledgePointNames = JSON.parse(questionStep.question.knowledgePoints);
        }
      } catch (e) {}

      // 如果有知识点，将答题结果计入每个知识点
      if (knowledgePointNames.length > 0) {
        for (const kpName of knowledgePointNames) {
          // 查找对应的知识点 ID
          const kpInfo = knowledgePoints.find(kp => kp.name === kpName);
          answerRecords.push({
            knowledgePointId: kpInfo?.id ?? kpName,
            knowledgePointName: kpName,
            isCorrect: step.isCorrect,
            duration: step.duration,
          });
        }
      } else {
        // 没有知识点则计入"综合"
        answerRecords.push({
          knowledgePointId: 'general',
          knowledgePointName: '综合',
          isCorrect: step.isCorrect,
          duration: step.duration,
        });
      }
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

    // 生成个性化指导
    const userGrade = userInfo?.grade || 7;
    const targetScore = userInfo?.targetScore || 80;
    const guidance = generateGuidance({
      score: scoreResult.score,
      userGrade,
      targetScore,
    });

    // 获取目标策略
    const targetStrategy = getTargetStrategy(scoreResult.score, targetScore);

    return NextResponse.json({
      success: true,
      data: {
        assessmentId: createdAssessmentId,  // 返回 assessmentId 用于学习路径生成
        attemptId,  // 也返回 attemptId 保持兼容
        score: scoreResult.score,
        range: `${scoreResult.range[0]}-${scoreResult.range[1]}`,
        rangeLow: scoreResult.range[0],
        rangeHigh: scoreResult.range[1],
        knowledgeLevels: Object.fromEntries(
          Object.entries(scoreResult.knowledgeLevels).map(([id, data]) => [data.name, getLevelName(data.level)])
        ),
        knowledgeData: scoreResult.knowledgeLevels,
        recommendedDifficulty,
        weakKnowledgePoints,
        masteredKnowledgePoints,
        untestedKnowledgePoints,  // 新增：未测试的知识点
        // 新增：分层指导
        guidance: {
          level: guidance.level,
          diagnosis: guidance.diagnosis,
          title: guidance.title,
          message: guidance.message,
          nextActions: guidance.nextActions,
          practiceConfig: guidance.practiceConfig,
          primaryButton: guidance.primaryButton,
        },
        targetStrategy,
        nextStep: guidance.primaryButton.action,
        message: `测评完成！${guidance.message}`,
      },
    });
  } catch (error) {
    console.error('完成测评错误:', error);
    return NextResponse.json({ success: false, error: '完成失败' }, { status: 500 });
  }
}
