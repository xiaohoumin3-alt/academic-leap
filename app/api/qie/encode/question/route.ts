import { NextRequest, NextResponse } from 'next/server';
import { UOK } from '@/lib/qie';

// Singleton instance
const uok = new UOK();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id || !body.content || !body.topics) {
      return NextResponse.json(
        { error: 'Missing required fields: id, content, topics' },
        { status: 400 }
      );
    }

    uok.encodeQuestion(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
