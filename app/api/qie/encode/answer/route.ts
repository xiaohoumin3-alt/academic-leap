import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UOK } from '@/lib/qie';

// Singleton UOK instance (Phase 5: no persistence in UOK)
const uok = new UOK();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.studentId || !body.questionId || typeof body.correct !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, questionId, correct' },
        { status: 400 }
      );
    }

    // Load student state from UserKnowledge table (Phase 5: UOK doesn't call DB)
    const userKnowledgeRecords = await prisma.userKnowledge.findMany({
      where: { userId: body.studentId },
      select: {
        knowledgePointId: true,
        mastery: true,
      },
    });

    const knowledgeData = new Map<string, number>();
    for (const record of userKnowledgeRecords) {
      knowledgeData.set(record.knowledgePointId, record.mastery);
    }

    uok.loadKnowledge(body.studentId, knowledgeData);

    // Encode answer (triggers ML learning)
    const probability = uok.encodeAnswer(body.studentId, body.questionId, body.correct);

    // Phase 5: Persistence is handled by caller (not UOK)
    // Note: This endpoint returns probability only; caller should persist state

    // Get updated transfer weights for debugging
    const weights = uok.getComplexityTransferWeights();

    return NextResponse.json({
      ok: true,
      probability,
      transferWeights: weights,
    });
  } catch (error) {
    console.error('encode/answer error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
