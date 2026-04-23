import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建示例模板和题目...');

  // 获取管理员
  const admin = await prisma.admin.findFirst();
  if (!admin) {
    console.error('请先运行 init-admin.ts 创建管理员');
    process.exit(1);
  }

  // 获取知识点
  const knowledgePoints = await prisma.knowledgePoint.findMany({
    where: { inAssess: true, status: 'active' }
  });

  if (knowledgePoints.length === 0) {
    console.error('没有找到参与测评的知识点');
    process.exit(1);
  }

  console.log(`找到 ${knowledgePoints.length} 个知识点`);

  // 为每个知识点创建模板和示例题目
  for (const kp of knowledgePoints) {
    console.log(`处理知识点: ${kp.name}`);

    let template;
    let questions: any[] = [];

    switch (kp.name) {
      case '一元一次方程':
        template = await prisma.template.create({
          data: {
            name: '一元一次方程求解',
            type: 'calculation',
            structure: {
              type: 'linear_equation',
              form: 'ax + b = c'
            },
            params: {
              a: { min: 2, max: 9, integer: true },
              b: { min: -10, max: 10, integer: true },
              c: { min: 1, max: 20, integer: true },
              constraint: 'c % a === 0 || (c - b) % a === 0'
            },
            steps: [
              { type: 'move_terms', expression: 'ax = c - b', instruction: '将常数项移到等号右边' },
              { type: 'divide', expression: 'x = (c - b) / a', instruction: '两边同时除以a' }
            ],
            knowledgeId: kp.id,
            createdBy: admin.id,
            status: 'production',
            version: 1
          }
        });

        // 创建示例题目
        questions = [
          {
            type: 'calculation',
            difficulty: 1,
            content: JSON.stringify({
              title: '解一元一次方程',
              description: '求解 x 的值',
              context: '2x + 3 = 11',
              expression: '2x + 3 = 11'
            }),
            answer: '4',
            hint: '先将3移到等号右边，再两边除以2',
            knowledgePoints: JSON.stringify(['一元一次方程']),
            templateId: template.id,
            params: JSON.stringify({ a: 2, b: 3, c: 11 }),
            stepTypes: JSON.stringify(['move_terms', 'divide'])
          },
          {
            type: 'calculation',
            difficulty: 2,
            content: JSON.stringify({
              title: '解一元一次方程',
              description: '求解 x 的值',
              context: '3x - 5 = 16',
              expression: '3x - 5 = 16'
            }),
            answer: '7',
            hint: '先将-5移到等号右边，再两边除以3',
            knowledgePoints: JSON.stringify(['一元一次方程']),
            templateId: template.id,
            params: JSON.stringify({ a: 3, b: -5, c: 16 }),
            stepTypes: JSON.stringify(['move_terms', 'divide'])
          }
        ];
        break;

      case '勾股定理':
        template = await prisma.template.create({
          data: {
            name: '勾股定理求斜边',
            type: 'geometry',
            structure: {
              type: 'pythagorean',
              form: 'a² + b² = c²'
            },
            params: {
              a: { min: 3, max: 12, integer: true },
              b: { min: 4, max: 12, integer: true }
            },
            steps: [
              { type: 'square_a', expression: 'a²', instruction: '计算第一条直角边的平方' },
              { type: 'square_b', expression: 'b²', instruction: '计算第二条直角边的平方' },
              { type: 'add_squares', expression: 'a² + b²', instruction: '将两平方相加' },
              { type: 'sqrt', expression: '√(a² + b²)', instruction: '开方求斜边' }
            ],
            knowledgeId: kp.id,
            createdBy: admin.id,
            status: 'production',
            version: 1
          }
        });

        questions = [
          {
            type: 'calculation',
            difficulty: 1,
            content: JSON.stringify({
              title: '勾股定理求斜边',
              description: '已知直角三角形两直角边，求斜边长度',
              context: '直角三角形两直角边分别为3和4，求斜边',
              a: 3,
              b: 4
            }),
            answer: '5',
            hint: '使用勾股定理：c² = a² + b²',
            knowledgePoints: JSON.stringify(['勾股定理']),
            templateId: template.id,
            params: JSON.stringify({ a: 3, b: 4 }),
            stepTypes: JSON.stringify(['square_a', 'square_b', 'add_squares', 'sqrt'])
          },
          {
            type: 'calculation',
            difficulty: 2,
            content: JSON.stringify({
              title: '勾股定理求斜边',
              description: '已知直角三角形两直角边，求斜边长度',
              context: '直角三角形两直角边分别为5和12，求斜边',
              a: 5,
              b: 12
            }),
            answer: '13',
            hint: '使用勾股定理：c² = a² + b²',
            knowledgePoints: JSON.stringify(['勾股定理']),
            templateId: template.id,
            params: JSON.stringify({ a: 5, b: 12 }),
            stepTypes: JSON.stringify(['square_a', 'square_b', 'add_squares', 'sqrt'])
          }
        ];
        break;

      case '二次函数':
        template = await prisma.template.create({
          data: {
            name: '二次函数顶点坐标',
            type: 'calculation',
            structure: {
              type: 'quadratic_vertex',
              form: 'y = ax² + bx + c'
            },
            params: {
              a: { min: 1, max: 3, integer: true },
              b: { min: -8, max: 8, even: true },
              c: { min: -5, max: 5, integer: true }
            },
            steps: [
              { type: 'vertex_x', expression: '-b/(2a)', instruction: '计算顶点横坐标' },
              { type: 'vertex_y', expression: 'f(-b/(2a))', instruction: '代入求顶点纵坐标' }
            ],
            knowledgeId: kp.id,
            createdBy: admin.id,
            status: 'production',
            version: 1
          }
        });

        questions = [
          {
            type: 'calculation',
            difficulty: 2,
            content: JSON.stringify({
              title: '求二次函数顶点坐标',
              description: '求抛物线的顶点坐标',
              context: 'y = x² - 4x + 3',
              expression: 'y = x² - 4x + 3'
            }),
            answer: '(2, -1)',
            hint: '顶点横坐标 x = -b/(2a)',
            knowledgePoints: JSON.stringify(['二次函数']),
            templateId: template.id,
            params: JSON.stringify({ a: 1, b: -4, c: 3 }),
            stepTypes: JSON.stringify(['vertex_x', 'vertex_y'])
          },
          {
            type: 'calculation',
            difficulty: 3,
            content: JSON.stringify({
              title: '求二次函数顶点坐标',
              description: '求抛物线的顶点坐标',
              context: 'y = 2x² - 8x + 5',
              expression: 'y = 2x² - 8x + 5'
            }),
            answer: '(2, -3)',
            hint: '顶点横坐标 x = -b/(2a)',
            knowledgePoints: JSON.stringify(['二次函数']),
            templateId: template.id,
            params: JSON.stringify({ a: 2, b: -8, c: 5 }),
            stepTypes: JSON.stringify(['vertex_x', 'vertex_y'])
          }
        ];
        break;

      case '概率统计':
        template = await prisma.template.create({
          data: {
            name: '基本概率计算',
            type: 'calculation',
            structure: {
              type: 'basic_probability',
              form: 'P = m/n'
            },
            params: {
              total: { min: 6, max: 20, integer: true },
              favorable: { min: 1, max: 10, integer: true }
            },
            steps: [
              { type: 'identify_total', expression: 'n', instruction: '确定总可能数' },
              { type: 'identify_favorable', expression: 'm', instruction: '确定有利情况数' },
              { type: 'calculate', expression: 'm/n', instruction: '计算概率' }
            ],
            knowledgeId: kp.id,
            createdBy: admin.id,
            status: 'production',
            version: 1
          }
        });

        questions = [
          {
            type: 'calculation',
            difficulty: 1,
            content: JSON.stringify({
              title: '基本概率计算',
              description: '计算事件的概率',
              context: '袋中有6个球，其中3个是红球，随机取一个球是红球的概率',
              total: 6,
              favorable: 3
            }),
            answer: '1/2',
            hint: '概率 = 有利情况数 / 总情况数',
            knowledgePoints: JSON.stringify(['概率统计']),
            templateId: template.id,
            params: JSON.stringify({ total: 6, favorable: 3 }),
            stepTypes: JSON.stringify(['identify_total', 'identify_favorable', 'calculate'])
          },
          {
            type: 'calculation',
            difficulty: 2,
            content: JSON.stringify({
              title: '基本概率计算',
              description: '计算事件的概率',
              context: '一副扑克牌52张，抽到红桃的概率',
              total: 52,
              favorable: 13
            }),
            answer: '1/4',
            hint: '概率 = 有利情况数 / 总情况数',
            knowledgePoints: JSON.stringify(['概率统计']),
            templateId: template.id,
            params: JSON.stringify({ total: 52, favorable: 13 }),
            stepTypes: JSON.stringify(['identify_total', 'identify_favorable', 'calculate'])
          }
        ];
        break;

      default:
        console.log(`跳过未知知识点: ${kp.name}`);
        continue;
    }

    console.log(`  创建模板: ${template.name}`);

    // 创建题目和步骤
    for (const q of questions) {
      const question = await prisma.question.create({
        data: {
          ...q,
          createdBy: admin.id
        }
      });

      // 创建题目步骤
      const stepList: Array<{
        questionId: string;
        stepNumber: number;
        expression: string;
        answer: string;
        hint: string;
        type: string;
        inputType: string;
        tolerance: number;
      }> = [];
      if (q.templateId) {
        const relatedTemplate = await prisma.template.findUnique({
          where: { id: q.templateId },
          select: { steps: true }
        });
        if (relatedTemplate) {
          const templateSteps = relatedTemplate.steps as any[];
          templateSteps.forEach((step: any, index: number) => {
            stepList.push({
              questionId: question.id,
              stepNumber: index + 1,
              expression: step.expression,
              answer: '', // 将由题目生成引擎填充
              hint: step.instruction || '',
              type: step.type,
              inputType: 'numeric',
              tolerance: 0.01
            });
          });
        }
      }

      if (stepList.length > 0) {
        await prisma.questionStep.createMany({
          data: stepList
        });
      }

      console.log(`    创建题目: ${question.content ? JSON.parse(question.content).title : ''}`);
    }
  }

  // 统计
  const templateCount = await prisma.template.count();
  const questionCount = await prisma.question.count();

  console.log('\n数据创建完成！');
  console.log(`  模板数量: ${templateCount}`);
  console.log(`  题目数量: ${questionCount}`);
}

main()
  .catch((e) => {
    console.error('错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
