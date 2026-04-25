import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/user/knowledge-tree - 获取知识点树
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const expand = searchParams.get('expand') === 'true';

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

    // 如果用户不存在，创建用户
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

    if (!user.selectedTextbookId) {
      return NextResponse.json(
        { success: false, error: '用户未设置教材' },
        { status: 400 }
      );
    }

    // 获取教材信息
    const textbook = await prisma.textbookVersion.findUnique({
      where: { id: user.selectedTextbookId },
      select: {
        id: true,
        name: true,
        grade: true,
        subject: true,
      },
    });

    if (!textbook) {
      return NextResponse.json(
        { success: false, error: '教材不存在' },
        { status: 404 }
      );
    }

    // 获取用户已勾选的知识点
    const enabledKnowledge = await prisma.userEnabledKnowledge.findMany({
      where: {
        userId: session.user.id,
        nodeType: 'point',
      },
      select: { nodeId: true },
    });
    const enabledIds = new Set(enabledKnowledge.map(k => k.nodeId));

    // 获取章节
    let chapters = await prisma.chapter.findMany({
      where: { textbookId: user.selectedTextbookId },
      orderBy: { chapterNumber: 'asc' },
      include: {
        knowledgePoints: {
          where: { deletedAt: null, inAssess: true },
          include: {
            concept: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // 如果不展开，按进度裁剪（progress=0时显示所有章节，避免只显示空章节）
    if (!expand && user.studyProgress !== undefined && user.studyProgress > 0 && user.studyProgress < 100) {
      const totalChapters = chapters.length;
      const maxChapterIndex = Math.ceil((user.studyProgress / 100) * totalChapters);
      chapters = chapters.slice(0, maxChapterIndex + 1);
    }

    // 构建响应数据
    const chaptersData = chapters.map(chapter => {
      const chapterEnabled = chapter.knowledgePoints.every(kp => enabledIds.has(kp.id));
      return {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        chapterName: chapter.chapterName,
        enabled: chapterEnabled,
        knowledgePoints: chapter.knowledgePoints.map(kp => ({
          id: kp.id,
          name: kp.name,
          conceptId: kp.concept.id,
          conceptName: kp.concept.name,
          enabled: enabledIds.has(kp.id),
        })),
      };
    });

    const allKnowledgePoints = await prisma.knowledgePoint.count({
      where: {
        chapter: { textbookId: user.selectedTextbookId },
        deletedAt: null,
        inAssess: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        textbook,
        chapters: chaptersData,
        enabledCount: enabledIds.size,
        totalCount: allKnowledgePoints,
      }
    });
  } catch (error: unknown) {
    console.error('获取知识点树错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
