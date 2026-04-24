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

    // Count unique knowledge points practiced
    const practicedKnowledgeIds = new Set<string>();
    for (const attempt of weeklyAttempts) {
      for (const step of attempt.steps) {
        if (step.questionStep?.question) {
          try {
            const kps = JSON.parse(step.questionStep.question.knowledgePoints || '[]');
            kps.forEach((kp: string) => practicedKnowledgeIds.add(kp));
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    const practicedCount = practicedKnowledgeIds.size;

    // Count knowledge points mastered this week
    const masteredThisWeek = await prisma.userKnowledge.count({
      where: {
        userId: session.user.id,
        mastery: { gte: 0.8 },
        lastPractice: { gte: weekStart }
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
      const nodes = JSON.parse(path.knowledgeData as string);
      // 根据实际掌握度动态计算待加强数量（与 learning-path route 保持一致）
      const MASTERY_THRESHOLD = 0.9;
      const nodeIds = nodes.map((n: { nodeId: string }) => n.nodeId);
      const userKnowledgeList = await prisma.userKnowledge.findMany({
        where: {
          userId: session.user.id,
          knowledgePoint: { in: nodeIds }
        },
        select: {
          knowledgePoint: true,
          mastery: true
        }
      });

      const masteryMap = new Map(
        userKnowledgeList.map(uk => [uk.knowledgePoint, uk.mastery])
      );

      // mastery < MASTERY_THRESHOLD 的为待加强
      weakCount = nodes.filter(
        (n: { nodeId: string }) => (masteryMap.get(n.nodeId) ?? 0) < MASTERY_THRESHOLD
      ).length;

      // Detect stale knowledge points (not practiced in 14+ days, mastery >= 0.7)
      for (const node of nodes) {
        const userKnowledge = await prisma.userKnowledge.findUnique({
          where: {
            userId_knowledgePoint: {
              userId: session.user.id,
              knowledgePoint: node.nodeId
            }
          }
        });

        if (userKnowledge && userKnowledge.mastery >= STALE_MASTERY_THRESHOLD) {
          const daysSince = Math.floor(
            (Date.now() - userKnowledge.lastPractice.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSince > STALE_DAYS_THRESHOLD) {
            const kp = await prisma.knowledgePoint.findUnique({
              where: { id: node.nodeId },
              include: { concept: true }
            });

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
