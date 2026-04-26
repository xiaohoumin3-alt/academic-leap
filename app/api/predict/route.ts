import { NextRequest, NextResponse } from 'next/server';
import { getPredictionClient } from '@/lib/prediction/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getPredictionClient();

    const result = await client.predictSafe(body as any);

    if (!result) {
      return NextResponse.json(
        { error: 'Prediction service unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}