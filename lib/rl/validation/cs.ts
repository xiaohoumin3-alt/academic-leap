// lib/rl/validation/cs.ts

import { ThompsonSamplingBandit } from '../bandit/thompson-sampling';
import { validateThompsonStability } from '../bandit/thompson-sampling';

export interface CSValidationResult {
  cs: number;
  pass: boolean;
}

export async function validateCS(prisma: any): Promise<CSValidationResult> {
  // Get deployed model
  const model = await prisma.rLModelVersion.findFirst({
    where: { status: 'DEPLOYED' },
    include: { arms: true }
  });

  if (!model) {
    return {
      cs: 0,
      pass: false
    };
  }

  // Reconstruct bandit
  const bandit = new ThompsonSamplingBandit({ bucketSize: model.bucketSize });
  const state = bandit.getState();

  for (const arm of model.arms) {
    const key = arm.deltaC.toFixed(1);
    if (state.buckets.has(key)) {
      const bucket = state.buckets.get(key)!;
      bucket.alpha = arm.alpha;
      bucket.beta = arm.beta;
      bucket.pullCount = arm.pullCount;
      bucket.successCount = arm.successCount;
    }
  }

  // Run stability validation
  const result = validateThompsonStability(bandit, {
    seeds: [1, 2, 3, 4, 5, 42, 123, 456, 789, 999],
    ability: 0,
    trials: 100
  });

  return {
    cs: result.csScore,
    pass: result.csScore >= 0.85
  };
}
