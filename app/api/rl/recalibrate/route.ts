import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export interface RecalibrateRequest {
  reason: 'distribution_drift' | 'manual';
  scope: 'full' | 'partial';
}

export interface RecalibrateResponse {
  success: boolean;
  changes: {
    questionsRecalibrated: number;
    banditReset: boolean;
  };
  timestamp: Date;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RecalibrateRequest = await request.json();

    if (!body.reason || !body.scope) {
      return NextResponse.json({ error: 'Missing required fields: reason, scope' }, { status: 400 });
    }

    if (!['distribution_drift', 'manual'].includes(body.reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }

    if (!['full', 'partial'].includes(body.scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    // TODO: Implement actual recalibration logic
    // For now, return placeholder response
    const changes = {
      questionsRecalibrated: body.scope === 'full' ? -1 : 0,
      banditReset: body.scope === 'full',
    };

    const response: RecalibrateResponse = {
      success: true,
      changes,
      timestamp: new Date(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Recalibrate error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
