/**
 * Parental Control API - Daily Report
 *
 * GET /api/gaming/parental/report
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

    const report = await parentalControlService.getDailyReport(
      session.user.id
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Parental Control API] REPORT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
