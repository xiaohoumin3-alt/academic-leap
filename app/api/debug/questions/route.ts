import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const total = await prisma.question.count();
    const success = await prisma.question.count({ where: { extractionStatus: 'SUCCESS' } });
    const pending = await prisma.question.count({ where: { extractionStatus: 'PENDING' } });

    // Sample SUCCESS question
    const sample = await prisma.question.findFirst({
      where: { extractionStatus: 'SUCCESS' },
      select: { id: true, knowledgePoints: true }
    });

    // Check for folding topic (Json array filtering)
    const allFolding = await prisma.question.findMany({
      where: { extractionStatus: 'SUCCESS' },
      select: { id: true, knowledgePoints: true },
      take: 100
    });

    const folding = allFolding.filter(q => {
      const kps = q.knowledgePoints;
      if (Array.isArray(kps)) {
        return kps.some(kp => {
          if (typeof kp === 'string') return kp.includes('folding');
          if (typeof kp === 'object' && kp !== null) {
            return (kp as { name?: string }).name?.includes('folding');
          }
          return false;
        });
      }
      return false;
    }).slice(0, 3);

    // Get all unique knowledgePoints prefixes
    const allSuccess = await prisma.question.findMany({
      where: { extractionStatus: 'SUCCESS' },
      select: { knowledgePoints: true },
      take: 100
    });

    const uniquePrefixes = new Set<string>();
    for (const q of allSuccess) {
      const kps = q.knowledgePoints;
      if (Array.isArray(kps)) {
        kps.forEach((kp: unknown) => {
          if (typeof kp === 'string') uniquePrefixes.add(kp.split('-')[0]);
          else if (typeof kp === 'object' && kp !== null) {
            const name = (kp as { id?: string; name?: string }).name || (kp as { id?: string; name?: string }).id || '';
            if (name) uniquePrefixes.add(name.split('-')[0]);
          }
        });
      }
    }

    return NextResponse.json({
      total,
      success,
      pending,
      sampleKnowledgePoints: sample?.knowledgePoints,
      foldingCount: folding.length,
      foldingSample: folding[0]?.knowledgePoints,
      uniquePrefixes: Array.from(uniquePrefixes).slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
