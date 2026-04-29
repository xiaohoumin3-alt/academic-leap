import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  analyzePathForAdjustments,
  getStatusLabel,
  getStatusColor,
} from '@/lib/learning-path/analyzer';
import type { PathKnowledgeNode } from '@/lib/learning-path/types';
import {
  isNewKnowledgeDataFormat,
  getWeakPointsWithIds,
  type AssessmentKnowledgeData,
  type LegacyKnowledgeData,
} from '@/lib/types/knowledge';

/**
 * GET /api/analytics/recommendations
 *
 * AI学习建议 - 基于诊断测评和学习路径状态，生成路径调整建议
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. 获取用户目标分数
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetScore: true },
    });

    const targetScore = user?.targetScore ?? 100;

    // 2. 获取诊断测评数据（mode = 'diagnostic'）
    const diagnosticAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        mode: 'diagnostic',
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    // 3. 检查是否有诊断测评数据
    if (diagnosticAttempts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          overallStatus: null,
          scoreGapAnalysis: null,
          pathProgress: null,
          recommendations: [
            {
              id: 'no-diagnostic',
              type: 'regenerate_path' as const,
              title: '完成诊断测评',
              description: '先完成一次诊断测评，AI会根据你的水平制定学习计划',
              reason: '诊断测评是生成个性化学习路径的基础',
              impact: '完成诊断后将获得针对你的学习路径',
              actionable: true,
              priority: 1,
            },
          ],
          message: {
            title: '开始你的学习之旅',
            subtitle: '完成诊断测评，获取个性化学习计划',
            primaryAction: {
              text: '开始诊断测评',
              action: '/assessment',
            },
          },
        },
      });
    }

    // 4. 获取最新诊断测评分数
    const latestDiagnosticScore = diagnosticAttempts[0].score;
    const latestAttemptId = diagnosticAttempts[0].id;
    const scoreGap = targetScore - latestDiagnosticScore;

    // 4.1 获取诊断测评的知识点掌握数据
    // 直接按时间排序获取最新测评结果（不用分数匹配，避免多测评时匹配错误）
    const assessments = await prisma.assessment.findMany({
      where: {
        userId,
        type: 'initial',
      },
      orderBy: { completedAt: 'desc' },
      take: 1,
    });

    const latestAssessment = assessments[0];

    // 从测评结果中获取薄弱知识点（level <= 1）
    // 支持新旧两种格式
    let diagnosticWeakPoints: string[] = [];
    let diagnosticWeakPointsWithIds: Array<{ id: string; name: string }> = [];
    let debugInfo: any = null;
    if (latestAssessment?.knowledgeData) {
      try {
        const knowledgeData = latestAssessment.knowledgeData;
        if (isNewKnowledgeDataFormat(knowledgeData)) {
          // 新格式：ID-based
          const newData = knowledgeData as AssessmentKnowledgeData;
          diagnosticWeakPointsWithIds = getWeakPointsWithIds(newData);
          diagnosticWeakPoints = diagnosticWeakPointsWithIds.map(wp => wp.name);
          debugInfo = {
            assessmentId: latestAssessment.id,
            assessmentCount: assessments.length,
            format: 'new',
            allKnowledgeLevels: Object.entries(newData).map(([id, data]) => data.name),
            diagnosticWeakPoints,
          };
        } else {
          // 旧格式：name-based（向后兼容）
          const legacyData = knowledgeData as LegacyKnowledgeData;
          diagnosticWeakPoints = Object.entries(legacyData)
            .filter(([, level]) => level <= 1)
            .map(([name]) => name);
          debugInfo = {
            assessmentId: latestAssessment.id,
            assessmentCount: assessments.length,
            format: 'legacy',
            allKnowledgeLevels: Object.keys(legacyData),
            diagnosticWeakPoints,
          };
        }
      } catch (e) {
        console.error('解析知识点数据失败:', e);
      }
    }

    // 5. 获取当前学习路径
    const activePath = await prisma.learningPath.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        generatedAt: 'desc',
      },
    });

    // 6. 如果没有活跃路径，建议生成路径
    if (!activePath) {
      return NextResponse.json({
        success: true,
        data: {
          overallStatus: 'behind',
          scoreGapAnalysis: {
            diagnosticScore: latestDiagnosticScore,
            targetScore,
            gap: scoreGap,
            percentage: Math.round((latestDiagnosticScore / targetScore) * 100),
            urgent: true,
          },
          pathProgress: null,
          recommendations: [
            {
              id: 'generate-path',
              type: 'regenerate_path' as const,
              title: '生成学习路径',
              description: `基于你的诊断测评分数（${latestDiagnosticScore}分）生成个性化学习路径`,
              reason: '学习路径将帮助你系统性地提升到目标分数',
              impact: '生成后将按照优先级安排知识点学习顺序',
              actionable: true,
              priority: 1,
            },
          ],
        },
      });
    }

    // 7. 解析路径节点数据
    let knowledgeNodes: PathKnowledgeNode[];

    try {
      knowledgeNodes = JSON.parse(activePath.knowledgeData as string) as PathKnowledgeNode[];
    } catch (error) {
      return NextResponse.json(
        { error: '学习路径数据格式错误' },
        { status: 500 }
      );
    }

    // 8. 计算路径状态
    const masteredCount = knowledgeNodes.filter(
      (n) => n.status === 'mastered'
    ).length;
    const totalCount = knowledgeNodes.length;
    const currentIndex = knowledgeNodes.findIndex(
      (n) => n.status === 'learning' || (n.status !== 'mastered' && n.status !== 'stale')
    );
    const validCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

    // 9. 使用诊断测评的薄弱知识点数据
    // 获取用户教材的所有知识点，用于匹配薄弱点
    const userSettings = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTextbookId: true },
    });

    const allKnowledgePoints = userSettings?.selectedTextbookId
      ? await prisma.knowledgePoint.findMany({
          where: {
            chapter: { textbookId: userSettings.selectedTextbookId },
            status: 'active',
          },
          select: { id: true, name: true },
        })
      : [];

    const kpNameToId = new Map(allKnowledgePoints.map(kp => [kp.name, kp.id]));

    // 使用已有的 diagnosticWeakPointsWithIds，直接通过 ID 匹配
    // 如果是新格式数据，IDs 已经正确
    // 如果是旧格式数据，IDs 实际上是名称（fallback）
    const weakNodeIds: string[] = [];
    const weakPointNames: string[] = [];
    const matchingDebug: any[] = [];

    const kpIdSet = new Set(allKnowledgePoints.map(kp => kp.id));
    const kpNameSet = new Set(allKnowledgePoints.map(kp => kp.name));

    for (const wp of diagnosticWeakPointsWithIds.slice(0, 3)) {
      // 检查 ID 是否存在于当前知识点中
      if (kpIdSet.has(wp.id)) {
        weakNodeIds.push(wp.id);
        weakPointNames.push(wp.name);
        matchingDebug.push({
          searchFor: wp.name,
          found: wp.name,
          foundId: wp.id,
          matchType: 'id',
        });
      } else if (kpNameSet.has(wp.name)) {
        // 旧格式数据：尝试用名称匹配获取正确的 ID
        const kpInfo = allKnowledgePoints.find(kp => kp.name === wp.name);
        if (kpInfo) {
          weakNodeIds.push(kpInfo.id);
          weakPointNames.push(wp.name);
          matchingDebug.push({
            searchFor: wp.name,
            found: wp.name,
            foundId: kpInfo.id,
            matchType: 'name',
          });
        }
      } else {
        // 完全没找到
        matchingDebug.push({
          searchFor: wp.name,
          found: 'NOT FOUND',
          foundId: null,
        });
      }
    }

    // 如果是新格式数据中没有足够的点（diagnosticWeakPointsWithIds 为空），用旧数据
    if (weakNodeIds.length === 0 && diagnosticWeakPoints.length > 0) {
      for (const wpName of diagnosticWeakPoints.slice(0, 3)) {
        const kpInfo = allKnowledgePoints.find(kp => kp.name === wpName);
        if (kpInfo) {
          weakNodeIds.push(kpInfo.id);
          weakPointNames.push(wpName);
        }
      }
    }

    // 更新 debugInfo
    if (debugInfo) {
      debugInfo.weakNodeIds = weakNodeIds;
      debugInfo.weakPointNames = weakPointNames;
      debugInfo.matchingDebug = matchingDebug;
    }

    // 计算遗忘知识点数（status = 'stale'）
    const staleCount = knowledgeNodes.filter((n) => n.status === 'stale').length;

    // 10. 调用路径分析器
    const analysisResult = analyzePathForAdjustments({
      currentPath: {
        nodes: knowledgeNodes,
        currentIndex: validCurrentIndex,
      },
      diagnosticScore: latestDiagnosticScore,
      targetScore,
      scoreGap,
      masteredCount,
      totalCount,
      staleCount,
      weakNodeIds,
    });

    // 11. 为 add_weak_points 建议添加具体知识点名称和 assessmentId
    const recommendationsWithNames = analysisResult.recommendations.map(rec => {
      if (rec.type === 'add_weak_points' && weakPointNames.length > 0) {
        return {
          ...rec,
          reason: `薄弱点：${weakPointNames.join('、')}。这些是提分关键`,
          actionData: {
            ...rec.actionData,
            weakPointNames,
            // 传递 assessmentId 而不是具体的 nodeId 列表
            // 因为 nodeId 可能在当前教材中不存在
            assessmentId: latestAssessment?.id ?? null,
          },
        };
      }
      return rec;
    });

    // 12. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        overallStatus: analysisResult.overallStatus,
        overallStatusLabel: getStatusLabel(analysisResult.overallStatus),
        overallStatusColor: getStatusColor(analysisResult.overallStatus),
        scoreGapAnalysis: analysisResult.scoreGapAnalysis,
        pathProgress: analysisResult.pathProgress,
        recommendations: recommendationsWithNames,
        nextMilestone: analysisResult.nextMilestone,
        // 添加 assessmentId 用于重新生成学习路径
        latestAssessmentId: latestAssessment?.id ?? null,
        // Debug info for troubleshooting
        debug: {
          weakNodeIds,
          weakPointNames,
          matchingDebug,
          diagnosticWeakPointsWithIds: diagnosticWeakPointsWithIds.slice(0, 3),
        },
      },
    });
  } catch (error) {
    console.error('获取AI建议数据错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
