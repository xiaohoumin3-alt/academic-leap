import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
        grade: true,
        selectedSubject: true,
        selectedTextbookId: true,
        studyProgress: true,
      },
    });

    if (!user || !user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

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
    const progress = user.studyProgress ?? 0;

    // 根据进度计算当前章节
    const currentChapterIndex = Math.floor((progress / 100) * totalChapters);
    const currentChapter = chapters[Math.min(currentChapterIndex, totalChapters - 1)];
    const completedChapters = Math.min(currentChapterIndex, totalChapters);

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
