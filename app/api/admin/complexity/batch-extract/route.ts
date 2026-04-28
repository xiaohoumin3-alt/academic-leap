import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Check edit permission
    if (admin.role !== 'admin' && admin.role !== 'editor') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // Trigger extraction in background
    spawn('npx', ['tsx', 'scripts/extract-stable.ts'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    }).unref();

    revalidatePath('/console');

    return NextResponse.json({
      success: true,
      message: '提取任务已在后台启动',
    });
  } catch (error) {
    console.error('启动提取失败:', error);
    return NextResponse.json({ error: '启动提取失败' }, { status: 500 });
  }
}
