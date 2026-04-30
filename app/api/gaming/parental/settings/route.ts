/**
 * Parental Control API - Settings
 *
 * GET /api/gaming/parental/settings - 获取设置
 * PUT /api/gaming/parental/settings - 更新设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parentalControlService } from '@/lib/gaming/parental-control';

/**
 * GET /api/gaming/parental/settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await parentalControlService.getSettings(
      session.user.id
    );

    const [timeRestriction, xpCap] = await Promise.all([
      parentalControlService.checkTimeRestriction(session.user.id),
      parentalControlService.checkDailyXPCap(session.user.id),
    ]);

    return NextResponse.json({
      settings,
      status: {
        timeRestriction,
        xpCap,
      },
    });
  } catch (error) {
    console.error('[Parental Control API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/gaming/parental/settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      gamificationEnabled,
      dailyXPCap,
      allowedTimeStart,
      allowedTimeEnd,
      showRankings,
      rewardThreshold,
    } = body;

    // 时间验证函数
    const validateTime = (timeStr: string): boolean => {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(timeStr)) return false;

      const [hour, minute] = timeStr.split(':').map(Number);
      // 双重验证：格式 + 逻辑范围
      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    };

    if (allowedTimeStart && !validateTime(allowedTimeStart)) {
      return NextResponse.json(
        { error: 'Invalid time format for allowedTimeStart' },
        { status: 400 }
      );
    }
    if (allowedTimeEnd && !validateTime(allowedTimeEnd)) {
      return NextResponse.json(
        { error: 'Invalid time format for allowedTimeEnd' },
        { status: 400 }
      );
    }

    // 验证时间逻辑：结束时间应该晚于开始时间（同一天内）
    if (allowedTimeStart && allowedTimeEnd) {
      const [startHour, startMin] = allowedTimeStart.split(':').map(Number);
      const [endHour, endMin] = allowedTimeEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        return NextResponse.json(
          { error: 'allowedTimeEnd must be after allowedTimeStart' },
          { status: 400 }
        );
      }
    }

    if (dailyXPCap !== undefined && (dailyXPCap < 0 || dailyXPCap > 5000)) {
      return NextResponse.json(
        { error: 'dailyXPCap must be between 0 and 5000' },
        { status: 400 }
      );
    }

    const settings = await parentalControlService.updateSettings(
      session.user.id,
      {
        gamificationEnabled,
        dailyXPCap,
        allowedTimeStart,
        allowedTimeEnd,
        showRankings,
        rewardThreshold,
      }
    );

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Parental Control API] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
