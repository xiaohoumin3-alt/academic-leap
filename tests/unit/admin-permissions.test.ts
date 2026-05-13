/**
 * Admin Permission 函数测试 (P0 CRITICAL)
 *
 * 验证权限函数从 lib/admin-auth.ts 统一导出，避免重复定义
 *
 * TDD 流程:
 * 1. RED: 编写失败测试
 * 2. GREEN: 实现修复
 * 3. REFACTOR: 清理代码
 */

// 设置环境变量必须在导入模块之前
process.env.ADMIN_SECRET = 'test-secret-key-for-jwt-signing';
process.env.DATABASE_URL = 'file:./dev.db';

import { canEdit, canDelete, canPublish, canManageUsers, canAccess } from '@/lib/admin-auth';

describe('Admin Permission Functions', () => {
  describe('canEdit - 编辑权限', () => {
    it('admin 角色应有编辑权限', () => {
      expect(canEdit('admin')).toBe(true);
    });

    it('editor 角色应有编辑权限', () => {
      expect(canEdit('editor')).toBe(true);
    });

    it('viewer 角色不应有编辑权限', () => {
      expect(canEdit('viewer')).toBe(false);
    });

    it('未知角色不应有编辑权限', () => {
      expect(canEdit('unknown')).toBe(false);
    });
  });

  describe('canDelete - 删除权限', () => {
    it('admin 角色应有删除权限', () => {
      expect(canDelete('admin')).toBe(true);
    });

    it('editor 角色不应有删除权限', () => {
      expect(canDelete('editor')).toBe(false);
    });

    it('viewer 角色不应有删除权限', () => {
      expect(canDelete('viewer')).toBe(false);
    });
  });

  describe('canPublish - 发布权限', () => {
    it('admin 角色应有发布权限', () => {
      expect(canPublish('admin')).toBe(true);
    });

    it('editor 角色应有发布权限', () => {
      expect(canPublish('editor')).toBe(true);
    });

    it('viewer 角色不应有发布权限', () => {
      expect(canPublish('viewer')).toBe(false);
    });
  });

  describe('canManageUsers - 用户管理权限', () => {
    it('admin 角色应能管理用户', () => {
      expect(canManageUsers('admin')).toBe(true);
    });

    it('editor 角色不应能管理用户', () => {
      expect(canManageUsers('editor')).toBe(false);
    });

    it('viewer 角色不应能管理用户', () => {
      expect(canManageUsers('viewer')).toBe(false);
    });
  });

  describe('canAccess - 功能访问控制', () => {
    describe('admin 角色权限', () => {
      const adminFeatures = ['dashboard', 'template', 'difficulty', 'data', 'quality', 'config', 'users'];

      it('admin 可访问 dashboard', () => {
        expect(canAccess('admin', 'dashboard')).toBe(true);
      });

      it('admin 可访问 template', () => {
        expect(canAccess('admin', 'template')).toBe(true);
      });

      it('admin 可访问 users', () => {
        expect(canAccess('admin', 'users')).toBe(true);
      });

      it('admin 可访问 config', () => {
        expect(canAccess('admin', 'config')).toBe(true);
      });
    });

    describe('editor 角色权限', () => {
      it('editor 可访问 dashboard', () => {
        expect(canAccess('editor', 'dashboard')).toBe(true);
      });

      it('editor 可访问 template', () => {
        expect(canAccess('editor', 'template')).toBe(true);
      });

      it('editor 可访问 difficulty', () => {
        expect(canAccess('editor', 'difficulty')).toBe(true);
      });

      it('editor 可访问 data', () => {
        expect(canAccess('editor', 'data')).toBe(true);
      });

      it('editor 可访问 quality', () => {
        expect(canAccess('editor', 'quality')).toBe(true);
      });

      it('editor 不可访问 users', () => {
        expect(canAccess('editor', 'users')).toBe(false);
      });

      it('editor 不可访问 config', () => {
        expect(canAccess('editor', 'config')).toBe(false);
      });
    });

    describe('viewer 角色权限', () => {
      it('viewer 可访问 dashboard', () => {
        expect(canAccess('viewer', 'dashboard')).toBe(true);
      });

      it('viewer 可访问 data', () => {
        expect(canAccess('viewer', 'data')).toBe(true);
      });

      it('viewer 可访问 quality', () => {
        expect(canAccess('viewer', 'quality')).toBe(true);
      });

      it('viewer 不可访问 template', () => {
        expect(canAccess('viewer', 'template')).toBe(false);
      });

      it('viewer 不可访问 difficulty', () => {
        expect(canAccess('viewer', 'difficulty')).toBe(false);
      });

      it('viewer 不可访问 users', () => {
        expect(canAccess('viewer', 'users')).toBe(false);
      });
    });

    describe('未知角色权限', () => {
      it('未知角色不可访问任何功能', () => {
        expect(canAccess('unknown', 'dashboard')).toBe(false);
        expect(canAccess('unknown', 'template')).toBe(false);
        expect(canAccess('unknown', 'data')).toBe(false);
      });
    });
  });
});

describe('Permission 函数应从 lib/admin-auth 导出 (代码质量检查)', () => {
  it('canEdit 函数应存在于 lib/admin-auth.ts', () => {
    // 这个测试验证 canEdit 在 lib/admin-auth.ts 中定义
    // 而不是在使用它的每个 route.ts 中重复定义
    const adminAuthSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/admin-auth.ts'),
      'utf8'
    );

    // 验证 lib/admin-auth.ts 包含 canEdit 定义
    expect(adminAuthSource).toContain('export function canEdit');

    // 验证不是简单内联函数 (应该有具体实现)
    expect(adminAuthSource).toMatch(/export function canEdit\(role.*?\)/s);
  });

  it('canDelete 函数应存在于 lib/admin-auth.ts', () => {
    const adminAuthSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/admin-auth.ts'),
      'utf8'
    );

    expect(adminAuthSource).toContain('export function canDelete');
  });

  it('canPublish 函数应存在于 lib/admin-auth.ts', () => {
    const adminAuthSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/admin-auth.ts'),
      'utf8'
    );

    expect(adminAuthSource).toContain('export function canPublish');
  });

  it('canManageUsers 函数应存在于 lib/admin-auth.ts', () => {
    const adminAuthSource = require('fs').readFileSync(
      require('path').join(__dirname, '../../lib/admin-auth.ts'),
      'utf8'
    );

    expect(adminAuthSource).toContain('export function canManageUsers');
  });
});