import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getGradeDifficultyRange, getAssessmentStartLevel } from '@/lib/assessment-guidance';

/**
 * POST /api/assessment/start
 * 开始测评（支持重新测评）
 *
 * 功能：
 * 1. 检查用户是否已完成初始测评（非retry模式）
 * 2. 根据用户年级选择适配难度的题目
 * 3. 返回10-15道测评题目
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 解析请求体，支持retry参数
    let retry = false;
    try {
      const body = await req.json();
      retry = body.retry === true;
    } catch {
      // 没有请求体，使用默认值
    }

    // 检查用户是否已完成初始测评
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        initialAssessmentCompleted: true,
        initialAssessmentScore: true,
        grade: true,
        targetScore: true,
        currentLevel: true,
        selectedTextbookId: true,  // 添加教材检查
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 检查用户是否选择了教材（retry模式除外，因为已选择过教材的用户可以重新测评）
    if (!user.selectedTextbookId && !retry) {
      return NextResponse.json({
        success: false,
        error: '请先选择教材',
        requireTextbookSelection: true,
      }, { status: 400 });
    }

    // 如果已完成测评且不是retry模式，返回现有信息
    if (user.initialAssessmentCompleted && !retry) {
      return NextResponse.json({
        success: true,
        data: {
          alreadyCompleted: true,
          score: user.initialAssessmentScore,
          message: '您已完成初始测评',
        },
      });
    }

    // 根据年级计算难度范围和起始难度
    const userGrade = user.grade || 7;
    const targetScore = user.targetScore || 80;

    // retry模式下使用更高难度
    let startDifficulty = getAssessmentStartLevel(userGrade, targetScore);
    if (retry && (user.initialAssessmentScore ?? 0) >= 90) {
      startDifficulty = Math.min(startDifficulty + 2, 10);
    }
    const { min: minDifficulty, max: maxDifficulty } = getGradeDifficultyRange(userGrade);

    // 获取参与测评的知识点（限制在用户选择的教材范围内）
    const knowledgePointWhere: any = {
      inAssess: true,
      status: 'active',
      deletedAt: null,
    };

    // 如果用户已选择教材，只获取该教材的知识点
    if (user.selectedTextbookId) {
      knowledgePointWhere.chapter = {
        textbookId: user.selectedTextbookId,
      };
    }

    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: knowledgePointWhere,
      select: {
        id: true,
        name: true,
        conceptId: true,
        weight: true,
      },
    });

    if (knowledgePoints.length === 0) {
      return NextResponse.json({ success: false, error: '没有可用的测评知识点' }, { status: 400 });
    }

    // 限制测评知识点数量（最多7个知识点）
    const maxKnowledgePoints = 7;
    const selectedKnowledgePoints = knowledgePoints.slice(0, maxKnowledgePoints);

    // 为每个知识点查找题目（根据年级适配难度）
    const questions: Array<{
      id: string;
      type: string;
      difficulty: number;
      content: any;
      knowledgePoint: string;
      stepCount: number;
    }> = [];

    for (const kp of selectedKnowledgePoints) {
      // 查找该知识点关联的模板
      const templates = await prisma.template.findMany({
        where: {
          knowledgeId: kp.id,
          status: 'production',
        },
        take: 2,
      });

      if (templates.length > 0) {
        for (const template of templates) {
          // 根据难度筛选题目：retry模式下使用更高难度
          const queryDifficulty = retry ? startDifficulty : minDifficulty;
          const existingQuestions = await prisma.question.findMany({
            where: {
              knowledgePoints: { contains: kp.id },
              difficulty: {
                gte: queryDifficulty,
                lte: retry ? queryDifficulty + 1 : maxDifficulty,
              },
            },
            include: {
              steps: true,
            },
            take: 1,
            orderBy: { difficulty: 'asc' }, // 从最低难度开始
          });

          if (existingQuestions.length > 0) {
            const q = existingQuestions[0];
            questions.push({
              id: q.id,
              type: q.type,
              difficulty: startDifficulty, // 使用计算出的起始难度
              content: JSON.parse(q.content || '{}'),
              knowledgePoint: kp.name,
              stepCount: q.steps?.length ?? 1,
            });
          }
        }
      }
    }

    // 确保至少有10道题（如果不够，扩大难度范围）
    if (questions.length < 10) {
      const queryDifficulty = retry ? startDifficulty : minDifficulty;
      const additionalQuestions = await prisma.question.findMany({
        where: {
          knowledgePoints: { not: '[]' },
          difficulty: {
            gte: queryDifficulty,
            lte: retry ? queryDifficulty + 2 : maxDifficulty,
          },
        },
        include: {
          steps: true,
        },
        take: 10 - questions.length,
      });

      for (const q of additionalQuestions) {
        const kpList = JSON.parse(q.knowledgePoints || '[]');
        questions.push({
          id: q.id,
          type: q.type,
          difficulty: startDifficulty,
          content: JSON.parse(q.content || '{}'),
          knowledgePoint: kpList[0] || '综合',
          stepCount: q.steps?.length ?? 1,
        });
      }
    }

    // 创建测评记录（临时状态）
    const assessment = await prisma.attempt.create({
      data: {
        userId: session.user.id,
        mode: 'diagnostic',
        score: 0,
        duration: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        attemptId: assessment.id,
        questions,
        knowledgePoints: selectedKnowledgePoints.map(kp => ({
          id: kp.id,
          name: kp.name,
          weight: kp.weight,
        })),
        totalCount: questions.length,
        // 返回诊断信息供结果页使用
        diagnostic: {
          userGrade,
          targetScore,
          difficultyRange: { min: minDifficulty, max: maxDifficulty },
          startDifficulty,
        },
      },
    });
  } catch (error) {
    console.error('开始测评错误:', error);
    return NextResponse.json({ success: false, error: '开始失败' }, { status: 500 });
  }
}
