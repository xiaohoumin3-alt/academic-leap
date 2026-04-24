import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/settings - 获取用户设置
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // 获取教材详情
    let selectedTextbook = null;
    if (user.selectedTextbookId) {
      const textbook = await prisma.textbookVersion.findUnique({
        where: { id: user.selectedTextbookId },
        select: { id: true, name: true, year: true }
      });
      selectedTextbook = textbook;
    }

    return NextResponse.json({
      success: true,
      data: {
        selectedGrade: user.selectedGrade,
        selectedSubject: user.selectedSubject,
        selectedTextbookId: user.selectedTextbookId,
        selectedTextbook,
        studyProgress: user.studyProgress ?? 0,
      }
    });
  } catch (error: any) {
    console.error('获取用户设置错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

// PUT /api/user/settings - 更新用户设置
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { selectedGrade, selectedSubject, selectedTextbookId, studyProgress } = body;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(selectedGrade !== undefined && { selectedGrade }),
        ...(selectedSubject !== undefined && { selectedSubject }),
        ...(selectedTextbookId !== undefined && { selectedTextbookId }),
        ...(studyProgress !== undefined && { studyProgress }),
      },
      select: {
        selectedGrade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        selectedGrade: user.selectedGrade,
        selectedSubject: user.selectedSubject,
        selectedTextbookId: user.selectedTextbookId,
        studyProgress: user.studyProgress ?? 0,
      }
    });
  } catch (error: any) {
    console.error('更新用户设置错误:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}
