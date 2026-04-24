import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserMastery } from '@/lib/learning-path/priority';

/**
 * GET /api/learning-path
 *
 * 获取用户当前的学习路径和进度概览
 *
 * Returns:
 * - path: 活跃路径信息
 * - roadmap: 知识点路径节点数组（含状态、掌握度、优先级）
 * - weeklySummary: 本周学习统计（练习次数、掌握数、待加强数）
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Require authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Type guard for user ID
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      );
    }

    // 2. Get active learning path (latest by generatedAt)
    const activePath = await prisma.learningPath.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        generatedAt: 'desc',
      },
    });

    if (!activePath) {
      return NextResponse.json(
        { error: '未找到活跃的学习路径' },
        { status: 404 }
      );
    }

    // 3. Parse knowledgeData
    let knowledgeNodes: Array<{
      nodeId: string;
      priority: number;
      status: string;
      addedAt: string;
      reasons: string[];
    }>;

    try {
      knowledgeNodes = JSON.parse(activePath.knowledgeData);
    } catch (error) {
      return NextResponse.json(
        { error: '学习路径数据格式错误' },
        { status: 500 }
      );
    }

    // 4. Get knowledge point names for all nodes
    const nodeIds = knowledgeNodes.map((node) => node.nodeId);
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        id: { in: nodeIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const kpMap = new Map(knowledgePoints.map((kp) => [kp.id, kp.name]));

    // 5. Build roadmap with mastery and status
    const roadmap: Array<{
      nodeId: string;
      name: string;
      status: 'completed' | 'current' | 'pending';
      mastery: number;
      priority: number;
    }> = [];

    let currentIndex = 0;

    for (let i = 0; i < knowledgeNodes.length; i++) {
      const node = knowledgeNodes[i];
      const mastery = await getUserMastery(userId, node.nodeId);
      const name = kpMap.get(node.nodeId) || '未知知识点';

      let status: 'completed' | 'current' | 'pending';
      if (mastery >= 0.8) {
        status = 'completed';
      } else if (currentIndex === 0) {
        status = 'current';
        currentIndex = i;
      } else {
        status = 'pending';
      }

      roadmap.push({
        nodeId: node.nodeId,
        name,
        status,
        mastery,
        priority: node.priority,
      });
    }

    // 6. Calculate weekly summary
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Count practiced attempts in last 7 days
    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        startedAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        startedAt: true,
      },
    });

    const practicedCount = recentAttempts.length;

    // Count mastered knowledge points (mastery >= 0.8) in last 7 days
    const recentUserKnowledge = await prisma.userKnowledge.findMany({
      where: {
        userId,
        lastPractice: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        mastery: true,
        lastPractice: true,
      },
    });

    const masteredCount = recentUserKnowledge.filter(
      (uk) => uk.mastery >= 0.8
    ).length;

    // Count weak (pending + current) nodes - all non-completed nodes
    const weakCount = roadmap.filter(
      (node) => node.status !== 'completed'
    ).length;

    const weeklySummary = {
      practicedCount,
      masteredCount,
      weakCount,
    };

    // 7. Return response
    return NextResponse.json({
      success: true,
      data: {
        path: {
          id: activePath.id,
          name: activePath.name,
          status: activePath.status,
          currentIndex,
        },
        roadmap,
        weeklySummary,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '获取学习路径失败', details: errorMessage },
      { status: 500 }
    );
  }
}
