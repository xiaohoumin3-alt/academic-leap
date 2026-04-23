import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/analytics/recalibrate/reset - 重置校准状态（测试用）
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        startingScoreCalibrated: false,
        calibratedStartingScore: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('重置校准状态错误:', error);
    return NextResponse.json({ error: '重置失败' }, { status: 500 });
  }
}
