
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    AUTH_TOKEN: process.env.AUTH_TOKEN ? 'SET: ' + process.env.AUTH_TOKEN.substring(0, 10) + '...' : 'NOT SET',
    BASE_URL: process.env.BASE_URL || 'NOT SET',
    MODEL: process.env.MODEL || 'NOT SET',
  });
}
