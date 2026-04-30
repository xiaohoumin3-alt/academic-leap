/**
 * Monitoring API - Experiment Report
 *
 * GET /api/gaming/monitoring/experiment
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

    const report = await gamificationMonitor.getExperimentReport();

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Monitoring API] EXPERIMENT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
