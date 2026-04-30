# 密码重置功能设计

> **日期:** 2026-04-30
> **状态:** 已批准
> **更新:** 2026-04-30 - 添加安全修复

## 1. 概述

为登录页面添加密码重置功能，解决用户忘记密码后无法登录的问题。

**核心流程：** 邮箱验证码重置（开发模式：验证码直接显示）

---

## 2. 数据模型

### PasswordResetToken

```prisma
model PasswordResetToken {
  id           String   @id @default(cuid())
  email        String
  code         String   // 6位数字验证码
  expiresAt    DateTime // 15分钟后过期
  used         Boolean  @default(false)
  attemptCount Int      @default(0)  // 尝试次数，防止暴力破解
  createdAt    DateTime @default(now())

  @@index([email])
  @@index([code])
}
```

---

## 3. API 设计

### POST /api/auth/forgot-password

**请求：**
```json
{
  "email": "user@example.com"
}
```

**响应（开发模式）：**
```json
{
  "success": true,
  "message": "验证码已生成",
  "code": "123456",
  "expiresIn": 900
}
```

**响应（用户不存在）：**
```json
{
  "success": false,
  "error": "该邮箱未注册"
}
```

---

### POST /api/auth/reset-password

**请求：**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newPassword123"
}
```

**响应：**
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

---

## 4. 页面设计

### /app/forgot-password/page.tsx

- 输入邮箱
- 点击"发送验证码"
- 显示验证码（开发模式）
- 跳转到重置密码页面

### /app/reset-password/page.tsx

- 显示/隐藏验证码（开发模式）
- 输入新密码
- 点击"确认重置"
- 成功后跳转登录页

### /app/login/page.tsx 修改

- 密码输入框下方添加"忘记密码？"链接

---

## 5. 安全措施

| 措施 | 值 | 状态 |
|------|-----|------|
| 验证码长度 | 6位数字 | ✅ |
| 有效期 | 15分钟 | ✅ |
| 验证码使用次数 | 1次 | ✅ |
| 请求频率限制 | 5分钟内最多3次 | ✅ 已实现 |
| 密码最小长度 | 6字符 | ✅ |
| 尝试次数限制 | 5次后锁定 | ✅ 已实现 |
| 时序攻击防护 | 无论用户是否存在都执行DB操作 | ✅ 已实现 |
| 安全随机数 | crypto.randomBytes | ✅ 已实现 |
| 并发控制 | Prisma 事务 | ✅ 已实现 |

---

## 6. 文件清单

| 文件 | 操作 |
|------|------|
| lib/rate-limit.ts | 修改：添加速率限制规则 |
| prisma/schema.prisma | 添加 PasswordResetToken 模型 |
| app/api/auth/forgot-password/route.ts | 新建（安全版） |
| app/api/auth/reset-password/route.ts | 新建（安全版） |
| app/forgot-password/page.tsx | 新建 |
| app/reset-password/page.tsx | 新建 |
| app/login/page.tsx | 修改：添加忘记密码链接和成功提示 |

---

## 7. 后续扩展

- 接入真实邮件服务（Resend / SMTP）
- 邮件内容国际化
- 旧令牌清理定时任务
