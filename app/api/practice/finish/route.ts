import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { gamificationListener } from '@/lib/gaming/event-listener';

// POST /api/practice/finish - 完成练习
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { attemptId, score, duration } = await req.json();

    // 确保 score 有合理值（最低10分），避免 0 分导致统计不一致
    const validScore = (score !== undefined && score > 0) ? score : 10;

    // 更新练习记录
    const attempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        score: validScore,
        duration,
        completedAt: new Date(),
      },
      include: {
        steps: {
          include: {
            questionStep: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    });

    // 获取所有涉及的知识点和对应的步骤正确情况
    const knowledgeStats = new Map<string, { correct: number; total: number }>();

    attempt.steps.forEach(step => {
      const knowledgePoints = step.questionStep?.question?.knowledgePoints;
      if (knowledgePoints) {
        try {
          const points = JSON.parse(knowledgePoints);
          points.forEach((p: string) => {
            const stats = knowledgeStats.get(p) || { correct: 0, total: 0 };
            stats.total++;
            if (step.isCorrect) stats.correct++;
            knowledgeStats.set(p, stats);
          });
        } catch (e) {
          // ignore parse error
        }
      }
    });

    // 获取所有知识点 ID 映射（名称 -> ID）
    const allKnowledgePoints = await prisma.knowledgePoint.findMany({
      select: { id: true, name: true },
    });

    // 创建名称到 ID 的映射（支持模糊匹配）
    const nameToIdMap = new Map<string, string>();
    for (const kp of allKnowledgePoints) {
      nameToIdMap.set(kp.name, kp.id);
      // 添加别名映射（去除 E2E 前缀）
      if (kp.name.startsWith('E2E知识点-')) {
        const alias = kp.name.replace('E2E知识点-', '');
        nameToIdMap.set(alias, kp.id);
      }
    }

    // 更新每个知识点的掌握度
    for (const [knowledgePointName, stats] of knowledgeStats) {
      // 通过名称查找知识点 ID（支持模糊匹配）
      const knowledgePointId = nameToIdMap.get(knowledgePointName);

      // 如果找不到匹配的知识点，跳过
      if (!knowledgePointId) {
        console.warn(`知识点 "${knowledgePointName}" 未找到对应的 ID，跳过`);
        continue;
      }
      // 获取该知识点最近的练习记录（从 attemptStep 通过 questionStep -> question 获取）
      const recentAttempts = await prisma.attempt.findMany({
        where: {
          userId: session.user.id,
          completedAt: { not: null },
        },
        include: {
          steps: {
            include: {
              questionStep: {
                include: {
                  question: true,
                },
              },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
        take: 50,
      });

      // 统计该知识点的最近表现
      let totalCorrect = 0;
      let totalSteps = 0;
      for (const a of recentAttempts) {
        for (const s of a.steps) {
          const kps = s.questionStep?.question?.knowledgePoints;
          if (kps) {
            try {
              const points = JSON.parse(kps);
              // 检查是否包含当前知识点名称
              if (points.includes(knowledgePointName)) {
                totalSteps++;
                if (s.isCorrect) totalCorrect++;
              }
            } catch (e) {}
          }
        }
      }

      if (totalSteps > 0) {
        const mastery = totalCorrect / totalSteps;

        // 获取或创建用户知识点记录
        const existing = await prisma.userKnowledge.findUnique({
          where: {
            userId_knowledgePointId: {
              userId: session.user.id,
              knowledgePointId,
            },
          },
        });

        if (existing) {
          // 更新：使用指数移动平均
          const newMastery = existing.mastery * 0.7 + mastery * 0.3;
          await prisma.userKnowledge.update({
            where: { id: existing.id },
            data: {
              mastery: newMastery,
              practiceCount: existing.practiceCount + stats.total,
              lastPractice: new Date(),
            },
          });
        } else {
          // 创建新记录
          await prisma.userKnowledge.create({
            data: {
              userId: session.user.id,
              knowledgePointId,
              mastery,
              practiceCount: stats.total,
              lastPractice: new Date(),
            },
          });
        }
      }
    }

    // 集成游戏化：处理学习事件
    // 获取该Attempt的LE数据（如果有）
    const rlLog = await prisma.rLTrainingLog.findFirst({
      where: { attemptId },
      select: { leDelta: true },
    });

    const leDelta = rlLog?.leDelta ?? 0;

    // 为每个答题步骤处理游戏化事件
    // 注意：每个 step 需要唯一的 eventId，否则 CriticalHitLog 的 attemptId 唯一约束会冲突
    const gamificationRewards = [];
    for (const step of attempt.steps) {
      if (step.questionStep) {
        try {
          // 使用 step.id 作为 eventId 保证唯一性
          const reward = await gamificationListener.processEvent({
            eventId: step.id,
            attemptId: attempt.id,
            userId: session.user.id,
            questionId: step.questionStep.questionId,
            isCorrect: step.isCorrect,
            leDelta, // 使用整体LE
            duration: step.duration,
            timestamp: new Date(),
          });

          if (reward) {
            gamificationRewards.push({
              stepId: step.id,
              reward,
            });
          }
        } catch (error) {
          // 游戏化失败不影响练习完成
          console.error('[Gamification] Event processing error:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      attempt,
      gamificationRewards,
    });
  } catch (error) {
    console.error('完成练习错误:', error);
    return NextResponse.json({ error: '完成失败' }, { status: 500 });
  }
}
