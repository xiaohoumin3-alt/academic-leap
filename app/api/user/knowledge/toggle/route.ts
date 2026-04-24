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
      // 章节级联：获取章节下所有知识点
      const knowledgePoints = await prisma.knowledgePoint.findMany({
        where: {
          chapterId: nodeId,
          deletedAt: null,
          inAssess: true,
        },
        select: { id: true },
      });

      // 批量操作知识点
      if (enabled) {
        // 批量创建（使用 upsert 处理重复）
        for (const kp of knowledgePoints) {
          await prisma.userEnabledKnowledge.upsert({
            where: {
              userId_nodeId: {
                userId: session.user.id,
                nodeId: kp.id,
              },
            },
            create: {
              userId: session.user.id,
              nodeId: kp.id,
              nodeType: 'point',
            },
            update: {},
          });
        }
      } else {
        // 批量删除
        await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId: session.user.id,
            nodeId: {
              in: knowledgePoints.map((kp) => kp.id),
            },
          },
        });
      }
      affectedCount = knowledgePoints.length;
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
      } else {
        await prisma.userEnabledKnowledge.deleteMany({
          where: {
            userId: session.user.id,
            nodeId,
          },
        });
      }
      affectedCount = 1;
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
