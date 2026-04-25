/**
 * Learning Path Weekly Report API
 *
 * GET /api/learning-path/weekly-report
 *
 * Returns weekly learning report with stats and stale knowledge detection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const STALE_DAYS_THRESHOLD = 14;
const STALE_MASTERY_THRESHOLD = 0.7;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // Calculate week date range
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Get this week's practice records
    const weeklyAttempts = await prisma.attempt.findMany({
      where: {
        userId: session.user.id,
        startedAt: { gte: weekStart }
      },
      include: {
        steps: {
          include: {
            questionStep: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    // Count unique knowledge points practiced (will be filtered later)
    const allPracticedKnowledgeIds = new Set<string>();
    for (const attempt of weeklyAttempts) {
      for (const step of attempt.steps) {
        if (step.questionStep?.question) {
          try {
            const kps = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
            kps.forEach((kp: string) => allPracticedKnowledgeIds.add(kp));
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Get user's current textbook
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { selectedTextbookId: true }
    });

    // Get all knowledge points in the current textbook (for filtering)
    let textbookKpIds: Set<string> = new Set();
    if (user?.selectedTextbookId) {
      const textbookKps = await prisma.knowledgePoint.findMany({
        where: {
          chapter: { textbookId: user.selectedTextbookId },
          deletedAt: null
        },
        select: { id: true }
      });
      textbookKpIds = new Set(textbookKps.map(kp => kp.id));
    }

    // Count unique knowledge points practiced (only in current textbook)
    const practicedCount = textbookKpIds.size > 0
      ? [...allPracticedKnowledgeIds].filter(id => textbookKpIds.has(id)).length
      : allPracticedKnowledgeIds.size;

    // Count knowledge points mastered this week (only in current textbook)
    const masteredThisWeek = await prisma.userKnowledge.count({
      where: {
        userId: session.user.id,
        mastery: { gte: 0.8 },
        lastPractice: { gte: weekStart },
        // Filter: only count knowledge points in current textbook
        knowledgePointId: user?.selectedTextbookId ? { in: [...textbookKpIds] } : undefined
      }
    });

    // Get active path
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    let weakCount = 0;
    let staleKnowledge: Array<{
      nodeId: string;
      name: string;
      lastPractice: string;
      mastery: number;
    }> = [];

    if (path) {
      const allNodes = JSON.parse(path.knowledgeData as string);
      // Filter nodes to only include those in current textbook
      const nodes = textbookKpIds.size > 0
        ? allNodes.filter((n: { nodeId: string }) => textbookKpIds.has(n.nodeId))
        : allNodes;

      if (nodes.length === 0) {
        weakCount = 0;
      } else {
        // 根据实际掌握度动态计算待加强数量（与 learning-path route 保持一致）
        const MASTERY_THRESHOLD = 0.9;
        const nodeIds = nodes.map((n: { nodeId: string }) => n.nodeId);
        const userKnowledgeList = await prisma.userKnowledge.findMany({
          where: {
            userId: session.user.id,
            knowledgePointId: { in: nodeIds }
          },
          select: {
            knowledgePointId: true,
            mastery: true
          }
        });

        const masteryMap = new Map(
          userKnowledgeList.map(uk => [uk.knowledgePointId, uk.mastery])
        );

        // mastery < MASTERY_THRESHOLD 的为待加强
        weakCount = nodes.filter(
          (n: { nodeId: string }) => (masteryMap.get(n.nodeId) ?? 0) < MASTERY_THRESHOLD
        ).length;

        // Detect stale knowledge points (not practiced in 14+ days, mastery >= 0.7)
        // Batch fetch all userKnowledge records with mastery filter
        const userKnowledgeWithStale = await prisma.userKnowledge.findMany({
          where: {
            userId: session.user.id,
            knowledgePointId: { in: nodeIds },
            mastery: { gte: STALE_MASTERY_THRESHOLD }
          },
          select: {
            knowledgePointId: true,
            mastery: true,
            lastPractice: true
          }
        });

        // Batch fetch knowledge point names
        const kpNames = await prisma.knowledgePoint.findMany({
          where: { id: { in: nodeIds } },
          select: { id: true, name: true, concept: { select: { name: true } } }
        });
        const kpNameMap = new Map(kpNames.map(kp => [kp.id, kp]));

        // Build userKnowledge map for quick lookup
        const ukMap = new Map(userKnowledgeWithStale.map(uk => [uk.knowledgePointId, uk]));

        // Check each node for staleness
        for (const node of nodes) {
          const userKnowledge = ukMap.get(node.nodeId);
          if (userKnowledge) {
            const daysSince = Math.floor(
              (Date.now() - userKnowledge.lastPractice.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysSince > STALE_DAYS_THRESHOLD) {
              const kp = kpNameMap.get(node.nodeId);

              staleKnowledge.push({
                nodeId: node.nodeId,
                name: kp?.name || kp?.concept?.name || node.nodeId,
                lastPractice: userKnowledge.lastPractice.toISOString(),
                mastery: userKnowledge.mastery
              });
            }
          }
        }
      }
    }

    // Generate recommendations
    const recommendations = {
      toReview: staleKnowledge.map(s => s.nodeId),
      toLearn: [] as string[]
    };

    return NextResponse.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        summary: {
          practicedCount,
          masteredCount: masteredThisWeek,
          weakCount
        },
        staleKnowledge,
        recommendations
      }
    });

  } catch (error) {
    console.error('获取周报错误:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
