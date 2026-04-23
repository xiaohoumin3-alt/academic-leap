import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnAuthPage = req.nextUrl.pathname.startsWith('/(auth)');

  // 允许访问登录页面和管理控制台登录
  if (isOnLoginPage || isOnAuthPage) {
    return NextResponse.next();
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
  const publicPaths = ['/', '/api/auth'];
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  // API 路径由各个路由自己处理认证
  if (pathname.startsWith('/api/')) {
    return false;
  }
  // 管理控制台单独处理
  if (pathname.startsWith('/console')) {
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
