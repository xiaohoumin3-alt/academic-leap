import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calculatePriority,
  generatePriorityReasons,
  getUserMastery,
  getDaysSincePractice,
  getRecentFailureRate,
} from '@/lib/learning-path/priority';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';
import { PathNodeStatus } from '@/lib/learning-path/types';

export async function POST(req: NextRequest) {
  try {
    // 1. Require authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { assessmentId, userEdits } = body;

    // 2. Validate assessment score if provided
    if (assessmentId) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { score: true, knowledgeData: true },
      });

      if (!assessment) {
        return NextResponse.json(
          { error: '测评记录不存在' },
          { status: 404 }
        );
      }

      if (assessment.score < 60 || assessment.score >= 90) {
        return NextResponse.json(
          { error: `测评分数不在可生成学习路径的范围内 (${assessment.score}，要求60-89分)` },
          { status: 400 }
        );
      }
    }

    // 3. Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        selectedTextbookId: true,
        includeStale: true,
      },
    });

    if (!user?.selectedTextbookId) {
      return NextResponse.json(
        { error: '请先选择教材版本' },
        { status: 400 }
      );
    }

    // 4. Get user's enabled knowledge points
    const enabledKnowledge = await prisma.userEnabledKnowledge.findMany({
      where: {
        userId,
        nodeType: 'point',
      },
      select: {
        nodeId: true,
      },
    });

    const enabledNodeIds = enabledKnowledge.map((ek) => ek.nodeId);

    // 5. Get knowledge points from user's selected textbook
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        chapter: {
          textbookId: user.selectedTextbookId,
        },
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        weight: true,
      },
    });

    // 6. Calculate priority for each knowledge point
    const knowledgeNodes: PathKnowledgeNode[] = [];
    const now = new Date().toISOString();

    for (const kp of knowledgePoints) {
      // Skip if not in enabled knowledge points
      if (!enabledNodeIds.includes(kp.id)) {
        continue;
      }

      // Get mastery data
      const mastery = await getUserMastery(userId, kp.id);

      // Skip fully mastered points
      if (mastery >= 0.9) {
        continue;
      }

      const daysSincePractice = await getDaysSincePractice(userId, kp.id);
      const recentFailureRate = await getRecentFailureRate(userId, kp.id, 7);

      const priorityResult = calculatePriority({
        mastery,
        weight: kp.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: user.includeStale,
      });

      const reasons = generatePriorityReasons({
        mastery,
        weight: kp.weight || 3,
        daysSincePractice,
        recentFailureRate,
        includeStale: user.includeStale,
      });

      knowledgeNodes.push({
        nodeId: kp.id,
        priority: priorityResult.score,
        status: 'pending' as PathNodeStatus,
        addedAt: now,
        reasons,
      });
    }

    // 7. Apply user edits if provided
    const addedNodes = new Set<string>();
    const removedNodes = new Set<string>();

    if (userEdits?.add && Array.isArray(userEdits.add)) {
      for (const nodeId of userEdits.add) {
        if (removedNodes.has(nodeId)) {
          continue; // Don't add if marked for removal
        }

        const kp = knowledgePoints.find((k) => k.id === nodeId);
        if (!kp) {
          continue; // Skip if knowledge point doesn't exist
        }

        // Check if already in list
        if (knowledgeNodes.some((kn) => kn.nodeId === nodeId)) {
          addedNodes.add(nodeId);
          continue;
        }

        const mastery = await getUserMastery(userId, kp.id);
        const daysSincePractice = await getDaysSincePractice(userId, kp.id);
        const recentFailureRate = await getRecentFailureRate(userId, kp.id, 7);

        const priorityResult = calculatePriority({
          mastery,
          weight: kp.weight || 3,
          daysSincePractice,
          recentFailureRate,
          includeStale: user.includeStale,
        });

        const reasons = generatePriorityReasons({
          mastery,
          weight: kp.weight || 3,
          daysSincePractice,
          recentFailureRate,
          includeStale: user.includeStale,
        });

        knowledgeNodes.push({
          nodeId: kp.id,
          priority: priorityResult.score,
          status: 'pending' as PathNodeStatus,
          addedAt: now,
          reasons,
        });

        addedNodes.add(nodeId);
      }
    }

    if (userEdits?.remove && Array.isArray(userEdits.remove)) {
      for (const nodeId of userEdits.remove) {
        if (addedNodes.has(nodeId)) {
          // Remove from added nodes
          const index = knowledgeNodes.findIndex((kn) => kn.nodeId === nodeId);
          if (index !== -1) {
            knowledgeNodes.splice(index, 1);
          }
        } else {
          // Mark for removal from existing nodes
          removedNodes.add(nodeId);
        }
      }
    }

    // Filter out removed nodes
    const filteredNodes = knowledgeNodes.filter(
      (kn) => !removedNodes.has(kn.nodeId)
    );

    // 8. Sort by priority descending
    filteredNodes.sort((a, b) => b.priority - a.priority);

    // 9. Create LearningPath record and archive old paths in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Archive old active paths
      await tx.learningPath.updateMany({
        where: {
          userId,
          status: 'active',
        },
        data: {
          status: 'archived',
        },
      });

      // Create new learning path
      const path = await tx.learningPath.create({
        data: {
          userId,
          name: assessmentId
            ? `基于测评的学习路径`
            : `学习路径 ${new Date().toLocaleDateString('zh-CN')}`,
          type: assessmentId ? 'initial' : 'manual',
          status: 'active',
          knowledgeData: JSON.stringify(filteredNodes),
        },
        select: {
          id: true,
        },
      });

      return path;
    });

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        pathId: result.id,
        knowledgeData: filteredNodes,
      },
    });
  } catch (error) {
    console.error('[Generate Learning Path] Error:', error);
    return NextResponse.json(
      { error: '生成学习路径失败' },
      { status: 500 }
    );
  }
}
