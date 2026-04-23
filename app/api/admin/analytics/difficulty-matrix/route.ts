import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const attempts = await prisma.attempt.findMany({
      where: { completedAt: { not: null } },
      include: { steps: true }
    });

    const levelStats: Record<number, {
      total: number;
      correct: number;
      totalTime: number;
      retries: number;
    }> = {};

    for (let level = 0; level <= 4; level++) {
      levelStats[level] = { total: 0, correct: 0, totalTime: 0, retries: 0 };
    }

    for (const attempt of attempts) {
      for (const step of attempt.steps) {
        const level = Math.min(4, Math.max(0, Math.floor(step.stepNumber / 5)));
        levelStats[level].total++;
        levelStats[level].totalTime += step.duration;
        if (step.isCorrect) {
          levelStats[level].correct++;
        } else {
          levelStats[level].retries++;
        }
      }
    }

    const levels = Object.entries(levelStats).map(([level, stats]) => ({
      level: parseInt(level),
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      avgTime: stats.total > 0 ? Math.round(stats.totalTime / stats.total / 1000) : 0,
      retryRate: stats.total > 0 ? Math.round((stats.retries / stats.total) * 100) : 0,
      sampleCount: stats.total
    }));

    const anomalies: Array<{ from: number; to: number; dropRate: number; severity: string }> = [];

    for (let i = 0; i < levels.length - 1; i++) {
      const current = levels[i];
      const next = levels[i + 1];
      if (current.accuracy > 0 && next.accuracy > 0) {
        const dropRate = current.accuracy - next.accuracy;
        if (dropRate > 25) {
          anomalies.push({
            from: current.level,
            to: next.level,
            dropRate,
            severity: dropRate > 40 ? 'high' : 'medium'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        levels,
        anomalies
      }
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '未授权', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
