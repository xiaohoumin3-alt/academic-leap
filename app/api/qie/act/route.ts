import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UOK } from '@/lib/qie';

const uok = new UOK();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.intent || !body.studentId) {
      return NextResponse.json(
        { error: 'Missing required fields: intent, studentId' },
        { status: 400 }
      );
    }

    if (body.intent !== 'next_question' && body.intent !== 'gap_analysis') {
      return NextResponse.json(
        { error: 'Invalid intent. Use: next_question, gap_analysis' },
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

    const action = uok.act(body.intent, body.studentId);

    return NextResponse.json(action);
  } catch (error) {
    console.error('act error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
