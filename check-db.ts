import { prisma } from './lib/prisma';

async function main() {
  const total = await prisma.question.count();
  const success = await prisma.question.count({ where: { extractionStatus: 'SUCCESS' } });
  const pending = await prisma.question.count({ where: { extractionStatus: 'PENDING' } });
  
  console.log('Total questions:', total);
  console.log('SUCCESS status:', success);
  console.log('PENDING status:', pending);
  
  // Sample some knowledgePoints
  const sample = await prisma.question.findFirst({
    where: { extractionStatus: 'SUCCESS' },
    select: { id: true, knowledgePoints: true }
  });
  console.log('Sample SUCCESS question knowledgePoints:', sample?.knowledgePoints);
  
  // Check for folding topic (Json filtering in memory)
  const allSuccess = await prisma.question.findMany({
    where: { extractionStatus: 'SUCCESS' },
    select: { id: true, knowledgePoints: true },
    take: 100
  });
  const folding = allSuccess.filter(q => {
    const kps = q.knowledgePoints;
    if (Array.isArray(kps)) {
      return kps.some(kp => {
        if (typeof kp === 'string') return kp.includes('folding');
        if (typeof kp === 'object' && kp !== null) {
          const name = (kp as { name?: string }).name || '';
          return name.includes('folding');
        }
        return false;
      });
    }
    return false;
  }).slice(0, 3);
  console.log('Folding questions:', folding.length);
  if (folding.length > 0) {
    console.log('Sample folding KP:', folding[0].knowledgePoints);
  }
}

main().catch(console.error).finally(() => process.exit(0));
