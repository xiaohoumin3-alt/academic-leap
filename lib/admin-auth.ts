import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { JWT } from 'next-auth/jwt';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-admin-secret-change-in-production';

export interface AdminUser {
  id: string;
  userId: string;
  role: string;
}

export type AdminRole = 'admin' | 'editor' | 'viewer';

export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) return null;

    const decoded = JSON.parse(atob(token));
    const admin = await prisma.admin.findUnique({
      where: { userId: decoded.userId },
      include: { user: true }
    });

    if (!admin) return null;

    return {
      id: admin.id,
      userId: admin.userId,
      role: admin.role
    };
  } catch {
    return null;
  }
}

export async function requireAdmin(role?: AdminRole): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  if (role && admin.role !== role && admin.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return admin;
}

export function createAdminToken(userId: string): string {
  const payload = { userId, createdAt: Date.now() };
  return btoa(JSON.stringify(payload));
}

// 权限检查函数
export function canEdit(role: string): boolean {
  return role === 'admin' || role === 'editor';
}

export function canDelete(role: string): boolean {
  return role === 'admin';
}

export function canPublish(role: string): boolean {
  return role === 'admin' || role === 'editor';
}

export function canManageUsers(role: string): boolean {
  return role === 'admin';
}

export function canAccess(role: string, feature: string): boolean {
  const permissions: Record<string, string[]> = {
    admin: ['dashboard', 'template', 'difficulty', 'data', 'quality', 'config', 'users'],
    editor: ['dashboard', 'template', 'difficulty', 'data', 'quality'],
    viewer: ['dashboard', 'data', 'quality']
  };
  return permissions[role]?.includes(feature) || false;
}

// 操作日志
export async function logAuditAction(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  changes: Record<string, any>,
  req?: Request
) {
  try {
    const ip = req?.headers.get('x-forwarded-for') || req?.headers.get('x-real-ip') || null;
    const userAgent = req?.headers.get('user-agent') || null;

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        changes,
        ip,
        userAgent
      }
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
}
