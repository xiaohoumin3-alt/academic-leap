/**
 * Gamification API - 游戏化主API
 *
 * GET /api/gaming - 获取玩家档案
 * POST /api/gaming - 处理游戏化事件
 * PATCH /api/gaming - 更新玩家设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRateLimitMiddleware } from '@/lib/rate-limit';
import { validateJson, gamingEventSchema, updatePlayerSchema, ValidationError } from '@/lib/schemas';

// 速率限制：每分钟10次游戏化事件
const rateLimit = createRateLimitMiddleware('gaming_event', {
  windowMs: 60000,
  maxRequests: 10,
});

/**
 * GET /api/gaming
 * 获取当前用户的玩家档案
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.playerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!profile) {
      // 创建默认档案
      const newProfile = await prisma.playerProfile.create({
        data: {
          userId: session.user.id,
          theme: 'adventure',
          character: 'explorer',
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      });
      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Gamification API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gaming
 * 处理学习事件，返回游戏化奖励
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 速率限制检查
    const rateLimitResult = await rateLimit(session.user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: rateLimitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
      );
    }

    // 验证输入
    const data = await validateJson(gamingEventSchema, request);

    // 导入游戏化监听器
    const { gamificationListener } = await import('@/lib/gaming/event-listener');

    // 处理事件
    const reward = await gamificationListener.processEvent({
      eventId: data.eventId,
      attemptId: data.attemptId,
      userId: session.user.id,
      questionId: data.questionId,
      isCorrect: data.isCorrect,
      leDelta: data.leDelta,
      duration: data.duration,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      reward,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toResponse(), { status: 400 });
    }
    console.error('[Gamification API] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gaming
 * 更新玩家设置（主题、角色）
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 验证输入
    const data = await validateJson(updatePlayerSchema, request);

    // 导入排行榜服务
    const { leaderboardService } = await import('@/lib/gaming/leaderboard');

    // 更新主题/角色
    await leaderboardService.updateUserTheme(
      session.user.id,
      data.theme || 'adventure',
      data.character || 'explorer'
    );

    // 获取更新后的档案
    const profile = await prisma.playerProfile.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(error.toResponse(), { status: 400 });
    }
    console.error('[Gamification API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
