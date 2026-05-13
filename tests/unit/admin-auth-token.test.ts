/**
 * Admin Token 有效期测试 (P0 CRITICAL)
 *
 * 验证 Token 有效期为 24 小时，而非 7 天
 *
 * TDD 流程:
 * 1. RED: 编写失败测试
 * 2. GREEN: 实现修复
 * 3. REFACTOR: 清理代码
 */

// 设置环境变量必须在导入模块之前
const TEST_ADMIN_SECRET = 'test-secret-key-for-jwt-signing';
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;

// 动态导入模块 (在设置环境变量之后)
import { verifyAdminToken, createAdminToken, TokenPayload } from '@/lib/admin-auth';

// 验证环境变量已设置
if (!process.env.ADMIN_SECRET) {
  throw new Error('ADMIN_SECRET must be set before importing admin-auth module');
}

describe('Admin Token 有效期验证', () => {
  // Token 有效期常量: 24 小时 (毫秒)
  const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  describe('Token 有效期应为 24 小时', () => {
    it('新创建的 Token 应在 24 小时内有效', () => {
      const userId = 'user-123';
      const token = createAdminToken(userId);

      const payload = verifyAdminToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(userId);
    });

    it('有效期刚好 24 小时的 Token 应返回 null (边界值)', () => {
      const userId = 'user-boundary';

      // 手动构造刚好过期的 Token
      const expiredPayload: TokenPayload = {
        userId,
        createdAt: Date.now() - TOKEN_MAX_AGE_MS - 1 // 超过 24 小时 1 毫秒
      };

      const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret-key-for-jwt-signing')
        .update(payloadBase64)
        .digest('base64url');

      const expiredToken = `${payloadBase64}.${signature}`;
      const result = verifyAdminToken(expiredToken);

      expect(result).toBeNull();
    });

    it('有效期 23 小时的 Token 应仍然有效', () => {
      const userId = 'user-23h';

      // 构造有效期 23 小时的 Token
      const validPayload: TokenPayload = {
        userId,
        createdAt: Date.now() - (23 * 60 * 60 * 1000) // 23 小时前
      };

      const payloadBase64 = Buffer.from(JSON.stringify(validPayload)).toString('base64');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret-key-for-jwt-signing')
        .update(payloadBase64)
        .digest('base64url');

      const validToken = `${payloadBase64}.${signature}`;
      const result = verifyAdminToken(validToken);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
    });

    it('有效期超过 24 小时的 Token (原 7 天场景) 应返回 null', () => {
      const userId = 'user-old';

      // 构造 7 天前的 Token (模拟旧的有效期配置)
      const oldPayload: TokenPayload = {
        userId,
        createdAt: Date.now() - (7 * 24 * 60 * 60 * 1000)
      };

      const payloadBase64 = Buffer.from(JSON.stringify(oldPayload)).toString('base64');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret-key-for-jwt-signing')
        .update(payloadBase64)
        .digest('base64url');

      const oldToken = `${payloadBase64}.${signature}`;
      const result = verifyAdminToken(oldToken);

      expect(result).toBeNull();
    });
  });

  describe('Token 有效性边界测试', () => {
    it('createdAt 为当前时间的 Token 应有效', () => {
      const userId = 'user-now';
      const token = createAdminToken(userId);

      const result = verifyAdminToken(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
    });

    it('createdAt 为 1 分钟前的 Token 应有效', () => {
      const userId = 'user-1min';
      const oneMinuteAgo = Date.now() - 60 * 1000;

      const validPayload: TokenPayload = {
        userId,
        createdAt: oneMinuteAgo
      };

      const payloadBase64 = Buffer.from(JSON.stringify(validPayload)).toString('base64');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret-key-for-jwt-signing')
        .update(payloadBase64)
        .digest('base64url');

      const validToken = `${payloadBase64}.${signature}`;
      const result = verifyAdminToken(validToken);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(userId);
    });

    it('createdAt 为 24 小时零 1 秒前的 Token 应失效', () => {
      const userId = 'user-24h1s';
      const slightlyOver24h = 24 * 60 * 60 * 1000 + 1000; // 24h + 1s

      const expiredPayload: TokenPayload = {
        userId,
        createdAt: Date.now() - slightlyOver24h
      };

      const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'test-secret-key-for-jwt-signing')
        .update(payloadBase64)
        .digest('base64url');

      const expiredToken = `${payloadBase64}.${signature}`;
      const result = verifyAdminToken(expiredToken);

      expect(result).toBeNull();
    });
  });

  describe('Token 格式错误处理', () => {
    it('无效格式的 Token 应返回 null', () => {
      expect(verifyAdminToken('invalid-token')).toBeNull();
    });

    it('空字符串 Token 应返回 null', () => {
      expect(verifyAdminToken('')).toBeNull();
    });

    it('缺少签名的 Token 应返回 null', () => {
      const payloadBase64 = Buffer.from(JSON.stringify({ userId: 'test' })).toString('base64');
      expect(verifyAdminToken(payloadBase64)).toBeNull();
    });

    it('错误签名的 Token 应返回 null', () => {
      const payloadBase64 = Buffer.from(JSON.stringify({ userId: 'test' })).toString('base64');
      expect(verifyAdminToken(`${payloadBase64}.invalid-signature`)).toBeNull();
    });
  });
});