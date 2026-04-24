import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Types for request validation
interface RecommendBody {
  overwrite?: boolean;
}

// Validation helper
function validateRecommendBody(body: unknown): body is RecommendBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { overwrite } = body as Record<string, unknown>;

  // overwrite is optional boolean
  if (overwrite !== undefined && typeof overwrite !== 'boolean') {
    return false;
  }

  return true;
}

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

    const body = await req.json();

    // Validate request body
    if (!validateRecommendBody(body)) {
      return NextResponse.json(
        { success: false, error: '请求参数错误' },
        { status: 400 }
      );
    }

    const { overwrite = false } = body;

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

    // 根据进度计算推荐到的章节
    const recommendIndex = Math.ceil((progress / 100) * totalChapters);
    const recommendedChapter = chapters[Math.min(recommendIndex, totalChapters) - 1];

    if (!recommendedChapter) {
      return NextResponse.json(
        { success: false, error: '无可用章节' },
        { status: 404 }
      );
    }

    // 如果不覆盖，先检查是否已有勾选
    if (!overwrite) {
      const existingCount = await prisma.userEnabledKnowledge.count({
        where: { userId: session.user.id },
      });
      if (existingCount > 0) {
        // 返回推荐但不执行
        return NextResponse.json({
          success: true,
          data: {
            recommendedChapterId: recommendedChapter.id,
            recommendedChapterName: recommendedChapter.chapterName,
            progress,
            enabledCount: existingCount,
            executed: false,
          }
        });
      }
    }

    // 获取推荐章节及之前章节的所有知识点
    const targetChapters = chapters.filter(c => c.chapterNumber <= recommendedChapter.chapterNumber);
    const chapterIds = targetChapters.map(c => c.id);

    // 使用事务确保删除和插入操作的原子性
    await prisma.$transaction(async (tx) => {
      // 清除现有勾选（如果覆盖）
      if (overwrite) {
        await tx.userEnabledKnowledge.deleteMany({
          where: { userId: session.user.id },
        });
      }

      const knowledgePoints = await tx.knowledgePoint.findMany({
        where: {
          chapterId: { in: chapterIds },
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      // 批量插入 - SQLite 兼容性处理
      // SQLite 不支持 skipDuplicates，使用事务 + 查询现有记录
      const existingRecords = await tx.userEnabledKnowledge.findMany({
        where: {
          userId: session.user.id,
          nodeId: { in: knowledgePoints.map(kp => kp.id) },
        },
        select: { nodeId: true },
      });

      const existingNodeIds = new Set(existingRecords.map(r => r.nodeId));
      const newRecords = knowledgePoints
        .filter(kp => !existingNodeIds.has(kp.id))
        .map(kp => ({
          userId: session.user.id,
          nodeId: kp.id,
          nodeType: 'point' as const,
        }));

      if (newRecords.length > 0) {
        await tx.userEnabledKnowledge.createMany({
          data: newRecords,
        });
      }
    });

    const enabledCount = await prisma.userEnabledKnowledge.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendedChapterId: recommendedChapter.id,
        recommendedChapterName: recommendedChapter.chapterName,
        progress,
        enabledCount,
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
