import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HealthMonitor } from '@/lib/rl/health/monitor';

const globalMonitor = new HealthMonitor();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = globalMonitor.check();

    let recommendation: 'rl' | 'rule' | 'stop';
    if (status.level === 'healthy' || status.level === 'warning') {
      recommendation = 'rl';
    } else if (status.level === 'danger') {
      recommendation = 'rule';
    } else {
      recommendation = 'stop';
    }

    return NextResponse.json({
      status: {
        level: status.level,
        metrics: status.metrics,
        alerts: status.alerts,
        timestamp: status.timestamp,
      },
      recommendation,
      lastUpdated: new Date(),
    });

  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
