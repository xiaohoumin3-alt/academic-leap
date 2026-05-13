/**
 * Admin 资源所有权检查测试 (P0 CRITICAL)
 *
 * 验证资源所有权检查功能，确保 editor 只能编辑自己创建的模板
 *
 * TDD 流程:
 * 1. RED: 编写失败测试
 * 2. GREEN: 实现修复
 * 3. REFACTOR: 清理代码
 */

// 设置环境变量
process.env.ADMIN_SECRET = 'test-secret-key-for-jwt-signing';
process.env.DATABASE_URL = 'file:./test-resource-owner.db';

import { isResourceOwner, canEditResource, canDeleteResource } from '@/lib/admin-auth';
import type { ResourceType } from '@/lib/admin-auth';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    template: {
      findUnique: jest.fn()
    },
    question: {
      findUnique: jest.fn()
    },
    templateVersion: {
      findUnique: jest.fn()
    }
  }
}));

import { prisma } from '@/lib/prisma';

describe('Admin 资源所有权检查', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isResourceOwner - 资源所有权检查', () => {
    it('资源创建者应被识别为所有者', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'admin-1'
      });

      const result = await isResourceOwner('template-1', 'admin-1', 'template');
      expect(result).toBe(true);
    });

    it('非创建者应不被识别为所有者', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'admin-1'
      });

      const result = await isResourceOwner('template-1', 'admin-2', 'template');
      expect(result).toBe(false);
    });

    it('admin 角色可编辑任何资源 (绕过所有权检查)', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'admin-other'
      });

      // Admin 应该有权限编辑任何资源
      const result = await canEditResource('template-1', 'admin-1', 'admin', 'template');
      expect(result).toBe(true);
    });

    it('editor 只能编辑自己创建的资源', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'editor-1'
      });

      // Editor 编辑自己的资源 - 应该允许
      const result1 = await canEditResource('template-1', 'editor-1', 'editor', 'template');
      expect(result1).toBe(true);

      // Editor 尝试编辑他人的资源 - 应该拒绝
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-2',
        createdBy: 'editor-2'
      });

      const result2 = await canEditResource('template-2', 'editor-1', 'editor', 'template');
      expect(result2).toBe(false);
    });

    it('viewer 不能编辑任何资源', async () => {
      const result = await canEditResource('template-1', 'viewer-1', 'viewer', 'template');
      expect(result).toBe(false);
    });

    it('不存在的资源应返回 false', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await canEditResource('non-existent', 'admin-1', 'admin', 'template');
      expect(result).toBe(false);
    });
  });

  describe('canDeleteResource - 删除权限检查', () => {
    it('只有 admin 可删除资源', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'admin-1'
      });

      // Admin 删除自己的资源 - 应该允许
      expect(await canDeleteResource('template-1', 'admin-1', 'admin', 'template')).toBe(true);

      // Editor 尝试删除 - 应该拒绝
      expect(await canDeleteResource('template-1', 'editor-1', 'editor', 'template')).toBe(false);

      // Viewer 尝试删除 - 应该拒绝
      expect(await canDeleteResource('template-1', 'viewer-1', 'viewer', 'template')).toBe(false);
    });

    it('admin 可删除任何资源', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'other-admin'
      });

      // Admin 删除他人的资源 - 应该允许
      const result = await canDeleteResource('template-1', 'admin-1', 'admin', 'template');
      expect(result).toBe(true);
    });
  });

  describe('资源类型支持', () => {
    it('应支持 template 资源类型', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue({
        id: 'template-1',
        createdBy: 'admin-1'
      });

      const result = await isResourceOwner('template-1', 'admin-1', 'template');
      expect(result).toBe(true);
      expect(prisma.template.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        select: { createdBy: true }
      });
    });

    it('应支持 question 资源类型', async () => {
      (prisma.question.findUnique as jest.Mock).mockResolvedValue({
        id: 'question-1',
        createdBy: 'admin-1'
      });

      const result = await isResourceOwner('question-1', 'admin-1', 'question');
      expect(result).toBe(true);
      expect(prisma.question.findUnique).toHaveBeenCalledWith({
        where: { id: 'question-1' },
        select: { createdBy: true }
      });
    });

    it('不支持的资源类型应返回 false', async () => {
      const result = await isResourceOwner('resource-1', 'admin-1', 'templateVersion' as ResourceType);
      expect(result).toBe(false);
    });
  });
});