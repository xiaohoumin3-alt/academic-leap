import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateProgress } from '@/lib/semester';

// GET /api/user/progress - 获取用户进度计算
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
        selectedSubject: true,
        selectedTextbookId: true,
        semesterStart: true,
        semesterEnd: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      console.error('[Progress API] User missing textbook:', {
        userId: session.user.id,
        hasUser: !!user,
        selectedTextbookId: user?.selectedTextbookId,
        selectedSubject: user?.selectedSubject,
      });
      return NextResponse.json(
        {
          success: false,
          error: '用户未设置教材',
          errorCode: 'TEXTBOOK_NOT_SET',
          setupUrl: '/setup',
        },
        { status: 400 }
      );
    }

    // 验证日期格式
    const semesterStart = user.semesterStart ? new Date(user.semesterStart) : undefined;
    const semesterEnd = user.semesterEnd ? new Date(user.semesterEnd) : undefined;

    if (semesterStart && isNaN(semesterStart.getTime())) {
      console.error('[Progress API] Invalid semesterStart:', user.semesterStart);
      return NextResponse.json(
        { success: false, error: '学期开始日期无效', errorCode: 'INVALID_DATE' },
        { status: 400 }
      );
    }

    if (semesterEnd && isNaN(semesterEnd.getTime())) {
      console.error('[Progress API] Invalid semesterEnd:', user.semesterEnd);
      return NextResponse.json(
        { success: false, error: '学期结束日期无效', errorCode: 'INVALID_DATE' },
        { status: 400 }
      );
    }

    // 计算基于时间的进度
    const progressInfo = calculateProgress(semesterStart, semesterEnd);

    // 获取教材的所有章节
    const chapters = await prisma.chapter.findMany({
      where: { textbookId: user.selectedTextbookId },
      orderBy: { chapterNumber: 'asc' },
      select: {
        id: true,
        chapterNumber: true,
        chapterName: true,
      },
    });

    const totalChapters = chapters.length;
    const progress = progressInfo.progress;

    // 根据进度计算当前章节
    const currentChapterIndex = Math.floor((progress / 100) * totalChapters);
    const currentChapter = chapters[Math.min(currentChapterIndex, totalChapters - 1)];
    const completedChapters = Math.min(currentChapterIndex, totalChapters - 1);

    // 统计知识点数量
    const allKnowledgePoints = await prisma.knowledgePoint.count({
      where: {
        chapter: { textbookId: user.selectedTextbookId },
        deletedAt: null,
        inAssess: true,
      },
    });

    const enabledKnowledgeCount = await prisma.userEnabledKnowledge.count({
      where: {
        userId: session.user.id,
        nodeType: 'point',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        currentChapter: currentChapter ? {
          id: currentChapter.id,
          chapterNumber: currentChapter.chapterNumber,
          chapterName: currentChapter.chapterName,
        } : null,
        progress,
        progressMessage: progressInfo.message,
        completedChapters,
        totalChapters,
        enabledKnowledgeCount,
        totalKnowledgeCount: allKnowledgePoints,
      }
    });
  } catch (error: unknown) {
    console.error('获取用户进度错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
