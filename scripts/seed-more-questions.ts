import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('补充更多题目...');

  const admin = await prisma.admin.findFirst();
  if (!admin) {
    console.error('管理员不存在');
    process.exit(1);
  }

  const templates = await prisma.template.findMany({
    where: { status: 'production' }
  });

  const questions = [
    // 一元一次方程 - 更多题目
    {
      type: 'calculation',
      difficulty: 1,
      content: JSON.stringify({
        title: '解一元一次方程',
        description: '求解 x 的值',
        context: '5x - 2 = 18',
        expression: '5x - 2 = 18'
      }),
      answer: '4',
      hint: '先将-2移到等号右边，再两边除以5',
      knowledgePoints: JSON.stringify(['一元一次方程']),
      templateId: templates[0]?.id,
      params: JSON.stringify({ a: 5, b: -2, c: 18 }),
      stepTypes: JSON.stringify(['move_terms', 'divide'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '解一元一次方程',
        description: '求解 x 的值',
        context: '4x + 7 = 31',
        expression: '4x + 7 = 31'
      }),
      answer: '6',
      hint: '先将7移到等号右边，再两边除以4',
      knowledgePoints: JSON.stringify(['一元一次方程']),
      templateId: templates[0]?.id,
      params: JSON.stringify({ a: 4, b: 7, c: 31 }),
      stepTypes: JSON.stringify(['move_terms', 'divide'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '解一元一次方程',
        description: '求解 x 的值',
        context: '6x - 9 = 21',
        expression: '6x - 9 = 21'
      }),
      answer: '5',
      hint: '先将-9移到等号右边，再两边除以6',
      knowledgePoints: JSON.stringify(['一元一次方程']),
      templateId: templates[0]?.id,
      params: JSON.stringify({ a: 6, b: -9, c: 21 }),
      stepTypes: JSON.stringify(['move_terms', 'divide'])
    },

    // 勾股定理 - 更多题目
    {
      type: 'calculation',
      difficulty: 1,
      content: JSON.stringify({
        title: '勾股定理求斜边',
        description: '已知直角三角形两直角边，求斜边长度',
        context: '直角三角形两直角边分别为8和6，求斜边',
        a: 8,
        b: 6
      }),
      answer: '10',
      hint: '使用勾股定理：c² = a² + b²',
      knowledgePoints: JSON.stringify(['勾股定理']),
      templateId: templates[1]?.id,
      params: JSON.stringify({ a: 8, b: 6 }),
      stepTypes: JSON.stringify(['square_a', 'square_b', 'add_squares', 'sqrt'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '勾股定理求斜边',
        description: '已知直角三角形两直角边，求斜边长度',
        context: '直角三角形两直角边分别为9和12，求斜边',
        a: 9,
        b: 12
      }),
      answer: '15',
      hint: '使用勾股定理：c² = a² + b²',
      knowledgePoints: JSON.stringify(['勾股定理']),
      templateId: templates[1]?.id,
      params: JSON.stringify({ a: 9, b: 12 }),
      stepTypes: JSON.stringify(['square_a', 'square_b', 'add_squares', 'sqrt'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '勾股定理求斜边',
        description: '已知直角三角形两直角边，求斜边长度',
        context: '直角三角形两直角边分别为12和16，求斜边',
        a: 12,
        b: 16
      }),
      answer: '20',
      hint: '使用勾股定理：c² = a² + b²',
      knowledgePoints: JSON.stringify(['勾股定理']),
      templateId: templates[1]?.id,
      params: JSON.stringify({ a: 12, b: 16 }),
      stepTypes: JSON.stringify(['square_a', 'square_b', 'add_squares', 'sqrt'])
    },

    // 二次函数 - 更多题目
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '求二次函数顶点坐标',
        description: '求抛物线的顶点坐标',
        context: 'y = x² - 6x + 8',
        expression: 'y = x² - 6x + 8'
      }),
      answer: '(3, -1)',
      hint: '顶点横坐标 x = -b/(2a)',
      knowledgePoints: JSON.stringify(['二次函数']),
      templateId: templates[2]?.id,
      params: JSON.stringify({ a: 1, b: -6, c: 8 }),
      stepTypes: JSON.stringify(['vertex_x', 'vertex_y'])
    },
    {
      type: 'calculation',
      difficulty: 3,
      content: JSON.stringify({
        title: '求二次函数顶点坐标',
        description: '求抛物线的顶点坐标',
        context: 'y = 3x² - 12x + 10',
        expression: 'y = 3x² - 12x + 10'
      }),
      answer: '(2, -2)',
      hint: '顶点横坐标 x = -b/(2a)',
      knowledgePoints: JSON.stringify(['二次函数']),
      templateId: templates[2]?.id,
      params: JSON.stringify({ a: 3, b: -12, c: 10 }),
      stepTypes: JSON.stringify(['vertex_x', 'vertex_y'])
    },
    {
      type: 'calculation',
      difficulty: 3,
      content: JSON.stringify({
        title: '求二次函数顶点坐标',
        description: '求抛物线的顶点坐标',
        context: 'y = 2x² + 8x + 3',
        expression: 'y = 2x² + 8x + 3'
      }),
      answer: '(-2, -5)',
      hint: '顶点横坐标 x = -b/(2a)',
      knowledgePoints: JSON.stringify(['二次函数']),
      templateId: templates[2]?.id,
      params: JSON.stringify({ a: 2, b: 8, c: 3 }),
      stepTypes: JSON.stringify(['vertex_x', 'vertex_y'])
    },

    // 概率统计 - 更多题目
    {
      type: 'calculation',
      difficulty: 1,
      content: JSON.stringify({
        title: '基本概率计算',
        description: '计算事件的概率',
        context: '袋中有10个球，其中4个是蓝球，随机取一个球是蓝球的概率',
        total: 10,
        favorable: 4
      }),
      answer: '2/5',
      hint: '概率 = 有利情况数 / 总情况数',
      knowledgePoints: JSON.stringify(['概率统计']),
      templateId: templates[3]?.id,
      params: JSON.stringify({ total: 10, favorable: 4 }),
      stepTypes: JSON.stringify(['identify_total', 'identify_favorable', 'calculate'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '基本概率计算',
        description: '计算事件的概率',
        context: '骰子有6个面，掷骰子得到大于4的数的概率',
        total: 6,
        favorable: 2
      }),
      answer: '1/3',
      hint: '概率 = 有利情况数 / 总情况数，大于4的数有5和6',
      knowledgePoints: JSON.stringify(['概率统计']),
      templateId: templates[3]?.id,
      params: JSON.stringify({ total: 6, favorable: 2 }),
      stepTypes: JSON.stringify(['identify_total', 'identify_favorable', 'calculate'])
    },
    {
      type: 'calculation',
      difficulty: 2,
      content: JSON.stringify({
        title: '基本概率计算',
        description: '计算事件的概率',
        context: '从1到20的整数中随机选一个，选到偶数的概率',
        total: 20,
        favorable: 10
      }),
      answer: '1/2',
      hint: '概率 = 有利情况数 / 总情况数',
      knowledgePoints: JSON.stringify(['概率统计']),
      templateId: templates[3]?.id,
      params: JSON.stringify({ total: 20, favorable: 10 }),
      stepTypes: JSON.stringify(['identify_total', 'identify_favorable', 'calculate'])
    },
  ];

  let createdCount = 0;
  for (const q of questions) {
    if (!q.templateId) continue;

    const question = await prisma.question.create({
      data: {
        ...q,
        createdBy: admin.id
      }
    });
    createdCount++;

    // 创建题目步骤
    const relatedTemplate = templates.find(t => t.id === q.templateId);
    if (relatedTemplate) {
      const templateSteps = relatedTemplate.steps as any[];
      const stepList = templateSteps.map((step: any, index: number) => ({
        questionId: question.id,
        stepNumber: index + 1,
        expression: step.expression,
        answer: '',
        hint: step.instruction || '',
        type: step.type,
        inputType: 'numeric',
        tolerance: 0.01
      }));

      if (stepList.length > 0) {
        await prisma.questionStep.createMany({
          data: stepList
        });
      }
    }
  }

  const totalCount = await prisma.question.count();
  console.log(`补充完成！当前题目总数: ${totalCount}`);
}

main()
  .catch((e) => {
    console.error('错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
