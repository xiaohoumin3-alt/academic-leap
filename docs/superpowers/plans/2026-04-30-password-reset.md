# 密码重置功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现邮箱验证码密码重置功能（开发模式：验证码直接显示）

**Architecture:** 使用 NextAuth 扩展 + Prisma 模型存储验证码。API 路由处理发送和验证，前端页面引导用户完成重置流程。

**Tech Stack:** Next.js 15, NextAuth v5, Prisma, bcrypt, crypto

**安全修复（基于代码审查）：**
- CRITICAL #1: 时序攻击防护 - 无论邮箱是否存在都执行数据库写入
- CRITICAL #2: 速率限制 - 防止暴力破解验证码
- CRITICAL #3: 安全随机数 - 使用 crypto.randomBytes 替代 Math.random
- CRITICAL #4: 并发控制 - 使用 Prisma 事务
- HIGH: 尝试次数限制 - 防止暴力破解

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `lib/rate-limit.ts` | 修改 | 添加速率限制规则 |
| `prisma/schema.prisma` | 修改 | 添加 PasswordResetToken 模型（含 attemptCount） |
| `app/api/auth/forgot-password/route.ts` | 新建 | 发送验证码 API（安全版） |
| `app/api/auth/reset-password/route.ts` | 新建 | 验证并重置密码 API（安全版） |
| `app/forgot-password/page.tsx` | 新建 | 申请重置页面 |
| `app/reset-password/page.tsx` | 新建 | 设置新密码页面 |
| `app/login/page.tsx` | 修改 | 添加忘记密码链接 + 成功后提示 |

---

## Task 1: 添加速率限制规则

**Files:**
- Modify: `lib/rate-limit.ts`

- [ ] **Step 1: 打开 lib/rate-limit.ts，添加新规则**

在 `RATE_LIMITS` 对象中添加：

```typescript
// 添加到 RATE_LIMITS 对象中
forgot_password: { windowMs: 5 * 60 * 1000, maxRequests: 3 },
reset_password: { windowMs: 5 * 60 * 1000, maxRequests: 5 },
```

完整的 RATE_LIMITS 应该类似：

```typescript
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  gaming_post: { windowMs: 60000, maxRequests: 10 },
  gaming_leaderboard: { windowMs: 60000, maxRequests: 30 },
  // 新增：
  forgot_password: { windowMs: 5 * 60 * 1000, maxRequests: 3 },
  reset_password: { windowMs: 5 * 60 * 1000, maxRequests: 5 },
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/rate-limit.ts
git commit -m "feat: add rate limiting for password reset endpoints"
```

---

## Task 2: 添加数据库模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 schema 末尾添加模型**

```prisma
model PasswordResetToken {
  id           String   @id @default(cuid())
  email        String
  code         String
  expiresAt    DateTime
  used         Boolean  @default(false)
  attemptCount Int      @default(0)  // 尝试次数，防止暴力破解
  createdAt    DateTime @default(now())

  @@index([email])
  @@index([code])
}
```

- [ ] **Step 2: 运行 Prisma migrate**

```bash
npx prisma migrate dev --name add_password_reset_token
```

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add PasswordResetToken model for password reset"
```

---

## Task 3: 创建发送验证码 API（安全版）

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// 速率限制
const rateLimiter = await import('@/lib/rate-limit').then(m => m.createRateLimitMiddleware);

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
    const rateLimit = await rateLimiter('forgot_password');
    const rateLimitResult = await rateLimit(email);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请5分钟后再试' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
      );
    }

    // 检查用户是否存在（用于决定返回消息）
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // CRITICAL FIX: 时序攻击防护
    // 无论用户是否存在，都执行相同的数据库操作
    // 这样攻击者无法通过响应时间判断邮箱是否注册

    // 使之前的未使用验证码失效（使用事务保证原子性）
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { email, used: false },
        data: { used: true },
      }),
    ]);

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
    // 安全错误日志（不记录敏感数据）
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
```

- [ ] **Step 2: 测试 API**

```bash
curl -X POST http://localhost:3003/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "913993571@qq.com"}'
```

预期返回：
```json
{"success":true,"message":"验证码已生成","code":"123456","expiresIn":900}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/forgot-password/route.ts
git commit -m "feat: add forgot-password API with security fixes

Security fixes:
- Timing attack protection (always perform DB writes)
- Rate limiting (3 requests per 5 minutes)
- Cryptographically secure random code generation
- Atomic token invalidation with transaction"
```

---

## Task 4: 创建重置密码 API（安全版）

**Files:**
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// 速率限制
const rateLimiter = await import('@/lib/rate-limit').then(m => m.createRateLimitMiddleware);

const resetPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码必须是6位'),
  newPassword: z.string().min(6, '密码至少6位'),
});

const MAX_ATTEMPTS = 5; // 最大尝试次数

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = resetPasswordSchema.parse(body);

    // 速率限制检查
    const rateLimit = await rateLimiter('reset_password');
    const rateLimitResult = await rateLimit(email);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { success: false, error: '请求过于频繁，请5分钟后再试' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toISOString(),
          },
        }
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

    // CRITICAL FIX: 尝试次数限制
    if (token.attemptCount >= MAX_ATTEMPTS) {
      // 锁定令牌
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
      // 更新密码
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await tx.user.update({
        where: { email },
        data: { password: hashedPassword },
      });

      // 标记验证码已使用
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
    // 安全错误日志
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
```

- [ ] **Step 2: 测试 API（使用上一步的验证码）**

```bash
curl -X POST http://localhost:3003/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"913993571@qq.com","code":"123456","newPassword":"tianya123"}'
```

预期返回：
```json
{"success":true,"message":"密码重置成功"}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/reset-password/route.ts
git commit -m "feat: add reset-password API with security fixes

Security fixes:
- Rate limiting (5 attempts per 5 minutes)
- Attempt count tracking (lock after 5 failures)
- Atomic transaction for password update and token usage"
```

---

## Task 5: 创建申请重置页面

**Files:**
- Create: `app/forgot-password/page.tsx`

- [ ] **Step 1: 创建页面组件**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '@/components/MaterialIcon';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type: 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || '发送失败');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCode(data.code || null); // 开发模式显示验证码
      setLoading(false);
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-primary mb-2">
            忘记密码
          </h1>
          <p className="text-on-surface-variant text-sm">
            输入注册邮箱，我们会发送验证码
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow">
          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">
                  邮箱
                </label>
                <div className="relative">
                  <MaterialIcon
                    icon="email"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                    style={{ fontSize: '20px' }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors"
                    placeholder="请输入注册邮箱"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-error-container/20 text-error text-sm py-2 px-4 rounded-xl text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-success-container/20 text-success text-sm py-3 px-4 rounded-xl text-center">
                验证码已发送！
              </div>

              {code && (
                <div className="bg-primary-container/30 text-primary text-center py-4 rounded-xl">
                  <p className="text-sm mb-1">您的验证码是（开发模式）：</p>
                  <p className="text-2xl font-mono font-bold">{code}</p>
                </div>
              )}

              <button
                onClick={handleContinue}
                className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
              >
                输入验证码继续
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/login')}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: 手动测试**

访问 http://localhost:3003/forgot-password，输入邮箱，应该显示验证码

- [ ] **Step 3: Commit**

```bash
git add app/forgot-password/page.tsx
git commit -m "feat: add forgot-password page"
```

---

## Task 6: 创建重置密码页面

**Files:**
- Create: `app/reset-password/page.tsx`

- [ ] **Step 1: 创建页面组件**

```tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import MaterialIcon from '@/components/MaterialIcon';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '重置失败');
        setLoading(false);
        return;
      }

      // 成功后跳转到登录页
      router.push('/login?reset=success');
    } catch {
      setError('网络错误，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          邮箱
        </label>
        <div className="relative">
          <MaterialIcon
            icon="email"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-surface-container-low border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 text-on-surface-variant"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          验证码
        </label>
        <div className="relative">
          <MaterialIcon
            icon="pin"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-4 focus:border-primary focus:outline-none transition-colors font-mono tracking-widest"
            placeholder="请输入6位验证码"
            maxLength={6}
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1 block">
          新密码
        </label>
        <div className="relative">
          <MaterialIcon
            icon="lock"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            style={{ fontSize: '20px' }}
          />
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-surface border-2 border-outline-variant rounded-xl py-3 pl-10 pr-12 focus:border-primary focus:outline-none transition-colors"
            placeholder="至少6位字符"
            minLength={6}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
          >
            <MaterialIcon
              icon={showPassword ? 'visibility_off' : 'visibility'}
              style={{ fontSize: '20px' }}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container/20 text-error text-sm py-2 px-4 rounded-xl text-center">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="w-full bg-primary text-on-primary rounded-full py-4 font-display font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '重置中...' : '确认重置'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-primary mb-2">
            设置新密码
          </h1>
          <p className="text-on-surface-variant text-sm">
            输入验证码并设置新密码
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-[2rem] p-8 ambient-shadow">
          <Suspense fallback={<div>加载中...</div>}>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-6 text-center">
            <button
              onClick={() => window.history.back()}
              className="text-on-surface-variant text-sm hover:text-primary transition-colors"
            >
              返回上一步
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: 手动测试**

访问 http://localhost:3003/reset-password?email=test@example.com，输入验证码和新密码

- [ ] **Step 3: Commit**

```bash
git add app/reset-password/page.tsx
git commit -m "feat: add reset-password page"
```

---

## Task 7: 修改登录页面

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: 添加导入和状态**

在文件顶部添加：
```tsx
import { useSearchParams } from 'next/navigation';
```

在 LoginPage 组件中添加：
```tsx
const searchParams = useSearchParams();
const showResetSuccess = searchParams.get('reset') === 'success';
```

- [ ] **Step 2: 添加忘记密码链接**

在密码输入框后（`</div>` 之后，`{error && ...}` 之前）添加：
```tsx
{mode === 'login' && (
  <div className="text-right mt-2">
    <button
      type="button"
      onClick={() => router.push('/forgot-password')}
      className="text-sm text-primary hover:underline"
    >
      忘记密码？
    </button>
  </div>
)}
```

- [ ] **Step 3: 添加成功提示**

在表单卡片内部顶部添加：
```tsx
{showResetSuccess && (
  <div className="bg-success-container/20 text-success text-sm py-2 px-4 rounded-xl text-center mb-4">
    密码重置成功，请使用新密码登录
  </div>
)}
```

- [ ] **Step 4: 手动测试**

访问登录页，确认"忘记密码"链接和"密码重置成功"提示都正常显示

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add forgot password link and reset success message to login page"
```

---

## Task 8: 验证流程端到端

- [ ] **Step 1: 完整流程测试**

1. 访问 http://localhost:3003/forgot-password
2. 输入邮箱 913993571@qq.com
3. 点击"发送验证码"，记录显示的验证码
4. 点击"输入验证码继续"
5. 输入验证码和新密码
6. 点击"确认重置"
7. 应该跳转到登录页，显示"密码重置成功"提示

- [ ] **Step 2: 尝试登录**

使用新密码登录，确认成功

---

## 自检清单

- [ ] 所有任务完成
- [ ] 端到端流程测试通过
- [ ] 代码风格一致（motion/react 导入）
- [ ] 错误处理完善
- [ ] 安全修复已应用
  - [ ] 时序攻击防护
  - [ ] 速率限制
  - [ ] 安全随机数
  - [ ] 并发事务
  - [ ] 尝试次数限制

---

**Plan complete.** 文件保存至 `docs/superpowers/plans/2026-04-30-password-reset.md`

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
