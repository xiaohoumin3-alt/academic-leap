import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/learning-path/history
 *
 * 获取用户的学习路径历史列表，支持对比进步趋势
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Require authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user session' }, { status: 401 });
    }

    // 2. Get all paths (both active and archived)
    const allPaths = await prisma.learningPath.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        generatedAt: true,
        knowledgeData: true,
      },
    });

    if (allPaths.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          paths: [],
          comparison: null,
        },
      });
    }

    // 3. Process each path to extract summary info
    const pathsWithSummary = allPaths.map((path) => {
      let totalNodes = 0;
      let initialWeakCount = 0;

      try {
        const nodes = JSON.parse(path.knowledgeData as string);
        totalNodes = nodes.length;
        initialWeakCount = nodes.filter((n: { priority: number }) => n.priority >= 7).length;
      } catch {
        // Ignore parse errors
      }

      return {
        id: path.id,
        name: path.name,
        type: path.type,
        status: path.status,
        generatedAt: path.generatedAt,
        completedAt: path.status === 'completed' ? path.generatedAt : null,
        snapshot: {
          totalNodes,
          initialWeakCount,
        },
        result: path.status === 'completed' ? {
          finalMastery: 0.9, // Placeholder - would require additional mastery queries
          daysSpent: 7, // Placeholder - would require tracking actual activation time
        } : null,
      };
    });

    // 4. Calculate comparison statistics
    const completedPaths = pathsWithSummary.filter((p) => p.status === 'completed');
    const avgDaysToComplete =
      completedPaths.length > 0
        ? completedPaths.reduce((sum, p) => sum + (p.result?.daysSpent || 0), 0) / completedPaths.length
        : 0;

    const bestPath = completedPaths.length > 0
      ? completedPaths.reduce((best, current) => {
          return (current.result?.finalMastery || 0) > (best.result?.finalMastery || 0) ? current : best;
        })
      : null;

    // Calculate improvement trend (compare first and latest completed paths)
    let improvementTrend: 'up' | 'down' | 'stable' = 'stable';
    if (completedPaths.length >= 2) {
      const latest = completedPaths[0];
      const first = completedPaths[completedPaths.length - 1];
      const latestMastery = latest.result?.finalMastery || 0;
      const firstMastery = first.result?.finalMastery || 0;

      if (latestMastery > firstMastery + 0.05) {
        improvementTrend = 'up';
      } else if (latestMastery < firstMastery - 0.05) {
        improvementTrend = 'down';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        paths: pathsWithSummary,
        comparison: {
          avgDaysToComplete: Math.round(avgDaysToComplete),
          bestPath: bestPath?.id || null,
          improvementTrend,
          totalPaths: allPaths.length,
          completedPaths: completedPaths.length,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '获取路径历史失败', details: errorMessage },
      { status: 500 }
    );
  }
}
