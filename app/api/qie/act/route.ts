import { NextRequest, NextResponse } from 'next/server';
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

    // Load student state from database if exists
    await uok.loadStudentState(body.studentId);

    const action = uok.act(body.intent, body.studentId);

    return NextResponse.json(action);
  } catch (error) {
    console.error('act error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
