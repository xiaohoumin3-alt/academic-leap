import { prisma } from './lib/prisma';

async function test() {
  const kps = await prisma.knowledgePoint.findMany({
    where: { inAssess: true, deletedAt: null },
    take: 3,
  });

  console.log('=== Knowledge Points ===');
  for (const kp of kps) {
    console.log(JSON.stringify({
      id: kp.id.slice(0, 20),
      name: kp.name,
      status: kp.status,
    }, null, 2));
  }
}

test().catch(console.error);
