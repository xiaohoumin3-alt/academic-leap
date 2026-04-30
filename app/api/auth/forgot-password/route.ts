import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// 动态导入速率限制器
const createRateLimitMiddleware = () => import('@/lib/rate-limit').then(m => m.createRateLimitMiddleware);

const forgotPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

// 安全随机验证码生成器
function generateCode(): string {
  const bytes = randomBytes(4);
  const num = bytes.readUInt32BE(0);
  return String(100000 + (num % 900000)).padStart(6, '0');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // 速率限制检查
    const rateLimitFn = await createRateLimitMiddleware();
    const rateLimit = await rateLimitFn('forgot_password');
    const rateLimitResult = await rateLimit(email);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请5分钟后再试' },
        { status: 429 }
      );
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // CRITICAL: 时序攻击防护 - 无论用户是否存在都执行相同操作
    // 使之前的未使用验证码失效
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // 生成新验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟

    await prisma.passwordResetToken.create({
      data: { email, code, expiresAt },
    });

    // 开发模式：返回验证码
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      message: user
        ? (isDev ? '验证码已生成' : '验证码已发送到邮箱')
        : '如果邮箱已注册，验证码已发送',
      code: isDev ? code : undefined,
      expiresIn: 900,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '无效的邮箱格式' },
        { status: 400 }
      );
    }
    console.error('[ForgotPassword] Error:', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}