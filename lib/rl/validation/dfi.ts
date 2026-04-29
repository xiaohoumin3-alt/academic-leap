// lib/rl/validation/dfi.ts

export interface DFIValidationResult {
  dfi: number;
  pass: boolean;
  gaps: string[];
}

export async function validateDFI(prisma: any): Promise<DFIValidationResult> {
  // Check: Total logs and unique eventIds
  const total = await prisma.rLTrainingLog.count();

  // All eventIds should be unique (enforced by schema)
  // Check if any eventIds are empty strings (edge case)
  const emptyEventIds = await prisma.rLTrainingLog.count({
    where: { eventId: '' }
  });

  const gaps: string[] = [];
  if (emptyEventIds > 0) {
    gaps.push(`${emptyEventIds} logs have empty eventId`);
  }

  const complete = total - emptyEventIds;
  const dfi = total > 0 ? complete / total : 1;

  return {
    dfi,
    pass: dfi >= 0.99,
    gaps
  };
}
