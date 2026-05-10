import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const session = await auth();
  const cookieStore = await cookies();

  // Get all cookie names
  const cookieNames = Array.from(cookieStore.getAll()).map(c => c.name);

  // Try to get authjs cookie
  const authjsCookie = cookieStore.get('authjs.session-token');

  return NextResponse.json({
    hasSession: !!session,
    user: session?.user ? {
      id: (session.user as any).id,
      email: session.user.email,
      name: session.user.name,
    } : null,
    cookieNames,
    authjsCookieExists: !!authjsCookie,
    timestamp: new Date().toISOString(),
  });
}
