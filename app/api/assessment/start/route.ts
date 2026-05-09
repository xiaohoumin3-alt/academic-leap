import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getGradeDifficultyRange, getAssessmentStartLevel } from '@/lib/assessment-utils';
import { generateAndSaveCards } from '@/lib/ai/generation';
import type { QuestionType } from '@/lib/ai/generation';

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

    // 解析请求体，支持retry和difficulty参数
    let retry = false;
    let requestedDifficulty: number | null = null;
    try {
      const body = await req.json();
      retry = body.retry === true;
      requestedDifficulty = typeof body.difficulty === 'number' ? body.difficulty : null;
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

    // 计算起始难度：优先使用传入的 difficulty，否则按原有逻辑计算
    let startDifficulty: number;
    if (requestedDifficulty !== null) {
      // 传入的难度必须验证范围 1-12
      startDifficulty = Math.max(1, Math.min(12, requestedDifficulty));
    } else if (retry) {
      // retry模式：根据上次的分数计算新难度
      startDifficulty = getAssessmentStartLevel(userGrade, targetScore);
      if ((user.initialAssessmentScore ?? 0) >= 90) {
        startDifficulty = Math.min(startDifficulty + 2, 10);
      }
    } else {
      // 首次测评
      startDifficulty = getAssessmentStartLevel(userGrade, targetScore);
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

    // 限制测评知识点数量（最多7个知识点）- 随机选择避免重复
    const maxKnowledgePoints = 7;
    // Fisher-Yates 洗牌算法打乱知识点顺序
    const shuffledKnowledgePoints = [...knowledgePoints];
    for (let i = shuffledKnowledgePoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledKnowledgePoints[i], shuffledKnowledgePoints[j]] = [shuffledKnowledgePoints[j], shuffledKnowledgePoints[i]];
    }
    const selectedKnowledgePoints = shuffledKnowledgePoints.slice(0, maxKnowledgePoints);

    if (selectedKnowledgePoints.length === 0) {
      return NextResponse.json({ success: false, error: '没有可用的测评知识点' }, { status: 400 });
    }

    // 为每个知识点查找题目（根据年级适配难度）
    const questions: Array<{
      id: string;
      type: string;
      difficulty: number;
      content: any;
      knowledgePoint: string;
      stepCount: number;
      answer: string;  // 添加 answer 字段
    }> = [];

    // 第一步：尝试通过 knowledgePoints 字段直接查询已有题目 - 随机选择
    for (const kp of selectedKnowledgePoints) {
      const queryDifficulty = retry ? startDifficulty : minDifficulty;
      const existingQuestions = await prisma.question.findMany({
        where: {
          knowledgePoints: { contains: kp.id },
          difficulty: {
            gte: queryDifficulty,
            lte: retry ? queryDifficulty + 1 : maxDifficulty,
          },
        },
        select: {
          id: true,
          type: true,
          difficulty: true,
          content: true,
          answer: true,
          steps: true,
        },
        take: 15,  // 增加抽取数量以提供更多随机选择
        // 移除 orderBy，让数据库自然返回（配合 take 增加实现随机效果）
      });

      for (const q of existingQuestions) {
        questions.push({
          id: q.id,
          type: q.type,
          difficulty: startDifficulty,
          content: JSON.parse(q.content || '{}'),
          knowledgePoint: kp.name,
          stepCount: q.steps?.length ?? 1,
          answer: q.answer,
        });
      }
    }

    // 检查是否有足够的题目，如果没有则调用 AI 生成
    const targetCount = 10;
    if (questions.length < targetCount) {
      // 获取知识点详情（用于 AI 生成）
      const kpDetails = await prisma.knowledgePoint.findMany({
        where: { id: { in: selectedKnowledgePoints.map(kp => kp.id) } },
        include: {
          concept: true,
          chapter: {
            include: {
              textbook: true
            }
          }
        },
        take: 3,  // 优先取前3个知识点
      });

      // 构建 content 用于 AI 生成
      const contentParts: string[] = [];
      for (const kp of kpDetails) {
        contentParts.push(`知识点: ${kp.name}`);
        if (kp.concept?.name) {
          contentParts.push(`概念分类: ${kp.concept.name}`);
        }
      }

      // 如果有教材内容，加入到 content
      const textbook = kpDetails[0]?.chapter?.textbook;
      if (textbook) {
        contentParts.push(`教材: ${textbook.name} (${textbook.grade}年级)`);
      }

      const generationContent = contentParts.join('\n\n') || `生成关于 ${selectedKnowledgePoints[0]?.name} 的题目`;

      // 如果没有可用内容，使用知识点名称作为后备
      if (generationContent === `生成关于 ${selectedKnowledgePoints[0]?.name} 的题目`) {
        console.warn(`[Assessment Start] 知识点 "${selectedKnowledgePoints[0]?.name}" 没有详细描述，仅使用名称生成`);
      }

      try {
        console.log(`[Assessment Start] 预置题目不足(${questions.length}/${targetCount})，调用 AI 生成`);

        // CRITICAL 修复：添加超时保护
        const timeout = parseInt(process.env.AI_GENERATION_TIMEOUT || '15000', 10);

        const generatePromise = generateAndSaveCards({
          knowledgePointId: selectedKnowledgePoints[0]?.id || '',
          content: generationContent,
          types: ['fill_blank', 'multiple_choice'] as QuestionType[],
          count: targetCount - questions.length,
          difficulty: startDifficulty,
          onProgress: (batch, total, cards) => {
            console.log(`[Assessment Start] AI 生成进度: ${batch}/${total}, 生成了 ${cards.length} 道`);
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`AI生成超时（${timeout}ms）`)), timeout)
        );

        const result = await Promise.race([generatePromise, timeoutPromise]) as Awaited<ReturnType<typeof generateAndSaveCards>>;

        // 转换生成的题目为 API 返回格式
        const generatedQuestions = result.questions.map((q: any) => {
          let parsedContent: { question?: string; options?: string[]; explanation?: string } = {};
          try {
            parsedContent = typeof q.content === 'string' ? JSON.parse(q.content) : (q.content || {});
          } catch {
            parsedContent = {};
          }

          return {
            id: q.id,
            type: q.type || q.question_type || 'fill_blank',
            difficulty: q.difficulty || startDifficulty,
            content: {
              question: parsedContent.question || '',
              options: parsedContent.options || [],
              explanation: parsedContent.explanation || ''
            },
            knowledgePoint: selectedKnowledgePoints[0]?.name || 'AI生成',
            stepCount: 1,
            answer: q.answer || '',
            isAI: true,  // 标记为 AI 生成
          };
        });

        questions.push(...generatedQuestions);
        console.log(`[Assessment Start] AI 生成完成，当前共 ${questions.length} 道题目`);

        // CRITICAL 修复：验证生成结果
        if (questions.length < targetCount) {
          throw new Error(`题目生成失败：已获取 ${questions.length}/${targetCount} 题`);
        }
      } catch (error) {
        // CRITICAL 修复：AI 生成失败 = 不降级，直接返回 500 错误
        console.error('[Assessment Start] AI 生成失败:', error);

        return NextResponse.json({
          success: false,
          error: '题目生成失败，请稍后重试或联系管理员',
          details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
        }, { status: 500 });
      }
    }

    // 如果仍然没有题目，返回错误
    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '无法获取测评题目，请稍后重试',
        noQuestionsAvailable: true,
      }, { status: 400 });
    }

    // Fisher-Yates 洗牌：打乱题目顺序，避免连续测评出现重复
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // 限制返回数量
    const finalQuestions = questions.slice(0, targetCount);

    console.log(`[Assessment Start] 最终返回 ${finalQuestions.length} 道题目（已打乱顺序）`);

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
        questions: finalQuestions,
        knowledgePoints: selectedKnowledgePoints.map(kp => ({
          id: kp.id,
          name: kp.name,
          weight: kp.weight,
        })),
        totalCount: finalQuestions.length,
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
