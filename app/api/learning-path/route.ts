import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // 3. Get user's current textbook for filtering
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTextbookId: true }
    });

    // Get valid knowledge points in current textbook
    let validKpIds = new Set<string>();
    if (user?.selectedTextbookId) {
      const validKps = await prisma.knowledgePoint.findMany({
        where: {
          chapter: { textbookId: user.selectedTextbookId },
          deletedAt: null
        },
        select: { id: true }
      });
      validKpIds = new Set(validKps.map(kp => kp.id));
    }

    // 4. Parse knowledgeData and filter invalid nodes
    let knowledgeNodes: Array<{
      nodeId: string;
      priority: number;
      status: string;
      addedAt: string;
      reasons: string[];
    }>;

    try {
      const allNodes = JSON.parse(activePath.knowledgeData);
      // Filter out nodes not in current textbook
      knowledgeNodes = allNodes.filter((node: { nodeId: string }) => validKpIds.has(node.nodeId));
    } catch (error) {
      return NextResponse.json(
        { error: '学习路径数据格式错误' },
        { status: 500 }
      );
    }

    if (knowledgeNodes.length === 0) {
      return NextResponse.json(
        { error: '未找到活跃的学习路径' },
        { status: 404 }
      );
    }

    // 5. Get knowledge point names for valid nodes
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
    const nameToIdMap = new Map(knowledgePoints.map((kp) => [kp.name, kp.id]));

    // 6. Batch fetch all userKnowledge records to avoid N+1 query
    const allUserKnowledge = await prisma.userKnowledge.findMany({
      where: { userId },
      select: {
        knowledgePointId: true,
        mastery: true,
      },
    });

    // Build mastery map using knowledgePointId (the new standard)
    const masteryMapById = new Map<string, number>();

    for (const uk of allUserKnowledge) {
      if (uk.knowledgePointId) {
        masteryMapById.set(uk.knowledgePointId, uk.mastery);
      }
    }

    // Fallback: Fetch latest assessment once for any missing mastery data
    // NOTE: assessment.knowledgeData stores { "knowledgePointName": level (0-4) }
    const latestAssessment = await prisma.assessment.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: 1,
      select: {
        knowledgeData: true,
      },
    });

    const assessmentMasteryMap = new Map<string, number>();
    if (latestAssessment) {
      try {
        const knowledgeData = JSON.parse(latestAssessment.knowledgeData as string);
        // knowledgeData format: { "知识点名称": level (0-4) }
        // Convert level to mastery
        const levelToMastery = (level: number): number => {
          if (level <= 0) return 0.3; // L0
          if (level === 1) return 0.55; // L1
          if (level === 2) return 0.8; // L2
          if (level === 3) return 0.95; // L3
          return 1.0; // L4
        };

        for (const [kpName, level] of Object.entries(knowledgeData)) {
          const mastery = levelToMastery(typeof level === 'number' ? level : 0);
          const kpId = nameToIdMap.get(kpName);
          if (kpId) {
            assessmentMasteryMap.set(kpId, mastery);
          }
        }
      } catch (error) {
        console.warn(
          `[learning-path] Failed to parse assessment knowledgeData for user ${userId}:`,
          error
        );
      }
    }

    // 7. Build roadmap with mastery and status
    // 使用与生成路径相同的阈值 (0.9)，确保一致性
    const MASTERY_THRESHOLD = 0.9;

    const roadmap: Array<{
      nodeId: string;
      name: string;
      status: 'completed' | 'current' | 'pending';
      mastery: number;
      priority: number;
    }> = [];

    let currentFound = false;

    for (let i = 0; i < knowledgeNodes.length; i++) {
      const node = knowledgeNodes[i];
      // Try to get mastery from userKnowledge (by ID), then fallback to assessment data
      let mastery = masteryMapById.get(node.nodeId) ?? assessmentMasteryMap.get(node.nodeId) ?? 0;
      const name = kpMap.get(node.nodeId) || '未知知识点';

      let status: 'completed' | 'current' | 'pending';
      if (mastery >= MASTERY_THRESHOLD) {
        status = 'completed';
      } else if (!currentFound) {
        // 第一个未完成的节点标记为 current
        status = 'current';
        currentFound = true;
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

    // 8. Calculate weekly summary (natural week: Monday 00:00:00 to now)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    // Calculate Monday: Sunday(0) -> -6, Monday(1) -> 0, ..., Saturday(6) -> -5
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(now.getDate() - daysToSubtract);
    startOfWeek.setHours(0, 0, 0, 0);

    // Query completed attempts since start of week with steps and question data
    const recentAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        startedAt: {
          gte: startOfWeek,
        },
        completedAt: {
          not: null, // Only count completed attempts
        },
      },
      include: {
        steps: {
          include: {
            questionStep: {
              include: {
                question: {
                  select: {
                    knowledgePoints: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Count practice attempts per knowledge point
    const knowledgePointPracticeCount = new Map<string, number>();
    for (const attempt of recentAttempts) {
      for (const step of attempt.steps) {
        if (step.questionStep?.question) {
          try {
            const kps = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
            for (const kp of kps) {
              knowledgePointPracticeCount.set(
                kp,
                (knowledgePointPracticeCount.get(kp) || 0) + 1
              );
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Filter knowledge points with >= 3 practice attempts AND in current textbook
    const practicedKnowledgePoints = Array.from(knowledgePointPracticeCount.entries())
      .filter(([kp, count]) => count >= 3 && validKpIds.has(kp))
      .map(([kp]) => kp);

    // Return unique knowledge point count (only from current textbook)
    const practicedCount = new Set(practicedKnowledgePoints).size;

    // 统计路径内已掌握的知识点（保持数据一致性）
    const masteredCount = roadmap.filter(
      (node) => node.status === 'completed'
    ).length;

    // 统计路径内待加强的知识点（pending + current）
    const weakCount = roadmap.filter(
      (node) => node.status !== 'completed'
    ).length;

    const weeklySummary = {
      practicedKnowledgePoints: practicedCount,
      masteredCount,
      weakCount,
    };

    // 8. Calculate currentIndex for path response
    const currentIndexValue = roadmap.findIndex(item => item.status === 'current');

    // 9. Return response with cache disabled
    return NextResponse.json({
      success: true,
      data: {
        path: {
          id: activePath.id,
          name: activePath.name,
          status: activePath.status,
          currentIndex: currentIndexValue >= 0 ? currentIndexValue : 0,
        },
        roadmap,
        weeklySummary,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
