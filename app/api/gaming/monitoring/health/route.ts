/**
 * Monitoring API - Health Check
 *
 * GET /api/gaming/monitoring/health
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { gamificationMonitor } from '@/lib/gaming/monitoring';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const health = await gamificationMonitor.healthCheck();

    return NextResponse.json(health);
  } catch (error) {
    console.error('[Monitoring API] HEALTH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
