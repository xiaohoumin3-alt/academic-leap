import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/user/knowledge-weight - 更新知识点权重
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { knowledgePointId, weight } = await req.json();

    // 验证权重范围
    if (weight < 1 || weight > 5) {
      return NextResponse.json({ error: '权重必须在 1-5 之间' }, { status: 400 });
    }

    // 更新权重
    await prisma.knowledgePoint.update({
      where: { id: knowledgePointId },
      data: { weight }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新权重错误:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// GET /api/user/knowledge-weight - 获取知识点权重
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const kps = await prisma.knowledgePoint.findMany({
      where: { name: { in: ['一元一次方程', '二次函数', '勾股定理', '概率统计'] } },
      select: { id: true, name: true, weight: true }
    });

    return NextResponse.json({ success: true, data: kps });
  } catch (error) {
    console.error('获取权重错误:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
