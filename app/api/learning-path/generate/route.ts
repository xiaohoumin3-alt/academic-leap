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
import { getWeakPointsWithIds, isNewKnowledgeDataFormat, type AssessmentKnowledgeData, type LegacyKnowledgeData } from '@/lib/types/knowledge';

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

    // DEBUG: Log what we received
    console.log('[DEBUG Generate] userEdits.add:', userEdits?.add);

    // 2. Validate assessment and extract weak knowledge points if provided
    let weakKnowledgePointIds: Set<string> = new Set();
    let assessmentKnowledgeData: AssessmentKnowledgeData | LegacyKnowledgeData | null = null;

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

      // Extract weak knowledge points from assessment (level <= 1)
      // Prisma Json type auto-parses, check if already object
      try {
        if (typeof assessment.knowledgeData === 'string') {
          assessmentKnowledgeData = JSON.parse(assessment.knowledgeData) as AssessmentKnowledgeData | LegacyKnowledgeData;
        } else {
          assessmentKnowledgeData = assessment.knowledgeData as unknown as AssessmentKnowledgeData | LegacyKnowledgeData;
        }
        if (assessmentKnowledgeData) {
          const weakPoints = getWeakPointsWithIds(assessmentKnowledgeData);
          weakKnowledgePointIds = new Set(weakPoints.map((wp) => wp.id));
          console.log('[DEBUG Generate] Weak knowledge points from assessment:', weakKnowledgePointIds.size, 'points');
        }
      } catch (error) {
        console.error('[DEBUG Generate] Failed to parse assessment knowledgeData:', error);
        return NextResponse.json(
          { error: '测评数据格式错误' },
          { status: 500 }
        );
      }

      // Require at least one weak point
      if (weakKnowledgePointIds.size === 0) {
        return NextResponse.json(
          { error: '测评中未发现薄弱知识点（无法生成学习路径）' },
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

    // DEBUG: Log available IDs and check if userEdits IDs match
    const availableIds = knowledgePoints.map(kp => kp.id);
    const availableNames = knowledgePoints.map(kp => kp.name);
    console.log('[DEBUG Generate] Available knowledgePoint IDs:', availableIds.slice(0, 5), '...');
    console.log('[DEBUG Generate] Available knowledgePoint names:', availableNames.slice(0, 5), '...');
    if (userEdits?.add) {
      const matchedIds = userEdits.add.filter(id => availableIds.includes(id));
      const unmatchedIds = userEdits.add.filter(id => !availableIds.includes(id));
      console.log('[DEBUG Generate] Sent IDs to add:', userEdits.add);
      console.log('[DEBUG Generate] Sent IDs matched:', matchedIds);
      console.log('[DEBUG Generate] Sent IDs NOT matched:', unmatchedIds);
      // Log names of unmatched IDs for debugging
      if (unmatchedIds.length > 0) {
        console.log('[DEBUG Generate] Unmatched IDs do not exist in current textbook');
      }
    }

    // 6. Filter knowledge points to include (only weak points if from assessment)
    const enabledKnowledgePoints = knowledgePoints.filter((kp) => {
      // Must be enabled by user
      if (!enabledNodeIds.includes(kp.id)) {
        return false;
      }
      // If from assessment, must be a weak point (level <= 1)
      if (assessmentId && !weakKnowledgePointIds.has(kp.id)) {
        return false;
      }
      return true;
    });

    console.log('[DEBUG Generate] Filtered knowledge points:', enabledKnowledgePoints.length);

    if (enabledKnowledgePoints.length === 0) {
      return NextResponse.json(
        { error: '没有可生成学习路径的知识点（请检查测评结果或启用知识点）' },
        { status: 400 }
      );
    }

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
    let requestedAddCount = 0;
    let matchedAddCount = 0;

    if (userEdits?.add && Array.isArray(userEdits.add)) {
      requestedAddCount = userEdits.add.length;

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
        matchedAddCount++;

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
        stats: {
          totalNodes: filteredNodes.length,
          requestedAddCount,
          matchedAddCount,
          matchedAddRate: requestedAddCount > 0 ? matchedAddCount / requestedAddCount : 1,
        },
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
