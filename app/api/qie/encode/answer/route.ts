import { NextRequest, NextResponse } from 'next/server';
import { UOK } from '@/lib/qie';

// Singleton UOK instance with persistence
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

    // Load student state from database if exists
    await uok.loadStudentState(body.studentId);

    // Encode answer (triggers ML learning)
    const probability = uok.encodeAnswer(body.studentId, body.questionId, body.correct);

    // Persist student state after learning
    await uok.saveStudentState(body.studentId);

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
