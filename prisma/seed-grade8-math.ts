/**
 * 人教版八年级下册数学数据初始化脚本
 * 创建教材版本、章节、知识概念、知识点数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 开始初始化八年级下册数学数据 ===\n');

  // 1. 创建或获取系统管理员（用于模板创建）
  let admin = await prisma.admin.findFirst();
  if (!admin) {
    // 查找或创建默认用户
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'system@academic-leap.local',
          name: 'System',
          password: 'NOT_A_REAL_PASSWORD',
          grade: 8,
        },
      });
      console.log(`创建系统用户: ${user.email} (${user.id})`);
    }
    admin = await prisma.admin.create({
      data: {
        userId: user.id,
        role: 'admin',
      },
    });
    console.log(`创建管理员: ${admin.id}\n`);
  }

  // 2. 创建教材版本
  const textbook = await prisma.textbookVersion.upsert({
    where: {
      grade_subject_name: {
        grade: 8,
        subject: '数学',
        name: '人教版八年级下册',
      },
    },
    update: {
      year: '2024',
      status: 'active',
    },
    create: {
      grade: 8,
      subject: '数学',
      name: '人教版八年级下册',
      year: '2024',
      status: 'active',
    },
  });
  console.log(`教材: ${textbook.name} (${textbook.id})`);

  // ============================================================
  // 第16章：二次根式
  // ============================================================
  const ch16 = await prisma.chapter.upsert({
    where: {
      id: 'ch16-quadratic-radical'
    },
    update: {
      textbookId: textbook.id,
      chapterNumber: 16,
      chapterName: '二次根式',
    },
    create: {
      id: 'ch16-quadratic-radical',
      textbookId: textbook.id,
      chapterNumber: 16,
      chapterName: '二次根式',
      sort: 16,
    },
  });
  console.log(`章节: 第16章 ${ch16.chapterName} (${ch16.id})`);

  // 二次根式知识概念
  const concept16 = await prisma.knowledgeConcept.upsert({
    where: { id: 'concept-quadratic-radical' },
    update: { name: '二次根式', category: '代数' },
    create: { id: 'concept-quadratic-radical', name: '二次根式', category: '代数', weight: 5 },
  });

  // 16.1 二次根式的概念
  const kp161 = await upsertKnowledgePoint('kp16-1-definition', ch16.id, concept16.id, '二次根式的定义', 1);
  // 16.2 二次根式的性质
  const kp162 = await upsertKnowledgePoint('kp16-2-property', ch16.id, concept16.id, '二次根式的性质', 2);
  // 16.3 最简二次根式
  const kp163 = await upsertKnowledgePoint('kp16-3-simplify', ch16.id, concept16.id, '最简二次根式', 3);
  // 16.4 二次根式的乘法
  const kp164 = await upsertKnowledgePoint('kp16-4-multiply', ch16.id, concept16.id, '二次根式的乘法法则', 4);
  // 16.5 二次根式的除法
  const kp165 = await upsertKnowledgePoint('kp16-5-divide', ch16.id, concept16.id, '二次根式的除法法则', 5);
  // 16.6 二次根式的加减
  const kp166 = await upsertKnowledgePoint('kp16-6-add-subtract', ch16.id, concept16.id, '二次根式的加减运算', 6);

  // ============================================================
  // 第17章：勾股定理
  // ============================================================
  const ch17 = await prisma.chapter.upsert({
    where: {
      id: 'ch17-pythagorean'
    },
    update: {
      textbookId: textbook.id,
      chapterNumber: 17,
      chapterName: '勾股定理',
    },
    create: {
      id: 'ch17-pythagorean',
      textbookId: textbook.id,
      chapterNumber: 17,
      chapterName: '勾股定理',
      sort: 17,
    },
  });
  console.log(`章节: 第17章 ${ch17.chapterName} (${ch17.id})`);

  // 勾股定理知识概念
  const concept17 = await prisma.knowledgeConcept.upsert({
    where: { id: 'concept-pythagorean' },
    update: { name: '勾股定理', category: '几何' },
    create: { id: 'concept-pythagorean', name: '勾股定理', category: '几何', weight: 5 },
  });

  // 17.1 勾股定理
  const kp171 = await upsertKnowledgePoint('kp17-1-theorem', ch17.id, concept17.id, '勾股定理', 1);
  // 17.2 勾股定理的折叠问题
  const kp172 = await upsertKnowledgePoint('kp17-2-folding', ch17.id, concept17.id, '勾股定理折叠问题', 2);
  // 17.3 勾股定理的逆定理
  const kp173 = await upsertKnowledgePoint('kp17-3-converse', ch17.id, concept17.id, '勾股定理逆定理', 3);
  // 17.4 勾股定理应用题
  const kp174 = await upsertKnowledgePoint('kp17-4-word-problem', ch17.id, concept17.id, '勾股定理应用题', 4);

  // ============================================================
  // 第18章：平行四边形
  // ============================================================
  const ch18 = await prisma.chapter.upsert({
    where: {
      id: 'ch18-quadrilateral'
    },
    update: {
      textbookId: textbook.id,
      chapterNumber: 18,
      chapterName: '平行四边形',
    },
    create: {
      id: 'ch18-quadrilateral',
      textbookId: textbook.id,
      chapterNumber: 18,
      chapterName: '平行四边形',
      sort: 18,
    },
  });
  console.log(`章节: 第18章 ${ch18.chapterName} (${ch18.id})`);

  // 平行四边形知识概念
  const concept18 = await prisma.knowledgeConcept.upsert({
    where: { id: 'concept-quadrilateral' },
    update: { name: '平行四边形', category: '几何' },
    create: { id: 'concept-quadrilateral', name: '平行四边形', category: '几何', weight: 5 },
  });

  // 18.1 平行四边形的性质
  const kp181 = await upsertKnowledgePoint('kp18-1-property', ch18.id, concept18.id, '平行四边形性质', 1);
  // 18.2 平行四边形的判定
  const kp182 = await upsertKnowledgePoint('kp18-2-verify', ch18.id, concept18.id, '平行四边形判定', 2);
  // 18.3 矩形的性质
  const kp183 = await upsertKnowledgePoint('kp18-3-rectangle-property', ch18.id, concept18.id, '矩形性质', 3);
  // 18.4 矩形的判定
  const kp184 = await upsertKnowledgePoint('kp18-4-rectangle-verify', ch18.id, concept18.id, '矩形判定', 4);
  // 18.5 菱形的性质
  const kp185 = await upsertKnowledgePoint('kp18-5-rhombus-property', ch18.id, concept18.id, '菱形性质', 5);
  // 18.6 菱形的判定
  const kp186 = await upsertKnowledgePoint('kp18-6-rhombus-verify', ch18.id, concept18.id, '菱形判定', 6);
  // 18.7 正方形的性质
  const kp187 = await upsertKnowledgePoint('kp18-7-square-property', ch18.id, concept18.id, '正方形性质', 7);
  // 18.8 正方形的判定
  const kp188 = await upsertKnowledgePoint('kp18-8-square-verify', ch18.id, concept18.id, '正方形判定', 8);
  // 18.9 四边形周长计算
  const kp189 = await upsertKnowledgePoint('kp18-9-perimeter', ch18.id, concept18.id, '四边形周长计算', 9);
  // 18.10 四边形面积计算
  const kp1810 = await upsertKnowledgePoint('kp18-10-area', ch18.id, concept18.id, '四边形面积计算', 10);
  // 18.11 梯形性质
  const kp1811 = await upsertKnowledgePoint('kp18-11-trapezoid', ch18.id, concept18.id, '梯形性质', 11);

  // ============================================================
  // 第19章：一元二次方程
  // ============================================================
  const ch19 = await prisma.chapter.upsert({
    where: {
      id: 'ch19-quadratic-equation'
    },
    update: {
      textbookId: textbook.id,
      chapterNumber: 19,
      chapterName: '一元二次方程',
    },
    create: {
      id: 'ch19-quadratic-equation',
      textbookId: textbook.id,
      chapterNumber: 19,
      chapterName: '一元二次方程',
      sort: 19,
    },
  });
  console.log(`章节: 第19章 ${ch19.chapterName} (${ch19.id})`);

  // 一元二次方程知识概念
  const concept19 = await prisma.knowledgeConcept.upsert({
    where: { id: 'concept-quadratic-equation' },
    update: { name: '一元二次方程', category: '代数' },
    create: { id: 'concept-quadratic-equation', name: '一元二次方程', category: '代数', weight: 5 },
  });

  // 19.1 一元二次方程的识别
  const kp191 = await upsertKnowledgePoint('kp19-1-identify', ch19.id, concept19.id, '一元二次方程的识别', 1);
  // 19.2 直接开平方法
  const kp192 = await upsertKnowledgePoint('kp19-2-direct-root', ch19.id, concept19.id, '直接开平方法', 2);
  // 19.3 配方法
  const kp193 = await upsertKnowledgePoint('kp19-3-complete-square', ch19.id, concept19.id, '配方法', 3);
  // 19.4 公式法
  const kp194 = await upsertKnowledgePoint('kp19-4-formula', ch19.id, concept19.id, '公式法', 4);
  // 19.5 因式分解法
  const kp195 = await upsertKnowledgePoint('kp19-5-factorize', ch19.id, concept19.id, '因式分解法', 5);
  // 19.6 增长率问题
  const kp196 = await upsertKnowledgePoint('kp19-6-growth', ch19.id, concept19.id, '一元二次方程增长率应用', 6);
  // 19.7 面积问题
  const kp197 = await upsertKnowledgePoint('kp19-7-area', ch19.id, concept19.id, '一元二次方程面积应用', 7);

  // ============================================================
  // 第20章：数据的分析
  // ============================================================
  const ch20 = await prisma.chapter.upsert({
    where: {
      id: 'ch20-data-analysis'
    },
    update: {
      textbookId: textbook.id,
      chapterNumber: 20,
      chapterName: '数据的分析',
    },
    create: {
      id: 'ch20-data-analysis',
      textbookId: textbook.id,
      chapterNumber: 20,
      chapterName: '数据的分析',
      sort: 20,
    },
  });
  console.log(`章节: 第20章 ${ch20.chapterName} (${ch20.id})`);

  // 数据分析知识概念
  const concept20 = await prisma.knowledgeConcept.upsert({
    where: { id: 'concept-data-analysis' },
    update: { name: '数据的分析', category: '统计与概率' },
    create: { id: 'concept-data-analysis', name: '数据的分析', category: '统计与概率', weight: 5 },
  });

  // 20.1 集中趋势
  const kp201 = await upsertKnowledgePoint('kp20-1-central-tendency', ch20.id, concept20.id, '集中趋势', 1);
  // 20.2 方差
  const kp202 = await upsertKnowledgePoint('kp20-2-variance', ch20.id, concept20.id, '方差', 2);
  // 20.3 标准差
  const kp203 = await upsertKnowledgePoint('kp20-3-stddev', ch20.id, concept20.id, '标准差', 3);

  // ============================================================
  // 第3步：将模板关联到知识概念
  // ============================================================
  console.log('\n=== 关联模板到知识概念 ===\n');

  // 模板 -> 知识概念映射
  const templateConceptMapping: Record<string, string> = {
    // 第16章：二次根式
    'sqrt_concept':       concept16.id,
    'sqrt_property':      concept16.id,
    'sqrt_simplify':      concept16.id,
    'sqrt_multiply':      concept16.id,
    'sqrt_divide':        concept16.id,
    'sqrt_add_subtract':  concept16.id,
    // 第17章：勾股定理
    'pythagoras':              concept17.id,
    'pythagoras_folding':      concept17.id,
    'pythagoras_word_problem': concept17.id,
    'triangle_verify':         concept17.id,
    // 第18章：平行四边形
    'parallelogram_verify':   concept18.id,
    'rectangle_property':     concept18.id,
    'rectangle_verify':       concept18.id,
    'rhombus_property':       concept18.id,
    'rhombus_verify':         concept18.id,
    'square_property':        concept18.id,
    'square_verify':          concept18.id,
    'quadrilateral_perimeter': concept18.id,
    'quadrilateral_area':      concept18.id,
    'trapezoid_property':     concept18.id,
    // 第19章：一元二次方程
    'quadratic_identify':     concept19.id,
    'quadratic_direct_root':  concept19.id,
    'quadratic_complete_square': concept19.id,
    'quadratic_formula':     concept19.id,
    'quadratic_factorize':   concept19.id,
    'quadratic_growth':      concept19.id,
    'quadratic_area':        concept19.id,
    // 第20章：数据分析
    'central_tendency':       concept20.id,
    'data_variance':         concept20.id,
    'data_stddev':           concept20.id,
  };

  let linkedCount = 0;
  for (const [templateKey, conceptId] of Object.entries(templateConceptMapping)) {
    const existing = await prisma.template.findFirst({
      where: {
        templateKey,
        knowledgeId: conceptId,
      },
    });

    if (!existing) {
      const anyVersion = await prisma.template.findFirst({
        where: { templateKey },
      });

      if (anyVersion) {
        // 模板存在但未关联，更新knowledgeId
        await prisma.template.update({
          where: { id: anyVersion.id },
          data: { knowledgeId: conceptId },
        });
        console.log(`  更新模板 "${templateKey}" -> 概念 ${conceptId}`);
      } else {
        // 模板不存在，创建占位记录
        await prisma.template.create({
          data: {
            name: getTemplateName(templateKey),
            type: 'calculation',
            templateKey,
            structure: { type: 'default' },
            params: { default: true },
            steps: [],
            knowledgeId: conceptId,
            createdBy: admin.id,
            status: 'draft',
          },
        });
        console.log(`  创建模板占位 "${templateKey}" -> 概念 ${conceptId}`);
      }
      linkedCount++;
    }
  }

  // ============================================================
  // 统计汇总
  // ============================================================
  const [tbCount, chCount, conceptCount, kpCount, tmplCount] = await Promise.all([
    prisma.textbookVersion.count(),
    prisma.chapter.count({ where: { textbookId: textbook.id } }),
    prisma.knowledgeConcept.count(),
    prisma.knowledgePoint.count(),
    prisma.template.count({ where: { templateKey: { not: null } } }),
  ]);

  console.log('\n=== 初始化完成 ===');
  console.log(`教材版本: ${tbCount}`);
  console.log(`章节 (八下): ${chCount}`);
  console.log(`知识概念: ${conceptCount}`);
  console.log(`知识点: ${kpCount}`);
  console.log(`模板(含占位): ${tmplCount}`);
  console.log(`本次新增/更新模板关联: ${linkedCount}`);
}

/**
 * 辅助函数：创建或更新知识点
 */
async function upsertKnowledgePoint(
  id: string,
  chapterId: string,
  conceptId: string,
  name: string,
  weight: number
): Promise<string> {
  const kp = await prisma.knowledgePoint.upsert({
    where: { id },
    update: { chapterId, conceptId, name, weight },
    create: { id, chapterId, conceptId, name, weight },
  });
  return kp.id;
}

/**
 * 辅助函数：获取模板显示名称
 */
function getTemplateName(key: string): string {
  const names: Record<string, string> = {
    sqrt_concept: '二次根式定义域',
    sqrt_property: '二次根式性质',
    sqrt_simplify: '最简二次根式',
    sqrt_multiply: '二次根式乘法',
    sqrt_divide: '二次根式除法',
    sqrt_add_subtract: '二次根式加减',
    pythagoras: '勾股定理',
    pythagoras_folding: '勾股定理折叠',
    pythagoras_word_problem: '勾股定理应用题',
    triangle_verify: '勾股定理逆定理',
    parallelogram_verify: '平行四边形判定',
    rectangle_property: '矩形性质',
    rectangle_verify: '矩形判定',
    rhombus_property: '菱形性质',
    rhombus_verify: '菱形判定',
    square_property: '正方形性质',
    square_verify: '正方形判定',
    quadrilateral_perimeter: '四边形周长',
    quadrilateral_area: '四边形面积',
    trapezoid_property: '梯形性质',
    quadratic_identify: '一元二次方程识别',
    quadratic_direct_root: '直接开平方法',
    quadratic_complete_square: '配方法',
    quadratic_formula: '公式法',
    quadratic_factorize: '因式分解法',
    quadratic_growth: '增长率问题',
    quadratic_area: '面积问题',
    central_tendency: '集中趋势',
    data_variance: '方差',
    data_stddev: '标准差',
  };
  return names[key] || key;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
