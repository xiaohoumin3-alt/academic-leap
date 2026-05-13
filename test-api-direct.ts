// 直接测试 API 路由逻辑
import { prisma } from './lib/prisma';

async function test() {
  // 模拟 getAdminUser 返回 null（未登录）
  const getAdminUser = async () => null;

  if (!await getAdminUser()) {
    console.log('未授权: getAdminUser() 返回 null');
    console.log('API 将返回: { success: false, error: { code: "UNAUTHORIZED" } }');
    return;
  }

  // 如果有 admin 权限
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: { inAssess: true, deletedAt: null },
    take: 3,
  });

  console.log('API 返回数据:');
  console.log(JSON.stringify({
    success: true,
    data: {
      knowledgePoints: knowledgePoints.map(kp => ({
        id: kp.id,
        name: kp.name,
        status: kp.status,
      })),
    }
  }, null, 2));
}

test().catch(console.error);
