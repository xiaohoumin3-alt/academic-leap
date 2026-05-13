// 动态导入 admin-auth 以避免 Edge Runtime 兼容性问题
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function verifyAdminTokenSafe(token: string): Promise<{ userId: string } | null> {
  try {
    const { verifyAdminToken } = await import('@/lib/admin-auth');
    return verifyAdminToken(token);
  } catch {
    return null;
  }
}

export default auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnAuthPage = req.nextUrl.pathname.startsWith('/(auth)');

  // 允许访问登录页面
  if (isOnLoginPage || isOnAuthPage) {
    return NextResponse.next();
  }

  // 管理控制台：需要登录或有效的 admin token
  if (req.nextUrl.pathname.startsWith('/console')) {
    // 允许访问控制台登录页
    if (req.nextUrl.pathname === '/console/login' || req.nextUrl.pathname === '/console') {
      return NextResponse.next();
    }
    // 检查是否已有 session
    if (isLoggedIn) {
      return NextResponse.next();
    }
    // 检查 admin token cookie - 动态导入避免 Edge Runtime 问题
    const adminToken = req.cookies.get('admin-token');
    if (adminToken?.value) {
      const payload = await verifyAdminTokenSafe(adminToken.value);
      if (payload) {
        return NextResponse.next();
      }
    }
    // 无效 token，重定向到控制台登录页
    const loginUrl = new URL('/console/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 未登录用户访问需要认证的页面时重定向到登录页
  if (!isLoggedIn && needsAuth(req.nextUrl.pathname)) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// 需要认证的路径
function needsAuth(pathname: string): boolean {
  const publicPaths = ['/', '/api/auth', '/console/login'];
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  // API 路径由各个路由自己处理认证
  if (pathname.startsWith('/api/')) {
    return false;
  }
  return true;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon文件)
     * - public folder 中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
