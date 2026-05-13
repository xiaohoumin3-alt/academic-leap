import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { createHmac } from 'crypto';
import { JWT } from 'next-auth/jwt';

const ADMIN_SECRET = process.env.ADMIN_SECRET as string;

if (!ADMIN_SECRET) {
  throw new Error('ADMIN_SECRET environment variable is required');
}

export interface AdminUser {
  id: string;
  userId: string;
  role: string;
}

export type AdminRole = 'admin' | 'editor' | 'viewer';

export interface TokenPayload {
  userId: string;
  createdAt: number;
}

export function verifyAdminToken(token: string): TokenPayload | null {
  try {
    const [payloadBase64, signature] = token.split('.');
    if (!payloadBase64 || !signature) return null;

    const expectedSignature = createHmac('sha256', ADMIN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString()) as TokenPayload;
    const age = Date.now() - payload.createdAt;
    // Token 有效期: 24 小时 (P0 CRITICAL 安全修复)
    const maxAge = 24 * 60 * 60 * 1000;
    if (age > maxAge) return null;

    return payload;
  } catch {
    return null;
  }
}

export function createAdminToken(userId: string): string {
  const payload: TokenPayload = { userId, createdAt: Date.now() };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = createHmac('sha256', ADMIN_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin-token')?.value;

    if (!token) return null;

    const payload = verifyAdminToken(token);
    if (!payload) return null;

    const admin = await prisma.admin.findUnique({
      where: { userId: payload.userId },
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

// ============ 资源所有权检查函数 (P0 CRITICAL) ============

export type ResourceType = 'template' | 'question' | 'templateVersion';

/**
 * 检查资源是否存在
 */
async function checkResourceExists(
  resourceId: string,
  resourceType: ResourceType
): Promise<boolean> {
  try {
    switch (resourceType) {
      case 'template':
        const template = await prisma.template.findUnique({
          where: { id: resourceId },
          select: { id: true }
        });
        return template !== null;

      case 'question':
        const question = await prisma.question.findUnique({
          where: { id: resourceId },
          select: { id: true }
        });
        return question !== null;

      case 'templateVersion':
        const templateVersion = await prisma.templateVersion.findUnique({
          where: { id: resourceId },
          select: { id: true }
        });
        return templateVersion !== null;

      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * 检查用户是否为资源所有者
 * @param resourceId 资源ID
 * @param userId 用户ID (admin record id)
 * @param resourceType 资源类型
 * @returns 是否为所有者
 */
export async function isResourceOwner(
  resourceId: string,
  userId: string,
  resourceType: ResourceType
): Promise<boolean> {
  try {
    let createdBy: string | null = null;

    switch (resourceType) {
      case 'template':
        const template = await prisma.template.findUnique({
          where: { id: resourceId },
          select: { createdBy: true }
        });
        createdBy = template?.createdBy ?? null;
        break;

      case 'question':
        const question = await prisma.question.findUnique({
          where: { id: resourceId },
          select: { createdBy: true }
        });
        createdBy = question?.createdBy ?? null;
        break;

      case 'templateVersion':
        const tv = await prisma.templateVersion.findUnique({
          where: { id: resourceId },
          select: { createdBy: true }
        });
        createdBy = tv?.createdBy ?? null;
        break;

      default:
        return false;
    }

    return createdBy === userId;
  } catch {
    return false;
  }
}

/**
 * 检查用户是否可以编辑资源
 * - admin: 可以编辑任何存在的资源
 * - editor: 只能编辑自己创建的资源
 * - viewer: 不能编辑任何资源
 */
export async function canEditResource(
  resourceId: string,
  userId: string,
  role: string,
  resourceType: ResourceType
): Promise<boolean> {
  // 检查资源是否存在
  const exists = await checkResourceExists(resourceId, resourceType);
  if (!exists) {
    return false;
  }

  // admin 可以编辑任何资源
  if (role === 'admin') {
    return true;
  }

  // editor 需要检查所有权
  if (role === 'editor') {
    return isResourceOwner(resourceId, userId, resourceType);
  }

  // viewer 不能编辑
  return false;
}

/**
 * 检查用户是否可以删除资源
 * - admin: 可以删除任何资源
 * - 其他角色: 不能删除
 */
export async function canDeleteResource(
  resourceId: string,
  userId: string,
  role: string,
  resourceType: ResourceType
): Promise<boolean> {
  // 只有 admin 可以删除
  if (role !== 'admin') {
    return false;
  }

  return true;
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
