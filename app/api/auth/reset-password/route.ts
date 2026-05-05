import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createRateLimitMiddleware } from '@/lib/rate-limit';

const resetPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码必须是6位'),
  newPassword: z.string().min(6, '密码至少6位'),
});

const MAX_ATTEMPTS = 5;

// 速率限制配置
const RATE_LIMIT_CONFIG = { windowMs: 5 * 60 * 1000, maxRequests: 5 };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = resetPasswordSchema.parse(body);

    // 速率限制检查
    const rateLimit = createRateLimitMiddleware('reset_password', RATE_LIMIT_CONFIG);
    const rateLimitResult = await rateLimit(email);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请5分钟后再试' },
        { status: 429 }
      );
    }

    // 查找有效的验证码
    const token = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      return NextResponse.json(
        { success: false, error: '验证码无效或已过期' },
        { status: 400 }
      );
    }

    // 尝试次数限制
    if (token.attemptCount >= MAX_ATTEMPTS) {
      await prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { used: true },
      });
      return NextResponse.json(
        { success: false, error: '尝试次数过多，请重新获取验证码' },
        { status: 400 }
      );
    }

    // 验证码错误，增加尝试次数
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { attemptCount: { increment: 1 } },
    });

    // 使用事务完成密码更新和令牌使用
    await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await tx.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { used: true },
      });
    });

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('[ResetPassword] Error:', {
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
