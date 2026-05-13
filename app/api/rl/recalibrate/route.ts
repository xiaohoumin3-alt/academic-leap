import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface RecalibrateRequest {
  reason: 'distribution_drift' | 'manual';
  scope: 'full' | 'partial';
}

export interface RecalibrateResponse {
  success: boolean;
  questionsRecalibrated: number;
  banditReset: boolean;
  note: string;
}

/**
 * Recalibrate RL bandit arms for a student
 *
 * ⚠️ This is a basic implementation - resets lastSelectedAt as a precursor
 * to exploration rate reset. Full Q-value reset is pending.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RecalibrateRequest = await req.json();

    if (!body.reason || !body.scope) {
      return NextResponse.json({ error: 'Missing required fields: reason, scope' }, { status: 400 });
    }

    const studentId = session.user.id;

    // Basic implementation: reset bandit arms to priors for exploration reset
    // Reset alpha/beta to initial values (priorAlpha=1, priorBeta=1)
    if (body.scope === 'full') {
      const deployedModels = await prisma.rLModelVersion.findMany({
        where: { status: 'DEPLOYED' },
        select: { id: true }
      });

      if (deployedModels.length > 0) {
        await prisma.rLBanditArm.updateMany({
          where: {
            modelId: { in: deployedModels.map(m => m.id) }
          },
          data: {
            alpha: 1,
            beta: 1,
            pullCount: 0,
            successCount: 0,
            avgReward: null
          }
        });
      }
    }

    const response: RecalibrateResponse = {
      success: true,
      questionsRecalibrated: 0, // TODO: Calculate actual count
      banditReset: body.scope === 'full',
      note: 'Basic implementation - bandit arms reset to priors. Full Q-value recalibration pending.',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Recalibrate error:', error);
    return NextResponse.json({ error: 'Recalibration failed' }, { status: 500 });
  }
}
