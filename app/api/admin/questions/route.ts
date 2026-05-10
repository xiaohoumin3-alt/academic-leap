import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const knowledgePointId = searchParams.get('knowledgePointId');
    const difficultyMin = searchParams.get('difficultyMin');
    const difficultyMax = searchParams.get('difficultyMax');
    const complexityMin = searchParams.get('complexityMin');
    const complexityMax = searchParams.get('complexityMax');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (knowledgePointId) {
      // knowledgePoints is a JSON string array, use exact match with quotes
      where.knowledgePoints = {
        contains: `"${knowledgePointId}"`,
      };
    }

    if (difficultyMin || difficultyMax) {
      where.difficulty = {};
      if (difficultyMin) (where.difficulty as Record<string, number>).gte = parseInt(difficultyMin);
      if (difficultyMax) (where.difficulty as Record<string, number>).lte = parseInt(difficultyMax);
    }

    // complexity字段已移除，使用cognitiveLoad和reasoningDepth替代
    // 如果需要按复杂度筛选，请使用 cognitiveLoad 和 reasoningDepth 参数

    if (status) {
      where.extractionStatus = status;
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        questions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Failed to get questions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '获取题目列表失败' } },
      { status: 500 }
    );
  }
}
