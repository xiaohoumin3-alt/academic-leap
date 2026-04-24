/**
 * Learning Path Recalibrate API
 *
 * POST /api/learning-path/recalibrate
 *
 * Recalculates and reshuffles learning path based on current mastery levels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calculatePriority,
  generatePriorityReasons,
  getUserMastery
} from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { includeStale } = body;

    // Get user settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        includeStale: true,
        selectedTextbookId: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    // Get active path
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      }
    });

    if (!path) {
      return NextResponse.json(
        { success: false, error: '没有活跃的学习路径' },
        { status: 404 }
      );
    }

    // Get all knowledge points from user's textbook
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        ...(user.selectedTextbookId ? {
          chapter: {
            textbookId: user.selectedTextbookId
          }
        } : {})
      },
      include: {
        concept: true
      }
    });

    // Batch fetch user knowledge data for all knowledge points
    const userKnowledgeRecords = await prisma.userKnowledge.findMany({
      where: {
        userId: session.user.id,
        knowledgePoint: { in: knowledgePoints.map(kp => kp.id) }
      }
    });
    const userKnowledgeMap = new Map(
      userKnowledgeRecords.map(uk => [uk.knowledgePoint, uk])
    );

    // Batch fetch recent attempts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSteps = await prisma.attemptStep.findMany({
      where: {
        attempt: { userId: session.user.id },
        submittedAt: { gte: sevenDaysAgo }
      },
      include: {
        questionStep: {
          include: {
            question: true
          }
        }
      },
      take: 100
    });

    // Build knowledge point map from recent steps
    const kpFailureCounts = new Map<string, { total: number; failures: number }>();
    for (const step of recentSteps) {
      if (step.questionStep?.question) {
        try {
          const kps = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
          for (const kpId of kps) {
            const current = kpFailureCounts.get(kpId) || { total: 0, failures: 0 };
            current.total++;
            if (!step.isCorrect) current.failures++;
            kpFailureCounts.set(kpId, current);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Calculate new priorities
    const newNodes: PathKnowledgeNode[] = [];
    const shouldIncludeStale = includeStale ?? user.includeStale;

    for (const kp of knowledgePoints) {
      const mastery = await getUserMastery(session.user.id, kp.id);

      // Skip fully mastered points unless including stale
      if (mastery >= 0.9 && !shouldIncludeStale) {
        continue;
      }

      // Get practice days
      const userKnowledge = userKnowledgeMap.get(kp.id);
      const daysSincePractice = userKnowledge
        ? Math.floor((Date.now() - userKnowledge.lastPractice.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Calculate recent failure rate
      const kpStats = kpFailureCounts.get(kp.id);
      let recentFailureRate = 0;
      if (kpStats && kpStats.total > 0) {
        recentFailureRate = kpStats.failures / kpStats.total;
      }

      // Calculate priority
      const priorityResult = calculatePriority({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: shouldIncludeStale
      });

      const reasons = generatePriorityReasons({
        mastery,
        weight: kp.concept.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: shouldIncludeStale
      });

      // Determine status
      let status: 'pending' | 'learning' | 'mastered' | 'stale' = 'pending';
      if (mastery >= 0.9) {
        status = 'mastered';
      } else if (mastery >= 0.5) {
        status = 'learning';
      } else if (daysSincePractice > 14 && mastery >= 0.7) {
        status = 'stale';
      }

      newNodes.push({
        nodeId: kp.id,
        priority: priorityResult.score,
        status,
        addedAt: new Date().toISOString(),
        reasons
      });
    }

    // Sort by priority descending
    newNodes.sort((a, b) => b.priority - a.priority);

    // Update path
    await prisma.learningPath.update({
      where: { id: path.id },
      data: {
        knowledgeData: JSON.stringify(newNodes)
      }
    });

    // Record adjustment
    await prisma.pathAdjustment.create({
      data: {
        pathId: path.id,
        type: 'weekly',
        trigger: 'weekly_recalibration',
        changes: JSON.stringify({
          added: [],
          removed: [],
          reordered: newNodes.map(n => ({ nodeId: n.nodeId, priority: n.priority }))
        })
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        path: {
          id: path.id,
          knowledgeData: newNodes
        }
      }
    });

  } catch (error) {
    console.error('重组学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '重组失败' },
      { status: 500 }
    );
  }
}
