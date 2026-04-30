/**
 * Monitoring API - Noise Analysis
 *
 * GET /api/gaming/monitoring/noise
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

    const report = await gamificationMonitor.getNoiseAnalysisReport();

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Monitoring API] NOISE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
