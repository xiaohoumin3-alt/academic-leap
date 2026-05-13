import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UOK } from '@/lib/qie';

const uok = new UOK();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const questionId = searchParams.get('questionId');

  // Load student state from UserKnowledge table (Phase 5: UOK doesn't call DB)
  if (studentId) {
    const userKnowledgeRecords = await prisma.userKnowledge.findMany({
      where: { userId: studentId },
      select: {
        knowledgePointId: true,
        mastery: true,
      },
    });

    const knowledgeData = new Map<string, number>();
    for (const record of userKnowledgeRecords) {
      knowledgeData.set(record.knowledgePointId, record.mastery);
    }

    uok.loadKnowledge(studentId, knowledgeData);
  }

  const target: { studentId?: string; questionId?: string } = {};
  if (studentId) target.studentId = studentId;
  if (questionId) target.questionId = questionId;

  const explanation = uok.explain(
    Object.keys(target).length > 0 ? target : undefined
  );

  return NextResponse.json(explanation);
}
