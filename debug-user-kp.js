const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('查询用户数据和选择的知识点...');

  try {
    // 查询用户
    const user = await prisma.user.findFirst({
      where: {
        email: "test@example.com"
      },
      select: {
        id: true,
        selectedTextbookId: true,
        grade: true
      }
    });

    console.log('\n用户信息:');
    console.log(`用户ID: ${user?.id}`);
    console.log(`选择教材ID: ${user?.selectedTextbookId}`);
    console.log(`年级: ${user?.grade}`);

    // 查询用户选择的教材中的知识点
    if (user?.selectedTextbookId) {
      const textbookKps = await prisma.knowledgePoint.findMany({
        where: {
          chapter: {
            textbookId: user.selectedTextbookId
          },
          status: 'active',
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          chapter: {
            select: {
              textbookId: true,
              textbook: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        take: 20
      });

      console.log('\n用户教材中的知识点:');
      textbookKps.forEach(kp => {
        console.log(`\nID: ${kp.id}`);
        console.log(`名称: ${kp.name}`);
        console.log(`教材: ${kp.chapter?.textbook?.name}`);
      });
    }

    // 查看所有教材
    const allTextbooks = await prisma.textbookVersion.findMany({
      select: {
        id: true,
        name: true,
        subject: true,
        grade: true
      }
    });

    console.log('\n所有教材:');
    allTextbooks.forEach(tb => {
      console.log(`\nID: ${tb.id}`);
      console.log(`名称: ${tb.name}`);
      console.log(`科目: ${tb.subject}`);
      console.log(`年级: ${tb.grade}`);
    });

  } catch (error) {
    console.error('错误:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });