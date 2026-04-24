import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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

// Constants
const MASTERY_THRESHOLD = 0.9;

// Input validation schema
const generatePathSchema = z.object({
  assessmentId: z.string().optional(),
  userEdits: z.object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  }).optional(),
});

type GeneratePathInput = z.infer<typeof generatePathSchema>;

export async function POST(req: NextRequest): Promise<NextResponse> {
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

    // Validate request body
    const body = await req.json();
    const validationResult = generatePathSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { assessmentId, userEdits } = validationResult.data;

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

    // 6. Batch fetch all mastery data for enabled knowledge points
    const enabledKnowledgePoints = knowledgePoints.filter((kp) =>
      enabledNodeIds.includes(kp.id)
    );

    // Fetch all mastery data in parallel
    const masteryData = await Promise.all(
      enabledKnowledgePoints.map(async (kp) => {
        const [mastery, daysSincePractice, recentFailureRate] = await Promise.all([
          getUserMastery(userId, kp.id),
          getDaysSincePractice(userId, kp.id),
          getRecentFailureRate(userId, kp.id, 7),
        ]);

        return {
          knowledgePoint: kp,
          mastery,
          daysSincePractice,
          recentFailureRate,
        };
      })
    );

    // 7. Calculate priority for each knowledge point
    const knowledgeNodes: PathKnowledgeNode[] = [];
    const now = new Date().toISOString();

    for (const data of masteryData) {
      const { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate } = data;

      // Skip fully mastered points
      if (mastery >= MASTERY_THRESHOLD) {
        continue;
      }

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

    // 8. Apply user edits if provided
    const addedNodes = new Set<string>();
    const removedNodes = new Set<string>();

    if (userEdits?.add && Array.isArray(userEdits.add)) {
      // Batch fetch mastery data for all added nodes
      const addNodeData = await Promise.all(
        userEdits.add.map(async (nodeId) => {
          if (removedNodes.has(nodeId)) {
            return null;
          }

          const kp = knowledgePoints.find((k) => k.id === nodeId);
          if (!kp) {
            return null;
          }

          // Check if already in list
          if (knowledgeNodes.some((kn) => kn.nodeId === nodeId)) {
            addedNodes.add(nodeId);
            return null;
          }

          const [mastery, daysSincePractice, recentFailureRate] = await Promise.all([
            getUserMastery(userId, kp.id),
            getDaysSincePractice(userId, kp.id),
            getRecentFailureRate(userId, kp.id, 7),
          ]);

          return {
            knowledgePoint: kp,
            mastery,
            daysSincePractice,
            recentFailureRate,
          };
        })
      );

      // Process fetched data
      for (const data of addNodeData) {
        if (!data) {
          continue;
        }

        const { knowledgePoint: kp, mastery, daysSincePractice, recentFailureRate } = data;

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

        addedNodes.add(kp.id);
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

    // 9. Sort by priority descending
    filteredNodes.sort((a, b) => b.priority - a.priority);

    // 10. Create LearningPath record and archive old paths in transaction
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

    // 11. Return response
    return NextResponse.json({
      success: true,
      data: {
        pathId: result.id,
        knowledgeData: filteredNodes,
      },
    });
  } catch (error) {
    // Log error for debugging (consider using proper logging library in production)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '生成学习路径失败', details: errorMessage },
      { status: 500 }
    );
  }
}
