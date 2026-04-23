import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/analytics/recalibrate - 执行起始分校准
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取所有有效成绩
    const attempts = await prisma.attempt.findMany({
      where: {
        userId,
        completedAt: { not: null },
        score: { gt: 0 },
      },
      select: { score: true },
      orderBy: { completedAt: 'asc' },
    });

    if (attempts.length < 5) {
      return NextResponse.json({ error: '练习记录不足，无法校准' }, { status: 400 });
    }

    const allScores = attempts.map((a) => a.score);
    const oldStartingScore = Math.min(...allScores);

    // 计算新起始分：删除所有重复的最低分，只保留第一个
    const scoresCopy = [...allScores];
    // 从后往前删除所有最低分，保留第一个
    for (let i = scoresCopy.length - 1; i >= 0; i--) {
      if (scoresCopy[i] === oldStartingScore) {
        scoresCopy.splice(i, 1);
      }
    }
    const newStartingScore = scoresCopy.length > 0 ? Math.min(...scoresCopy) : oldStartingScore;

    // 更新用户校准状态
    await prisma.user.update({
      where: { id: userId },
      data: {
        startingScoreCalibrated: true,
        calibratedStartingScore: newStartingScore,
      },
    });

    return NextResponse.json({
      success: true,
      newStartingScore,
      oldStartingScore,
    });
  } catch (error) {
    console.error('校准起始分错误:', error);
    return NextResponse.json({ error: '校准失败' }, { status: 500 });
  }
}
