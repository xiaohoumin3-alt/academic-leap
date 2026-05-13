// 模拟 API 响应结构检查
import { prisma } from './lib/prisma';

async function diagnose() {
  console.log('=== 诊断知识点数据 ===\n');

  // 1. 数据库查询
  const kps = await prisma.knowledgePoint.findMany({
    where: { inAssess: true, deletedAt: null },
    take: 3,
  });

  console.log('1. 数据库查询结果:');
  for (const kp of kps) {
    console.log(`   - ${kp.name}: status="${kp.status}"`);
  }

  // 2. 模拟 API 返回格式
  const apiResponse = {
    success: true,
    data: {
      knowledgePoints: kps.map(kp => ({
        id: kp.id,
        name: kp.name,
        chapterName: '测试章节',
        questionCount: 0,
      })),
      stats: {
        total: kps.length,
        hasQuestions: 0,
      }
    }
  };

  console.log('\n2. API 返回格式检查:');
  console.log(`   - success: ${apiResponse.success}`);
  console.log(`   - data.knowledgePoints: ${apiResponse.data.knowledgePoints.length} 条`);
  console.log(`   - data.stats: ${JSON.stringify(apiResponse.data.stats)}`);

  console.log('\n=== 诊断完成 ===');
}

diagnose().catch(console.error);
