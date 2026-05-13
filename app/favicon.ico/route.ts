/**
 * Favicon handler - prevents 404 errors for favicon.ico
 *
 * Returns a minimal 1x1 transparent PNG to satisfy browser requests
 */
import { NextResponse } from 'next/server';

export function GET() {
  // 1x1 transparent PNG (smallest valid favicon)
  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  return new NextResponse(transparentPng, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}