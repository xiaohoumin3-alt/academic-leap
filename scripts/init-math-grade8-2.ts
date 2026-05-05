/**
 * 人教版八年级下册数学 - 知识点初始化脚本
 *
 * 内容来源：
 * 1. 人教版八年级下册数学知识纲要
 * 2. 八年级下册数学期末考点与题型解析
 *
 * 章节结构：
 * - 第十六章 二次根式
 * - 第十七章 勾股定理
 * - 第十八章 平行四边形
 * - 第十九章 一次函数
 * - 第二十章 数据的分析
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// 数据定义
// ============================================================

const MATH_SUBJECT_CODE = 'MATH';
const GRADE = 8;
const TEXTBOOK_NAME = '人教版';
const PUBLISHER = '人民教育出版社';
const YEAR = '2023';

interface ChapterData {
  chapterNumber: number;
  chapterName: string;
  sections: Array<{
    sectionNumber: number;
    sectionName: string;
    knowledgePoints: Array<{
      name: string;
      weight: number;
      inAssess: boolean;
      concepts: string[];
    }>;
  }>;
}

const textbookData: ChapterData[] = [
  {
    chapterNumber: 16,
    chapterName: '二次根式',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '二次根式的概念与性质',
        knowledgePoints: [
          { name: '二次根式的定义', weight: 1, inAssess: true, concepts: ['代数', '根式'] },
          { name: '二次根式的非负性', weight: 2, inAssess: true, concepts: ['代数', '根式'] },
          { name: '√a² = |a| 的应用', weight: 3, inAssess: true, concepts: ['代数', '绝对值'] },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '二次根式的乘除',
        knowledgePoints: [
          { name: '√a·√b = √(ab)', weight: 2, inAssess: true, concepts: ['代数', '运算'] },
          { name: '√a/√b = √(a/b)', weight: 2, inAssess: true, concepts: ['代数', '运算'] },
          { name: '积的算术平方根', weight: 2, inAssess: true, concepts: ['代数', '运算'] },
          { name: '商的算术平方根', weight: 2, inAssess: true, concepts: ['代数', '运算'] },
          { name: '二次根式的乘除混合运算', weight: 3, inAssess: true, concepts: ['代数', '运算'] },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '二次根式的加减',
        knowledgePoints: [
          { name: '同类二次根式的判定', weight: 2, inAssess: true, concepts: ['代数', '分类'] },
          { name: '二次根式的加减法', weight: 3, inAssess: true, concepts: ['代数', '运算'] },
          { name: '二次根式的混合运算', weight: 4, inAssess: true, concepts: ['代数', '运算'] },
        ],
      },
    ],
  },
  {
    chapterNumber: 17,
    chapterName: '勾股定理',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '勾股定理',
        knowledgePoints: [
          { name: '勾股定理的表述', weight: 2, inAssess: true, concepts: ['几何', '定理'] },
          { name: '勾股定理的证明', weight: 3, inAssess: true, concepts: ['几何', '证明'] },
          { name: '勾股定理的计算应用', weight: 3, inAssess: true, concepts: ['几何', '计算'] },
          { name: '勾股数', weight: 2, inAssess: true, concepts: ['数论', '勾股数'] },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '勾股定理的逆定理',
        knowledgePoints: [
          { name: '勾股定理逆定理的表述', weight: 2, inAssess: true, concepts: ['几何', '定理'] },
          { name: '逆定理的证明', weight: 3, inAssess: true, concepts: ['几何', '证明'] },
          { name: '判断三角形是否为直角三角形', weight: 3, inAssess: true, concepts: ['几何', '判定'] },
          { name: '勾股定理与逆定理的综合应用', weight: 4, inAssess: true, concepts: ['几何', '综合'] },
        ],
      },
    ],
  },
  {
    chapterNumber: 18,
    chapterName: '平行四边形',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '平行四边形的性质',
        knowledgePoints: [
          { name: '平行四边形的定义', weight: 1, inAssess: true, concepts: ['几何', '四边形'] },
          { name: '平行四边形的对边相等', weight: 2, inAssess: true, concepts: ['几何', '性质'] },
          { name: '平行四边形的对角相等', weight: 2, inAssess: true, concepts: ['几何', '性质'] },
          { name: '平行四边形的对角线互相平分', weight: 3, inAssess: true, concepts: ['几何', '性质'] },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '平行四边形的判定',
        knowledgePoints: [
          { name: '两组对边分别平行', weight: 2, inAssess: true, concepts: ['几何', '判定'] },
          { name: '两组对边分别相等', weight: 2, inAssess: true, concepts: ['几何', '判定'] },
          { name: '一组对边平行且相等', weight: 3, inAssess: true, concepts: ['几何', '判定'] },
          { name: '对角线互相平分', weight: 3, inAssess: true, concepts: ['几何', '判定'] },
          { name: '两组对角分别相等', weight: 2, inAssess: true, concepts: ['几何', '判定'] },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '特殊的平行四边形',
        knowledgePoints: [
          { name: '矩形的性质与判定', weight: 3, inAssess: true, concepts: ['几何', '矩形'] },
          { name: '菱形的性质与判定', weight: 3, inAssess: true, concepts: ['几何', '菱形'] },
          { name: '正方形的性质与判定', weight: 4, inAssess: true, concepts: ['几何', '正方形'] },
          { name: '矩形、菱形、正方形之间的关系', weight: 3, inAssess: true, concepts: ['几何', '关系'] },
        ],
      },
    ],
  },
  {
    chapterNumber: 19,
    chapterName: '一次函数',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '常量与变量',
        knowledgePoints: [
          { name: '常量与变量的概念', weight: 1, inAssess: true, concepts: ['代数', '函数基础'] },
          { name: '函数的定义', weight: 2, inAssess: true, concepts: ['代数', '函数基础'] },
          { name: '函数的表示法', weight: 2, inAssess: true, concepts: ['代数', '函数'] },
          { name: '自变量取值范围', weight: 3, inAssess: true, concepts: ['代数', '定义域'] },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '一次函数',
        knowledgePoints: [
          { name: '正比例函数', weight: 2, inAssess: true, concepts: ['代数', '正比例'] },
          { name: '一次函数的定义', weight: 2, inAssess: true, concepts: ['代数', '一次函数'] },
          { name: '一次函数的图像', weight: 3, inAssess: true, concepts: ['代数', '图像'] },
          { name: '一次函数的性质', weight: 3, inAssess: true, concepts: ['代数', '性质'] },
          { name: 'k值对图像的影响', weight: 3, inAssess: true, concepts: ['代数', '斜率'] },
          { name: 'b值对图像的影响', weight: 2, inAssess: true, concepts: ['代数', '截距'] },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '一次函数与方程、不等式',
        knowledgePoints: [
          { name: '一次函数与一元一次方程', weight: 3, inAssess: true, concepts: ['代数', '方程'] },
          { name: '一次函数与一元一次不等式', weight: 3, inAssess: true, concepts: ['代数', '不等式'] },
          { name: '一次函数与二元一次方程组', weight: 4, inAssess: true, concepts: ['代数', '方程组'] },
        ],
      },
    ],
  },
  {
    chapterNumber: 20,
    chapterName: '数据的分析',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '数据的代表',
        knowledgePoints: [
          { name: '平均数的计算', weight: 2, inAssess: true, concepts: ['统计', '平均数'] },
          { name: '加权平均数', weight: 3, inAssess: true, concepts: ['统计', '加权平均'] },
          { name: '中位数的计算', weight: 2, inAssess: true, concepts: ['统计', '中位数'] },
          { name: '众数的计算', weight: 2, inAssess: true, concepts: ['统计', '众数'] },
          { name: '平均数、中位数、众数的选用', weight: 3, inAssess: true, concepts: ['统计', '数据代表'] },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '数据的波动',
        knowledgePoints: [
          { name: '极差', weight: 2, inAssess: true, concepts: ['统计', '极差'] },
          { name: '方差', weight: 3, inAssess: true, concepts: ['统计', '方差'] },
          { name: '标准差', weight: 3, inAssess: true, concepts: ['统计', '标准差'] },
          { name: '方差的应用', weight: 3, inAssess: true, concepts: ['统计', '稳定性'] },
        ],
      },
    ],
  },
];

// ============================================================
// 初始化函数
// ============================================================

async function initKnowledgePoints() {
  console.log('🚀 开始初始化人教版八年级下册数学知识点...\n');

  try {
    // 1. 创建或获取 Subject
    console.log('📚 检查/创建 Subject...');
    let subject = await prisma.subject.findUnique({
      where: { grade_code: { grade: GRADE, code: MATH_SUBJECT_CODE } },
    });

    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          name: '数学',
          code: MATH_SUBJECT_CODE,
          grade: GRADE,
          status: 'active',
        },
      });
      console.log(`   ✅ 创建 Subject: ${subject.name} (ID: ${subject.id})`);
    } else {
      console.log(`   ✅ 找到现有 Subject: ${subject.name} (ID: ${subject.id})`);
    }

    // 2. 创建或获取 TextbookVersion
    console.log('\n📖 检查/创建 TextbookVersion...');
    let textbook = await prisma.textbookVersion.findUnique({
      where: { grade_subject_name: { grade: GRADE, subject: MATH_SUBJECT_CODE, name: TEXTBOOK_NAME } },
    });

    if (!textbook) {
      textbook = await prisma.textbookVersion.create({
        data: {
          name: TEXTBOOK_NAME,
          publisher: PUBLISHER,
          grade: GRADE,
          subject: MATH_SUBJECT_CODE,
          subjectId: subject.id,
          year: YEAR,
          status: 'active',
        },
      });
      console.log(`   ✅ 创建教材: ${textbook.name} (ID: ${textbook.id})`);
    } else {
      console.log(`   ✅ 找到现有教材: ${textbook.name} (ID: ${textbook.id})`);
    }

    // 3. 收集所有概念，去重后批量创建
    console.log('\n🏷️  处理知识概念...');
    const conceptSet = new Set<string>();
    textbookData.forEach(chapter => {
      chapter.sections.forEach(section => {
        section.knowledgePoints.forEach(kp => {
          kp.concepts.forEach(c => conceptSet.add(c));
        });
      });
    });

    const conceptNames = Array.from(conceptSet);
    console.log(`   发现 ${conceptNames.length} 个知识概念`);

    const existingConcepts = await prisma.knowledgeConcept.findMany({
      where: { name: { in: conceptNames } },
    });

    const existingConceptNames = new Set(existingConcepts.map(c => c.name));
    const newConceptNames = conceptNames.filter(n => !existingConceptNames.has(n));

    if (newConceptNames.length > 0) {
      await prisma.knowledgeConcept.createMany({
        data: newConceptNames.map((name, index) => ({
          name,
          category: index < 5 ? 'core' : 'extended',
          weight: 1,
        })),
      });
      console.log(`   ✅ 创建 ${newConceptNames.length} 个新概念`);
    }

    const allConcepts = await prisma.knowledgeConcept.findMany({
      where: { name: { in: conceptNames } },
    });
    const conceptMap = new Map(allConcepts.map(c => [c.name, c.id]));

    // 4. 创建章节和知识点
    console.log('\n📑 创建章节和知识点...');
    let totalChapters = 0;
    let totalSections = 0;
    let totalKnowledgePoints = 0;

    for (const chapterData of textbookData) {
      // 创建主章节
      const chapter = await prisma.chapter.create({
        data: {
          textbookId: textbook.id,
          chapterNumber: chapterData.chapterNumber,
          chapterName: chapterData.chapterName,
          sort: chapterData.chapterNumber,
        },
      });
      totalChapters++;
      console.log(`\n   第${chapterData.chapterNumber}章: ${chapterData.chapterName}`);

      for (const sectionData of chapterData.sections) {
        // 创建小节
        const section = await prisma.chapter.create({
          data: {
            textbookId: textbook.id,
            chapterNumber: chapterData.chapterNumber,
            chapterName: chapterData.chapterName,
            sectionNumber: sectionData.sectionNumber,
            sectionName: sectionData.sectionName,
            parentId: chapter.id,
            sort: sectionData.sectionNumber,
          },
        });
        totalSections++;
        console.log(`      ${sectionData.sectionNumber}.${sectionData.sectionNumber}`);

        // 创建知识点
        for (const kpData of sectionData.knowledgePoints) {
          // 使用第一个概念作为 primary concept
          const primaryConceptId = conceptMap.get(kpData.concepts[0])!;

          const knowledgePoint = await prisma.knowledgePoint.create({
            data: {
              chapterId: section.id,
              conceptId: primaryConceptId,
              name: kpData.name,
              weight: kpData.weight,
              inAssess: kpData.inAssess,
              status: 'active',
            },
          });
          totalKnowledgePoints++;
          console.log(`         ✓ ${kpData.name}`);
        }
      }
    }

    // 5. 创建知识点覆盖记录
    console.log('\n📊 创建知识点覆盖记录...');
    const knowledgePoints = await prisma.knowledgePoint.findMany({
      where: {
        chapter: {
          textbookId: textbook.id,
        },
        deletedAt: null,
      },
    });

    let coverageCount = 0;
    for (const kp of knowledgePoints) {
      const existing = await prisma.knowledgeCoverage.findUnique({
        where: { knowledgePointId: kp.id },
      });

      if (!existing) {
        await prisma.knowledgeCoverage.create({
          data: {
            knowledgePointId: kp.id,
            targetTemplateCount: 3,
            currentTemplateCount: 0,
            gap: 3,
            priority: kp.weight >= 3 ? 'high' : kp.weight >= 2 ? 'medium' : 'low',
          },
        });
        coverageCount++;
      }
    }
    console.log(`   ✅ 创建 ${coverageCount} 条覆盖记录`);

    // 总结
    console.log('\n' + '='.repeat(50));
    console.log('✅ 初始化完成！');
    console.log('='.repeat(50));
    console.log(`📚 章节: ${totalChapters} 章`);
    console.log(`📄 小节: ${totalSections} 节`);
    console.log(`🎯 知识点: ${totalKnowledgePoints} 个`);
    console.log(`🏷️  概念: ${allConcepts.length} 个`);
    console.log(`📊 覆盖记录: ${coverageCount} 条`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================
// 执行
// ============================================================

if (require.main === module) {
  initKnowledgePoints()
    .then(() => {
      console.log('\n🎉 脚本执行成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 脚本执行失败:', error);
      process.exit(1);
    });
}

export { initKnowledgePoints };
