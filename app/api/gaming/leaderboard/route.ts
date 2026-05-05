/**
 * Leaderboard API - 排行榜API
 *
 * GET /api/gaming/leaderboard?theme=magic-academy&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { leaderboardService } from '@/lib/gaming/leaderboard';

/**
 * GET /api/gaming/leaderboard
 * 获取排行榜
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const theme = searchParams.get('theme') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 验证主题
    const validThemes = ['magic-academy', 'career', 'racing', 'detective'];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json(
        { error: 'Invalid theme' },
        { status: 400 }
      );
    }

    // 获取排行榜
    const result = await leaderboardService.getLeaderboard({
      theme,
      limit: Math.min(limit, 100), // 最大100
      offset,
    });

    // 获取当前用户排名
    const userRank = await leaderboardService.getUserRank(session.user.id, {
      theme,
    });

    return NextResponse.json({
      ...result,
      userRank,
    });
  } catch (error) {
    console.error('[Leaderboard API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
