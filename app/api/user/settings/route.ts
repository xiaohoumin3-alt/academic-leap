import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Types for request validation
interface SettingsUpdateBody {
  selectedGrade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
}

// Validation helpers
function validateSettingsUpdate(body: unknown): body is SettingsUpdateBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { selectedGrade, selectedSubject, selectedTextbookId, studyProgress } = body as Record<string, unknown>;

  // Validate selectedGrade if provided
  if (selectedGrade !== undefined) {
    if (typeof selectedGrade !== 'number' || selectedGrade < 1 || selectedGrade > 12) {
      return false;
    }
  }

  // Validate selectedSubject if provided
  if (selectedSubject !== undefined) {
    if (typeof selectedSubject !== 'string') {
      return false;
    }
  }

  // Validate selectedTextbookId if provided
  if (selectedTextbookId !== undefined) {
    if (typeof selectedTextbookId !== 'string') {
      return false;
    }
  }

  // Validate studyProgress if provided
  if (studyProgress !== undefined) {
    if (typeof studyProgress !== 'number' || studyProgress < 0 || studyProgress > 100) {
      return false;
    }
  }

  return true;
}

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

    // 获取教材详情 - 仅当教材存在时
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
  } catch (error) {
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

    // Validate request body
    if (!validateSettingsUpdate(body)) {
      return NextResponse.json(
        { success: false, error: '无效的请求数据' },
        { status: 400 }
      );
    }

    const { selectedGrade, selectedSubject, selectedTextbookId, studyProgress } = body as SettingsUpdateBody;

    // Verify textbook exists before allowing the update (only if provided and non-empty)
    if (selectedTextbookId !== undefined && selectedTextbookId !== null && selectedTextbookId !== '') {
      const textbookExists = await prisma.textbookVersion.findUnique({
        where: { id: selectedTextbookId },
        select: { id: true }
      });

      if (!textbookExists) {
        return NextResponse.json(
          { success: false, error: '指定的教材不存在' },
          { status: 400 }
        );
      }
    }

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

    // 获取教材详情 - 仅当教材存在时
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
  } catch (error) {
    console.error('更新用户设置错误:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}
