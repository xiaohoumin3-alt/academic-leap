import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inferDefaultSemester, parseDateInput } from '@/lib/semester';

// Types for request validation
interface SettingsUpdateBody {
  grade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;  // 保留兼容性
  semesterStart?: string;  // YYYY-MM-DD 格式
  semesterEnd?: string;    // YYYY-MM-DD 格式
}

// Validation helpers
function validateSettingsUpdate(body: unknown): body is SettingsUpdateBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { grade, selectedSubject, selectedTextbookId, studyProgress, semesterStart, semesterEnd } = body as Record<string, unknown>;

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

  // Validate semester dates if provided
  if (semesterStart !== undefined) {
    if (typeof semesterStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semesterStart)) {
      return false;
    }
  }

  if (semesterEnd !== undefined) {
    if (typeof semesterEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semesterEnd)) {
      return false;
    }
  }

  // 如果同时提供，验证结束日期晚于开始日期
  if (semesterStart && semesterEnd) {
    const start = new Date(semesterStart);
    const end = new Date(semesterEnd);
    if (end <= start) {
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
        semesterStart: true,
        semesterEnd: true,
      },
    });

    // 如果用户不存在（session有效但数据库没有记录），创建用户
    if (!user) {
      try {
        const defaultSemester = inferDefaultSemester();
        user = await prisma.user.create({
          data: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.name || null,
            password: '', // OAuth用户没有密码
            grade: 9, // 默认年级
            targetScore: 90,
            semesterStart: defaultSemester.start,
            semesterEnd: defaultSemester.end,
          },
          select: {
            id: true,
            email: true,
            grade: true,
            selectedSubject: true,
            selectedTextbookId: true,
            studyProgress: true,
            semesterStart: true,
            semesterEnd: true,
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
        semesterStart: user.semesterStart?.toISOString(),
        semesterEnd: user.semesterEnd?.toISOString(),
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

    const { grade, selectedSubject, selectedTextbookId, studyProgress, semesterStart, semesterEnd } = body as SettingsUpdateBody;

    // 处理学期日期
    let parsedStart: Date | undefined;
    let parsedEnd: Date | undefined;

    if (semesterStart) {
      parsedStart = parseDateInput(semesterStart);
      if (!parsedStart) {
        return NextResponse.json(
          { success: false, error: '无效的开始日期格式' },
          { status: 400 }
        );
      }
    }

    if (semesterEnd) {
      parsedEnd = parseDateInput(semesterEnd);
      if (!parsedEnd) {
        return NextResponse.json(
          { success: false, error: '无效的结束日期格式' },
          { status: 400 }
        );
      }
    }

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
      const defaultSemester = inferDefaultSemester();
      user = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.name || null,
          password: '', // OAuth用户没有密码
          grade: 9, // 默认年级
          targetScore: 90,
          semesterStart: defaultSemester.start,
          semesterEnd: defaultSemester.end,
          ...(grade !== undefined && { grade }),
          ...(selectedSubject !== undefined && { selectedSubject }),
          ...(selectedTextbookId !== undefined && { selectedTextbookId }),
          ...(studyProgress !== undefined && { studyProgress }),
          ...(parsedStart && { semesterStart: parsedStart }),
          ...(parsedEnd && { semesterEnd: parsedEnd }),
        },
        select: {
          grade: true,
          selectedSubject: true,
          selectedTextbookId: true,
          studyProgress: true,
          semesterStart: true,
          semesterEnd: true,
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
          ...(parsedStart && { semesterStart: parsedStart }),
          ...(parsedEnd && { semesterEnd: parsedEnd }),
        },
        select: {
          grade: true,
          selectedSubject: true,
          selectedTextbookId: true,
          studyProgress: true,
          semesterStart: true,
          semesterEnd: true,
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
        semesterStart: user.semesterStart?.toISOString(),
        semesterEnd: user.semesterEnd?.toISOString(),
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
