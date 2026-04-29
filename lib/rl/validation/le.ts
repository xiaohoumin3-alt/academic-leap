// lib/rl/validation/le.ts

export interface LEValidationResult {
  le: number;
  pass: boolean;
  confidence: number;
  sampleSize: number;
}

export async function validateLE(prisma: any): Promise<LEValidationResult> {
  const results = await prisma.rLTrainingLog.groupBy({
    by: ['knowledgePointId'],
    where: {
      postAccuracy: { not: null },
      leDelta: { not: null }
    },
    _avg: {
      leDelta: true
    },
    _count: true
  });

  if (results.length === 0) {
    return {
      le: 0,
      pass: false,
      confidence: 0,
      sampleSize: 0
    };
  }

  // Calculate average LE across all knowledge points
  const le = results.reduce((sum: number, r: any) => sum + (r._avg.leDelta ?? 0), 0) / results.length;

  // Simple confidence: based on sample size
  const sampleSize = results.reduce((sum: number, r: any) => sum + r._count, 0);
  const confidence = Math.min(1, sampleSize / 100); // More samples = higher confidence

  return {
    le,
    pass: le >= 0.15,
    confidence,
    sampleSize
  };
}
