import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Types for request validation
interface ToggleKnowledgeBody {
  nodeId: string;
  nodeType: 'chapter' | 'point';
  enabled: boolean;
  cascade?: boolean;
}

// Validation helper
function validateToggleBody(body: unknown): body is ToggleKnowledgeBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const { nodeId, nodeType, enabled, cascade } = body as Record<string, unknown>;

  // Validate nodeId
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return false;
  }

  // Validate nodeType
  if (nodeType !== 'chapter' && nodeType !== 'point') {
    return false;
  }

  // Validate enabled
  if (typeof enabled !== 'boolean') {
    return false;
  }

  // cascade is optional boolean
  if (cascade !== undefined && typeof cascade !== 'boolean') {
    return false;
  }

  return true;
}

// POST /api/user/knowledge/toggle - 勾选/取消知识点或章节
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
    if (!validateToggleBody(body)) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const { nodeId, nodeType, enabled, cascade = false } = body;

    let affectedCount = 0;

    if (nodeType === 'chapter' && cascade) {
      // 章节级联：先验证章节存在
      const chapter = await prisma.chapter.findUnique({
        where: { id: nodeId },
        select: { id: true },
      });

      if (!chapter) {
        return NextResponse.json(
          { success: false, error: '章节不存在' },
          { status: 404 }
        );
      }

      // 获取章节下所有知识点
      const knowledgePoints = await prisma.knowledgePoint.findMany({
        where: {
          chapterId: nodeId,
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      if (knowledgePoints.length === 0) {
        return NextResponse.json({
          success: true,
          data: { affectedCount: 0 }
        });
      }

      const pointIds = knowledgePoints.map((kp) => kp.id);

      if (enabled) {
        // 批量创建：使用 createMany with skipDuplicates
        await prisma.userEnabledKnowledge.createMany({
          data: pointIds.map((id) => ({
            userId: session.user.id,
            nodeId: id,
            nodeType: 'point' as const,
          })),
          skipDuplicates: true,
        });
        affectedCount = pointIds.length;
      } else {
        // 批量删除
        const deleteResult = await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId: session.user.id,
            nodeId: { in: pointIds },
          },
        });
        affectedCount = deleteResult.count;
      }
    } else {
      // 单节点操作
      if (enabled) {
        await prisma.userEnabledKnowledge.upsert({
          where: {
            userId_nodeId: {
              userId: session.user.id,
              nodeId,
            },
          },
          create: {
            userId: session.user.id,
            nodeId,
            nodeType,
          },
          update: {},
        });
        affectedCount = 1;
      } else {
        const deleteResult = await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId: session.user.id,
            nodeId,
          },
        });
        affectedCount = deleteResult.count;
      }
    }

    return NextResponse.json({
      success: true,
      data: { affectedCount }
    });
  } catch (error: unknown) {
    console.error('知识点勾选错误:', error);
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    );
  }
}
