import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateProgress } from '@/lib/semester';

// POST /api/user/knowledge/recommend - 智能推荐知识点
export async function POST(req: NextRequest) {
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
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

    // 计算当前进度
    const progressInfo = calculateProgress(
      user.semesterStart ? new Date(user.semesterStart) : undefined,
      user.semesterEnd ? new Date(user.semesterEnd) : undefined
    );
    const progress = progressInfo.progress;

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
    if (totalChapters === 0) {
      return NextResponse.json(
        { success: false, error: '教材没有章节' },
        { status: 400 }
      );
    }

    // 根据进度计算推荐到的章节
    const recommendIndex = Math.ceil((progress / 100) * totalChapters);
    const targetChapterIndex = Math.max(0, Math.min(recommendIndex - 1, totalChapters - 1));

    // 获取目标章节及之前章节的所有知识点
    const targetChapters = chapters.filter(c => c.chapterNumber <= chapters[targetChapterIndex].chapterNumber);
    const chapterIds = targetChapters.map(c => c.id);

    // 使用事务执行推荐
    await prisma.$transaction(async (tx) => {
      // 清除现有勾选
      await tx.userEnabledKnowledge.deleteMany({
        where: { userId: session.user.id },
      });

      // 获取知识点
      const knowledgePoints = await tx.knowledgePoint.findMany({
        where: {
          chapterId: { in: chapterIds },
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      // 批量插入
      if (knowledgePoints.length > 0) {
        await tx.userEnabledKnowledge.createMany({
          data: knowledgePoints.map(kp => ({
            userId: session.user.id,
            nodeId: kp.id,
            nodeType: 'point' as const,
          })),
        });
      }
    });

    const enabledCount = await prisma.userEnabledKnowledge.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        progress,
        progressMessage: progressInfo.message,
        recommendedChapterName: chapters[targetChapterIndex].chapterName,
        enabledCount,
        totalChapters: targetChapters.length,
        executed: true,
      }
    });
  } catch (error: unknown) {
    console.error('智能推荐错误:', error);
    return NextResponse.json(
      { success: false, error: '推荐失败' },
      { status: 500 }
    );
  }
}
