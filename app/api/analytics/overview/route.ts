import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/analytics/overview - 学习概览数据
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取已完成练习次数（不管得分是多少，只要是完成的练习就算一次）
    const totalAttempts = await prisma.attempt.count({
      where: { userId, completedAt: { not: null } },
    });

    // 获取有效练习次数（已完成且有分数的，用于计算平均分）
    const completedAttempts = await prisma.attempt.count({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 },
      },
    });

    // 获取平均分数（只计算有效完成记录，score > 0）
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 }, // 只计算有分数的记录，过滤无效数据
      },
      select: { score: true },
    });

    const averageScore =
      attempts.length > 0
        ? attempts.reduce(
            (sum: number, a: { score: number }) => sum + a.score,
            0,
          ) / attempts.length
        : 0;

    // 获取总练习时长（分钟）
    const totalDuration = await prisma.attempt.aggregate({
      where: {
        userId,
        completedAt: { not: null },
      },
      _sum: { duration: true },
    });

    const totalMinutes = Math.floor((totalDuration._sum.duration || 0) / 60);

    // 获取最近7天的练习记录
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { gte: sevenDaysAgo },
        score: { gt: 0 },
      },
      select: {
        id: true,
        score: true,
        duration: true,
        completedAt: true,
      },
      orderBy: { completedAt: "desc" },
    });

    // 计算数据可信度（根据有效练习次数）
    const dataReliability =
      totalAttempts >= 10 ? "high" : totalAttempts >= 5 ? "medium" : "low";

    // 计算历史最低分作为起始分
    const allScores = attempts.map((a: { score: number }) => a.score);
    const lowestScore =
      allScores.length > 1 ? Math.min(...allScores) : averageScore;

    // 计算波动范围（最近5次成绩的标准差）
    const recent5Scores = recentAttempts
      .slice(0, 5)
      .map((a: { score: number }) => a.score);
    let volatilityRange = 0;
    if (recent5Scores.length > 1) {
      const mean =
        recent5Scores.reduce((a: number, b: number) => a + b, 0) /
        recent5Scores.length;
      volatilityRange = Math.round(
        Math.sqrt(
          recent5Scores.reduce(
            (sum: number, s: number) => sum + Math.pow(s - mean, 2),
            0,
          ) / recent5Scores.length,
        ),
      );
    }

    // 计算每日练习数据
    const dailyData = Array.from({ length: 7 }, (_: unknown, i: number) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split("T")[0];

      const dayAttempts = recentAttempts.filter(
        (a) => a.completedAt?.toISOString().split("T")[0] === dateStr,
      );

      return {
        date: dateStr,
        count: dayAttempts.length,
        avgScore:
          dayAttempts.length > 0
            ? dayAttempts.reduce(
                (sum: number, a: { score: number }) => sum + a.score,
                0,
              ) / dayAttempts.length
            : 0,
      };
    });

    // 获取知识点掌握度
    const knowledge = await prisma.userKnowledge.findMany({
      where: { userId },
      orderBy: { mastery: "desc" },
      take: 5,
    });

    // 获取用户初始测评状态
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        initialAssessmentCompleted: true,
        initialAssessmentScore: true,
        startingScoreCalibrated: true,
        calibratedStartingScore: true,
        selectedTextbookId: true,  // 新增：用于判断是否需要 onboarding
      },
    });

    // 获取诊断测评记录（按时间排序）
    const diagnosticAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 },
        mode: 'diagnostic',
      },
      select: {
        id: true,
        score: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'asc' },
    });

    // 获取练习记录统计（只统计 training 模式）
    const trainingAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 },
        mode: 'training',
      },
      select: { score: true },
    });

    const trainingAvgScore = trainingAttempts.length > 0
      ? Math.round(trainingAttempts.reduce((sum: number, a: { score: number }) => sum + a.score, 0) / trainingAttempts.length)
      : 0;

    // 获取练习模式 attempt IDs（用于统计练习专用数据）
    const trainingAttemptIds = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        mode: 'training',
      },
      select: { id: true },
    });

    const trainingAttemptIdList = trainingAttemptIds.map((a) => a.id);

    // 检测是否需要校准
    let needsCalibration = false;
    let calibratedStartingScore: number | null = null;

    // 条件：最低分 < 平均分 - 50，且记录数 >= 5
    if (totalAttempts >= 5 && lowestScore < averageScore - 50) {
      // 计算校准后的起始分（删除所有重复的最低分，只保留第一个）
      const scoresCopy = [...allScores];
      // 从后往前删除所有最低分，保留第一个
      for (let i = scoresCopy.length - 1; i >= 0; i--) {
        if (scoresCopy[i] === lowestScore) {
          scoresCopy.splice(i, 1);
        }
      }
      const newStartingScore = scoresCopy.length > 0 ? Math.min(...scoresCopy) : lowestScore;

      // 只有当新起始分确实更高时，才提示校准
      if (newStartingScore > lowestScore) {
        needsCalibration = !user?.startingScoreCalibrated;
        calibratedStartingScore = newStartingScore;
      }
    }

    // 如果已校准，使用存储的值
    if (user?.startingScoreCalibrated && user?.calibratedStartingScore) {
      calibratedStartingScore = user.calibratedStartingScore;
    }

    // 获取全部答题统计（所有练习的所有 steps）- 用于"我的"页显示
    // 先获取已完成的 attempt IDs
    const completedAttemptIds = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
      },
      select: { id: true },
    });

    const attemptIds = completedAttemptIds.map((a) => a.id);

    // 使用 attemptId 过滤，避免嵌套关系查询
    const allStepsCount = await prisma.attemptStep.count({
      where: {
        attemptId: { in: attemptIds },
      },
    });

    const correctStepsCount = await prisma.attemptStep.count({
      where: {
        attemptId: { in: attemptIds },
        isCorrect: true,
      },
    });

    const correctRate = allStepsCount > 0 ? Math.round((correctStepsCount / allStepsCount) * 100) : 0;

    // 练习专用统计（只统计 training 模式）
    const trainingQuestionsCount = trainingAttemptIdList.length > 0
      ? await prisma.attemptStep.count({
          where: { attemptId: { in: trainingAttemptIdList } },
        })
      : 0;

    const trainingCorrectStepsCount = trainingAttemptIdList.length > 0
      ? await prisma.attemptStep.count({
          where: {
            attemptId: { in: trainingAttemptIdList },
            isCorrect: true,
          },
        })
      : 0;

    const trainingCorrectRate = trainingQuestionsCount > 0
      ? Math.round((trainingCorrectStepsCount / trainingQuestionsCount) * 100)
      : 0;

    const trainingDuration = await prisma.attempt.aggregate({
      where: {
        userId,
        completedAt: { not: null },
        mode: 'training',
      },
      _sum: { duration: true },
    });

    const trainingMinutes = Math.floor((trainingDuration._sum.duration || 0) / 60);

    return NextResponse.json({
      overview: {
        totalAttempts,
        completedAttempts,
        averageScore: Math.round(averageScore),
        lowestScore: Math.round(lowestScore),
        totalMinutes,
        completionRate:
          totalAttempts > 0
            ? Math.round((completedAttempts / totalAttempts) * 100)
            : 0,
        dataReliability,
        volatilityRange,
        initialAssessmentCompleted: user?.initialAssessmentCompleted ?? false,
        initialAssessmentScore: user?.initialAssessmentScore ?? 0,
        // 新增字段
        needsCalibration,
        calibratedStartingScore,
        startingScoreCalibrated: user?.startingScoreCalibrated ?? false,
        // 用于"我的"页的统计
        totalQuestions: allStepsCount,
        correctRate,
        // 用于判断是否需要 onboarding
        selectedTextbookId: user?.selectedTextbookId ?? null,
        // 新增字段
        diagnosticAttempts: diagnosticAttempts.map((a) => ({
          id: a.id,
          score: a.score,
          completedAt: a.completedAt?.toISOString(),
        })),
        trainingAvgScore,
        trainingCount: trainingAttempts.length,
        // 练习专用统计
        trainingQuestions: trainingQuestionsCount,
        trainingCorrectRate,
        trainingMinutes,
      },
      dailyData,
      topKnowledge: knowledge.map(
        (k: { knowledgePoint: string; mastery: number }) => ({
          knowledgePoint: k.knowledgePoint,
          mastery: Math.round(k.mastery * 100),
        }),
      ),
    });
  } catch (error) {
    console.error("获取概览数据错误:", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
