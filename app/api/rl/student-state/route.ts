import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get IRT state
    const irtState = await prisma.iRTStudentState.findUnique({
      where: { userId: session.user.id }
    });

    // Get knowledge point states
    const kpStates = await prisma.lEKnowledgePointState.findMany({
      where: { userId: session.user.id },
      take: 20
    });

    return NextResponse.json({
      irt: {
        theta: irtState?.theta ?? 0,
        confidence: irtState?.confidence ?? 1,
        responseCount: irtState?.responseCount ?? 0
      },
      knowledgePoints: kpStates.map(kp => ({
        knowledgePointId: kp.knowledgePointId,
        accuracy: kp.accuracy,
        totalAttempts: kp.total
      }))
    });

  } catch (error) {
    console.error('Student state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
