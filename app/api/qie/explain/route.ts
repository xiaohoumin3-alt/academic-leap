import { NextRequest, NextResponse } from 'next/server';
import { UOK } from '@/lib/qie';

const uok = new UOK();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('studentId');
  const questionId = searchParams.get('questionId');

  const target: { studentId?: string; questionId?: string } = {};
  if (studentId) target.studentId = studentId;
  if (questionId) target.questionId = questionId;

  const explanation = uok.explain(
    Object.keys(target).length > 0 ? target : undefined
  );

  return NextResponse.json(explanation);
}
