/**
 * Achievements API - 成就API
 *
 * GET /api/gaming/achievements - 获取用户成就
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { achievementService } from '@/lib/gaming/achievements';

/**
 * GET /api/gaming/achievements
 * 获取用户成就
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const achievements = await achievementService.getUserAchievements(
      session.user.id
    );

    return NextResponse.json({
      achievements,
    });
  } catch (error) {
    console.error('[Achievements API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
