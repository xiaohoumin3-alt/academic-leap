# 密码重置功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现邮箱验证码密码重置功能（开发模式：验证码直接显示）

**Architecture:** 使用 NextAuth 扩展 + Prisma 模型存储验证码。API 路由处理发送和验证，前端页面引导用户完成重置流程。

**Tech Stack:** Next.js 15, NextAuth v5, Prisma, bcrypt

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 添加 PasswordResetToken 模型 |
| `app/api/auth/forgot-password/route.ts` | 新建 | 发送验证码 API |
| `app/api/auth/reset-password/route.ts` | 新建 | 验证并重置密码 API |
| `app/forgot-password/page.tsx` | 新建 | 申请重置页面 |
| `app/reset-password/page.tsx` | 新建 | 设置新密码页面 |
| `app/login/page.tsx` | 修改 | 添加忘记密码链接 |

---

## Task 1: 添加数据库模型

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 打开 schema.prisma 末尾**

查看 User 模型位置，在其附近添加 PasswordResetToken 模型

- [ ] **Step 2: 添加模型**

在 schema 末尾添加：

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  email     String
  code      String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([email])
  @@index([code])
}
```

- [ ] **Step 3: 运行 Prisma migrate**

```bash
npx prisma migrate dev --name add_password_reset_token
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add PasswordResetToken model for password reset"
```

---

## Task 2: 创建发送验证码 API

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
});

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // 为防止邮箱枚举攻击，返回相同响应
      return NextResponse.json({
        success: true,
        message: '如果邮箱已注册，验证码已发送',
      });
    }

    // 使之前的未使用验证码失效
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // 生成新验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟后过期

    await prisma.passwordResetToken.create({
      data: { email, code, expiresAt },
    });

    // 开发模式：返回验证码
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      message: isDev ? '验证码已生成' : '验证码已发送到邮箱',
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
    console.error('[ForgotPassword] Error:', error);
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
git commit -m "feat: add forgot-password API endpoint"
```

---

## Task 3: 创建重置密码 API

**Files:**
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: 创建路由文件**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const resetPasswordSchema = z.object({
  email: z.string().email('无效的邮箱格式'),
  code: z.string().length(6, '验证码必须是6位'),
  newPassword: z.string().min(6, '密码至少6位'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = resetPasswordSchema.parse(body);

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

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    // 标记验证码已使用
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { used: true },
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
    console.error('[ResetPassword] Error:', error);
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
git commit -m "feat: add reset-password API endpoint"
```

---

## Task 4: 创建申请重置页面

**Files:**
- Create: `app/forgot-password/page.tsx`

- [ ] **Step 1: 创建页面组件**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
        headers: { 'Content-Type': 'application/json' },
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

## Task 5: 创建重置密码页面

**Files:**
- Create: `app/reset-password/page.tsx`

- [ ] **Step 1: 创建页面组件**

```tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
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

      const data = await res.json();

      if (!data.success) {
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

## Task 6: 修改登录页面添加链接

**Files:**
- Modify: `app/login/page.tsx:196` (密码输入框后)

- [ ] **Step 1: 在密码输入框后添加链接**

在 `</div>` (密码输入框包裹的div) 之后，`{error && ...}` 之前添加：

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

- [ ] **Step 2: 手动测试**

访问登录页，确认"忘记密码"链接显示且可点击

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add forgot password link to login page"
```

---

## Task 7: 验证流程端到端

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
- [ ] 代码风格一致
- [ ] 错误处理完善
- [ ] 无 console.log（除调试用）

---

**Plan complete.** 文件保存至 `docs/superpowers/plans/2026-04-30-password-reset.md`

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
