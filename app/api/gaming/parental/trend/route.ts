/**
 * Parental Control API - Trend Report
 *
 * GET /api/gaming/parental/trend?days=7
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { parentalControlService } from '@/lib/gaming/parental-control';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');

    const trend = await parentalControlService.getTrendReport(
      session.user.id,
      Math.min(days, 30)
    );

    return NextResponse.json(trend);
  } catch (error) {
    console.error('[Parental Control API] TREND error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
