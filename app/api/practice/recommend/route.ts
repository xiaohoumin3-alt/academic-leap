import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRecommendedDifficulty, getKnowledgeLevel } from '@/lib/scoring';

/**
 * GET /api/practice/recommend
 * 推荐练习题目
 *
 * 功能：
 * 1. 获取用户当前各知识点能力等级
 * 2. 推荐能力等级+1的题目（+4%难度）
 * 3. 优先推荐薄弱知识点
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查用户是否已完成初始测评
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        initialAssessmentCompleted: true,
        currentLevel: true,
        grade: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (!user.initialAssessmentCompleted) {
      return NextResponse.json({
        success: true,
        data: {
          needAssessment: true,
          message: '请先完成初始测评',
        },
      });
    }

    // 获取用户知识点掌握情况
    const userKnowledge = await prisma.userKnowledge.findMany({
      where: { userId: session.user.id },
      include: {
        knowledgePoint: {
          select: { name: true },
        },
      },
      orderBy: { mastery: 'asc' }, // 优先返回薄弱知识点
    });

    if (userKnowledge.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          questions: [],
          focusKnowledge: null,
          reason: '暂无知识点数据，请重新测评',
        },
      });
    }

    // 找出最薄弱的知识点（掌握度最低）
    const weakestKnowledge = userKnowledge[0];
    const recommendedLevel = getKnowledgeLevel(weakestKnowledge.mastery) + 1;
    const { difficultyMultiplier } = getRecommendedDifficulty(recommendedLevel - 1);

    // 根据推荐难度查找题目
    const difficultyLevel = Math.min(5, Math.max(1, Math.round(difficultyMultiplier)));

    // 查找该知识点的题目（使用 knowledgePointId）
    const kpId = weakestKnowledge.knowledgePointId;
    const questions = await prisma.question.findMany({
      where: {
        knowledgePoints: { contains: kpId },
      },
      take: 3, // 推荐3道题
    });

    // 如果没有足够题目，补充其他题
    if (questions.length < 3) {
      const additionalQuestions = await prisma.question.findMany({
        where: {
          difficulty: difficultyLevel,
        },
        take: 3 - questions.length,
      });

      questions.push(...additionalQuestions);
    }

    return NextResponse.json({
      success: true,
      data: {
        questions: questions.map(q => ({
          id: q.id,
          type: q.type,
          difficulty: q.difficulty,
          content: JSON.parse(q.content || '{}'),
          knowledgePoints: JSON.parse(q.knowledgePoints || '[]'),
        })),
        focusKnowledge: weakestKnowledge.knowledgePoint.name,
        focusKnowledgeMastery: Math.round(weakestKnowledge.mastery * 100),
        recommendedLevel,
        recommendedDifficulty: difficultyMultiplier.toFixed(2),
        reason: `您的【${weakestKnowledge.knowledgePoint.name}】掌握度为${Math.round(weakestKnowledge.mastery * 100)}%，建议重点练习`,
        currentLevel: user.currentLevel,
      },
    });
  } catch (error) {
    console.error('推荐题目错误:', error);
    return NextResponse.json({ success: false, error: '推荐失败' }, { status: 500 });
  }
}
