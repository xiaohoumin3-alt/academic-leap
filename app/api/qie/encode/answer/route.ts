import { NextRequest, NextResponse } from 'next/server';
import { UOK } from '@/lib/qie';

// Use the same singleton
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

    const probability = uok.encodeAnswer(body.studentId, body.questionId, body.correct);

    return NextResponse.json({ ok: true, probability });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
