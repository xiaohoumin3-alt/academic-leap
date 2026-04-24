import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Types for request validation
interface SettingsUpdateBody {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
}

// Validation helpers
function validateSettingsUpdate(body: unknown): body is SettingsUpdateBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { grade, selectedSubject, selectedTextbookId, studyProgress } = body as Record<string, unknown>;

  // Validate grade if provided
  if (grade !== undefined) {
    if (typeof grade !== 'number' || grade < 1 || grade > 12) {
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

    let user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        grade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    // 如果用户不存在（session有效但数据库没有记录），创建用户
    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.name || null,
            password: '', // OAuth用户没有密码
            grade: 9, // 默认年级
            targetScore: 90,
          },
          select: {
            id: true,
            email: true,
            grade: true,
            selectedSubject: true,
            selectedTextbookId: true,
            studyProgress: true,
          },
        });
      } catch (createError) {
        console.error('创建用户失败:', createError);
        return NextResponse.json(
          { success: false, error: '用户数据异常，请联系客服' },
          { status: 500 }
        );
      }
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
        grade: user.grade,
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

    const { grade, selectedSubject, selectedTextbookId, studyProgress } = body as SettingsUpdateBody;

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

    // 检查用户是否存在，不存在则创建
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    let user;
    if (!existingUser) {
      // 用户不存在，创建新用户
      user = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.name || null,
          password: '', // OAuth用户没有密码
          grade: 9, // 默认年级
          targetScore: 90,
          ...(grade !== undefined && { grade }),
          ...(selectedSubject !== undefined && { selectedSubject }),
          ...(selectedTextbookId !== undefined && { selectedTextbookId }),
          ...(studyProgress !== undefined && { studyProgress }),
        },
        select: {
          grade: true,
          selectedSubject: true,
          selectedTextbookId: true,
          studyProgress: true,
        },
      });
    } else {
      // 用户存在，更新设置
      user = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          ...(grade !== undefined && { grade }),
          ...(selectedSubject !== undefined && { selectedSubject }),
          ...(selectedTextbookId !== undefined && { selectedTextbookId }),
          ...(studyProgress !== undefined && { studyProgress }),
        },
        select: {
          grade: true,
          selectedSubject: true,
          selectedTextbookId: true,
          studyProgress: true,
        },
      });
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
        grade: user.grade,
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
