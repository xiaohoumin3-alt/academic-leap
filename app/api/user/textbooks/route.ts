import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/textbooks - 获取可用教材列表
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const grade = searchParams.get('grade');
    const subject = searchParams.get('subject');

    const textbooks = await prisma.textbookVersion.findMany({
      where: {
        ...(grade && { grade: parseInt(grade) }),
        ...(subject && { subject }),
      },
      orderBy: [{ grade: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        grade: true,
        subject: true,
        year: true,
        publisher: true,
        _count: {
          select: { chapters: true },
        },
      },
    });

    // 获取唯一的年级和科目列表用于筛选
    const [grades, subjects] = await Promise.all([
      prisma.textbookVersion.findMany({
        distinct: ['grade'],
        orderBy: { grade: 'asc' },
        select: { grade: true },
      }),
      prisma.textbookVersion.findMany({
        distinct: ['subject'],
        select: { subject: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        textbooks,
        grades: grades.map(g => g.grade),
        subjects: subjects.map(s => s.subject),
      },
    });
  } catch (error) {
    console.error('获取教材列表错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
