/**
 * Learning Path Adjustment API
 *
 * POST /api/learning-path/adjust
 *
 * Adjusts learning path priorities based on practice results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  calculateMicroAdjustments,
  applyMicroAdjustments,
  type PracticeResult
} from '@/lib/learning-path/adapter';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';

/**
 * POST /api/learning-path/adjust
 *
 * Apply micro-adjustments after practice completion
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authentication required
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const { attemptId, practiceResults } = body;

    if (!practiceResults || !Array.isArray(practiceResults)) {
      return NextResponse.json(
        { success: false, error: '参数错误：practiceResults 必须是数组' },
        { status: 400 }
      );
    }

    // Validate each practice result
    for (const result of practiceResults) {
      if (!result.knowledgePointId || typeof result.isCorrect !== 'boolean') {
        return NextResponse.json(
          { success: false, error: '参数错误：每个练习结果需要 knowledgePointId 和 isCorrect' },
          { status: 400 }
        );
      }
    }

    // 3. Get user's active learning path
    const path = await prisma.learningPath.findFirst({
      where: {
        userId: session.user.id,
        status: 'active'
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    if (!path) {
      return NextResponse.json(
        { success: false, error: '没有找到活跃的学习路径' },
        { status: 404 }
      );
    }

    // 4. Parse knowledge nodes
    const nodes: PathKnowledgeNode[] = JSON.parse(path.knowledgeData as string);

    // 5. Calculate adjustments
    const typedPracticeResults: PracticeResult[] = practiceResults.map((r: { knowledgePointId: string; isCorrect: boolean }) => ({
      knowledgePointId: r.knowledgePointId,
      isCorrect: r.isCorrect
    }));

    const result = calculateMicroAdjustments(nodes, typedPracticeResults);

    // 6. Apply to database
    await applyMicroAdjustments(path.id, result.adjustments);

    // 7. Get next recommendation name
    let nextRecommendationName = '';
    if (result.nextRecommendation) {
      const kp = await prisma.knowledgePoint.findUnique({
        where: { id: result.nextRecommendation.nodeId },
        include: { concept: true }
      });
      nextRecommendationName = kp?.name || kp?.concept?.name || '';
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      data: {
        adjustments: result.adjustments,
        nextRecommendation: result.nextRecommendation ? {
          nodeId: result.nextRecommendation.nodeId,
          name: nextRecommendationName
        } : null
      }
    });

  } catch (error) {
    console.error('微调学习路径错误:', error);
    return NextResponse.json(
      { success: false, error: '微调失败' },
      { status: 500 }
    );
  }
}
