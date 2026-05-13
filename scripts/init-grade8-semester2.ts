/**
 * 人教版八年级下册数学 - 知识点初始化脚本 V2
 *
 * 内容来源：
 * 1. 人教版八年级下册数学知识纲要 (PDF)
 * 2. 八年级下册数学期末考点与题型解析 (PDF)
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
const TEXTBOOK_NAME = '人教版八年级下册数学';
const PUBLISHER = '人民教育出版社';
const YEAR = '2024';

interface KnowledgePointData {
  name: string;
  weight: number;
  inAssess: boolean;
  concepts: string[];
  description?: string;
}

interface SectionData {
  sectionNumber: number;
  sectionName: string;
  knowledgePoints: KnowledgePointData[];
}

interface ChapterData {
  chapterNumber: number;
  chapterName: string;
  sections: SectionData[];
}

const textbookData: ChapterData[] = [
  {
    chapterNumber: 16,
    chapterName: '二次根式',
    sections: [
      {
        sectionNumber: 1,
        sectionName: '16.1 二次根式',
        knowledgePoints: [
          {
            name: '二次根式的定义',
            weight: 1,
            inAssess: true,
            concepts: ['代数', '根式'],
            description: '形如 $\\sqrt{a}(a\\geq 0)$ 的式子叫做二次根式'
          },
          {
            name: '二次根式有意义的条件',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '根式'],
            description: '二次根式中被开方数必须大于等于零'
          },
          {
            name: '$\\sqrt{a}$ 的非负性',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '根式', '非负性'],
            description: '$\\sqrt{a} \\geq 0$（算术平方根的非负性）'
          },
          {
            name: '$(\\sqrt{a})^2 = a$ 的应用',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '运算'],
            description: '当 $a \\geq 0$ 时，$(\\sqrt{a})^2 = a$'
          },
          {
            name: '$\\sqrt{a^2} = |a|$ 的应用',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '绝对值'],
            description: '$\\sqrt{a^2} = |a| = \\begin{cases} a, & a \\geq 0 \\\\ -a, & a < 0 \\end{cases}$'
          },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '16.2 二次根式的乘除',
        knowledgePoints: [
          {
            name: '$\\sqrt{a} \\cdot \\sqrt{b} = \\sqrt{ab}$（$a\\geq0, b\\geq0$）',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '乘法'],
            description: '乘法法则：两个非负数的算术平方根的积等于积的算术平方根'
          },
          {
            name: '$\\frac{\\sqrt{a}}{\\sqrt{b}} = \\sqrt{\\frac{a}{b}}$（$a\\geq0, b>0$）',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '除法'],
            description: '除法法则：非负数除以正数的算术平方根等于商的算术平方根'
          },
          {
            name: '积的算术平方根公式逆用',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '运算'],
            description: '$\\sqrt{ab} = \\sqrt{a} \\cdot \\sqrt{b}$（$a\\geq0, b\\geq0$）'
          },
          {
            name: '商的算术平方根公式逆用',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '运算'],
            description: '$\\sqrt{\\frac{a}{b}} = \\frac{\\sqrt{a}}{\\sqrt{b}}$（$a\\geq0, b>0$）'
          },
          {
            name: '二次根式的乘法运算',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '运算'],
            description: '多个二次根式相乘，先系数相乘，再根式相乘'
          },
          {
            name: '二次根式的除法运算',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '运算'],
            description: '二次根式相除，把被除式乘以除式的倒数，再进行乘法运算'
          },
          {
            name: '$\\sqrt{a}$ 与 $\\sqrt{b}$ 的比较大小',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '比较'],
            description: '比较大小：同次看被开方数，异次化为同次根式'
          },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '16.3 二次根式的加减',
        knowledgePoints: [
          {
            name: '同类二次根式的概念',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '分类'],
            description: '化为最简二次根式后，被开方数相同的二次根式叫做同类二次根式'
          },
          {
            name: '二次根式加减法法则',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '加减'],
            description: '先把各二次根式化成最简二次根式，再合并同类二次根式'
          },
          {
            name: '二次根式混合运算',
            weight: 4,
            inAssess: true,
            concepts: ['代数', '混合运算'],
            description: '先乘除，后加减；有括号先算括号内的；运算律同样适用'
          },
          {
            name: '分母有理化',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '化简'],
            description: '把分母中的根号去掉，即分子分母同乘以适当的代数式'
          },
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
        sectionName: '17.1 勾股定理',
        knowledgePoints: [
          {
            name: '勾股定理的表述',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '定理'],
            description: '直角三角形两直角边的平方和等于斜边的平方'
          },
          {
            name: '勾股定理的基本应用',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '计算'],
            description: '已知两边求第三边：$c = \\sqrt{a^2 + b^2}$, $a = \\sqrt{c^2 - b^2}$'
          },
          {
            name: '勾股定理的几何证明',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '证明'],
            description: '会用面积法（赵爽弦图等）证明勾股定理'
          },
          {
            name: '勾股定理在实际问题中的应用',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '应用'],
            description: '解决航海、测量、工程等实际问题中的距离计算'
          },
          {
            name: '勾股数',
            weight: 2,
            inAssess: true,
            concepts: ['数论', '勾股数'],
            description: '满足 $a^2 + b^2 = c^2$ 的正整数三元组 $(a, b, c)$ 叫勾股数'
          },
          {
            name: '常见勾股数',
            weight: 2,
            inAssess: true,
            concepts: ['数论', '勾股数'],
            description: '常用勾股数：(3,4,5)、(5,12,13)、(6,8,10)、(7,24,25)、(8,15,17)'
          },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '17.2 勾股定理逆定理',
        knowledgePoints: [
          {
            name: '勾股定理逆定理的表述',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '定理'],
            description: '如果三角形的三边满足 $a^2 + b^2 = c^2$，则这个三角形是直角三角形'
          },
          {
            name: '逆定理的证明',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '证明'],
            description: '会用构造法证明勾股定理逆定理'
          },
          {
            name: '判定直角三角形',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: '根据三边数量关系判定三角形是否为直角三角形'
          },
          {
            name: '勾股定理与逆定理的综合应用',
            weight: 4,
            inAssess: true,
            concepts: ['几何', '综合'],
            description: '结合两个定理解决证明题和计算题'
          },
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
        sectionName: '18.1 平行四边形及其性质',
        knowledgePoints: [
          {
            name: '平行四边形的定义',
            weight: 1,
            inAssess: true,
            concepts: ['几何', '四边形'],
            description: '两组对边分别平行的四边形叫做平行四边形'
          },
          {
            name: '平行四边形的表示方法',
            weight: 1,
            inAssess: true,
            concepts: ['几何', '四边形'],
            description: '平行四边形 ABCD 记作 $\\square ABCD$'
          },
          {
            name: '平行四边形的对边相等',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '性质'],
            description: '平行四边形的对边平行且相等'
          },
          {
            name: '平行四边形的对角相等',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '性质'],
            description: '平行四边形的对角相等'
          },
          {
            name: '平行四边形的邻角互补',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '性质'],
            description: '平行四边形的相邻的两个角互为邻补角'
          },
          {
            name: '平行四边形的对角线互相平分',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '性质'],
            description: '平行四边形的对角线互相平分'
          },
          {
            name: '平行四边形的面积公式',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '面积'],
            description: '$S_{\\square ABCD} = ah$，其中 $h$ 是边 $a$ 上的高'
          },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '18.2 平行四边形的判定',
        knowledgePoints: [
          {
            name: '两组对边分别平行的四边形是平行四边形',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: '定义判定法'
          },
          {
            name: '两组对边分别相等的四边形是平行四边形',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: 'SSS 边相等判定'
          },
          {
            name: '一组对边平行且相等的四边形是平行四边形',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: 'SAS 边角相等判定'
          },
          {
            name: '对角线互相平分的四边形是平行四边形',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: '对角线中点判定'
          },
          {
            name: '两组对角分别相等的四边形是平行四边形',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: '角相等判定'
          },
          {
            name: '平行四边形判定的综合应用',
            weight: 4,
            inAssess: true,
            concepts: ['几何', '判定'],
            description: '多种判定方法综合运用证明平行四边形'
          },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '18.3 特殊的平行四边形',
        knowledgePoints: [
          {
            name: '矩形的定义',
            weight: 1,
            inAssess: true,
            concepts: ['几何', '矩形'],
            description: '有一个角是直角的平行四边形叫做矩形'
          },
          {
            name: '矩形的性质',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '矩形'],
            description: '矩形具有平行四边形的所有性质，还有四个角都是直角，对角线相等'
          },
          {
            name: '矩形的判定',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '矩形'],
            description: '有三个角是直角的四边形是矩形；对角线相等的平行四边形是矩形'
          },
          {
            name: '直角三角形的斜边中线等于斜边的一半',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '直角三角形'],
            description: '直角三角形斜边上的中线等于斜边的一半'
          },
          {
            name: '菱形的定义',
            weight: 1,
            inAssess: true,
            concepts: ['几何', '菱形'],
            description: '一组邻边相等的平行四边形叫做菱形'
          },
          {
            name: '菱形的性质',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '菱形'],
            description: '菱形具有平行四边形的所有性质，还有四条边都相等，对角线互相垂直'
          },
          {
            name: '菱形的判定',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '菱形'],
            description: '四边相等的四边形是菱形；对角线互相垂直的平行四边形是菱形'
          },
          {
            name: '正方形的定义',
            weight: 1,
            inAssess: true,
            concepts: ['几何', '正方形'],
            description: '一组邻边相等且有一个角是直角的平行四边形是正方形'
          },
          {
            name: '正方形的性质',
            weight: 2,
            inAssess: true,
            concepts: ['几何', '正方形'],
            description: '正方形具有矩形和菱形的所有性质'
          },
          {
            name: '正方形的判定',
            weight: 4,
            inAssess: true,
            concepts: ['几何', '正方形'],
            description: '对角线互相垂直且相等且平分的四边形是正方形'
          },
          {
            name: '矩形、菱形、正方形之间的关系',
            weight: 3,
            inAssess: true,
            concepts: ['几何', '分类'],
            description: '理解特殊平行四边形的包含关系'
          },
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
        sectionName: '19.1 函数',
        knowledgePoints: [
          {
            name: '常量与变量的概念',
            weight: 1,
            inAssess: true,
            concepts: ['代数', '函数基础'],
            description: '在变化过程中不变的量叫常量，可以取不同值的量叫变量'
          },
          {
            name: '函数的定义',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '函数'],
            description: '在某个变化过程中有两个变量 x 和 y，对于 x 的每一个值，y 都有唯一的值与之对应'
          },
          {
            name: '函数的三种表示方法',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '函数'],
            description: '解析法、列表法、图像法'
          },
          {
            name: '自变量取值范围的确定',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '定义域'],
            description: '使函数有意义的自变量的取值范围'
          },
          {
            name: '函数值的概念',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '函数'],
            description: '当自变量取某个值时，对应的因变量的值叫做函数值'
          },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '19.2 一次函数',
        knowledgePoints: [
          {
            name: '正比例函数的定义',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '正比例'],
            description: '形如 $y = kx$（$k \\neq 0$）的函数叫做正比例函数'
          },
          {
            name: '正比例函数的图像与性质',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '图像'],
            description: '正比例函数的图像是经过原点的一条直线，$k>0$ 时过一、三象限，$k<0$ 时过二、四象限'
          },
          {
            name: '一次函数的定义',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '一次函数'],
            description: '形如 $y = kx + b$（$k \\neq 0$）的函数叫做一次函数'
          },
          {
            name: '一次函数的图像',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '图像'],
            description: '一次函数的图像是一条直线，可由正比例函数图像平移得到'
          },
          {
            name: '一次函数的性质',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '性质'],
            description: '$k>0$ 时 y 随 x 增大而增大；$k<0$ 时 y 随 x 增大而减小'
          },
          {
            name: '$k$ 值对一次函数图像的影响',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '斜率'],
            description: '$|k|$ 越大，直线与 x 轴正方向的夹角越大'
          },
          {
            name: '$b$ 值对一次函数图像的影响',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '截距'],
            description: '$b$ 是直线与 y 轴的交点纵坐标'
          },
          {
            name: '一次函数与正比例函数的关系',
            weight: 2,
            inAssess: true,
            concepts: ['代数', '一次函数'],
            description: '正比例函数是一次函数的特殊形式（$b=0$）'
          },
        ],
      },
      {
        sectionNumber: 3,
        sectionName: '19.3 一次函数与方程、不等式',
        knowledgePoints: [
          {
            name: '一次函数与一元一次方程的关系',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '方程'],
            description: '$kx + b = 0$ 的解就是 $y = kx + b$ 与 x 轴交点的横坐标'
          },
          {
            name: '一次函数与一元一次不等式的关系',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '不等式'],
            description: '$kx + b > 0$ 的解集就是 $y = kx + b$ 图像在 x 轴上方的部分对应的 x 值'
          },
          {
            name: '用函数观点解方程',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '方程'],
            description: '将方程问题转化为直线与 x 轴交点问题'
          },
          {
            name: '用函数观点解不等式',
            weight: 3,
            inAssess: true,
            concepts: ['代数', '不等式'],
            description: '将不等式问题转化为直线与 x 轴的位置关系问题'
          },
          {
            name: '一次函数与二元一次方程组的关系',
            weight: 4,
            inAssess: true,
            concepts: ['代数', '方程组'],
            description: '二元一次方程组对应两条直线的交点'
          },
          {
            name: '待定系数法求一次函数解析式',
            weight: 4,
            inAssess: true,
            concepts: ['代数', '一次函数'],
            description: '设函数解析式为 $y = kx + b$，利用条件求 k 和 b'
          },
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
        sectionName: '20.1 数据的集中趋势',
        knowledgePoints: [
          {
            name: '平均数的意义与计算',
            weight: 2,
            inAssess: true,
            concepts: ['统计', '平均数'],
            description: '算术平均数：$\\bar{x} = \\frac{x_1 + x_2 + ... + x_n}{n}$'
          },
          {
            name: '加权平均数',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '加权平均'],
            description: '$\\bar{x} = \\frac{x_1 f_1 + x_2 f_2 + ... + x_k f_k}{n}$，其中 $f_i$ 是第 i 个数据的权'
          },
          {
            name: '中位数的意义与计算',
            weight: 2,
            inAssess: true,
            concepts: ['统计', '中位数'],
            description: '将数据按大小顺序排列后，中间的数据（或中间两个数据的平均值）'
          },
          {
            name: '众数的意义与计算',
            weight: 2,
            inAssess: true,
            concepts: ['统计', '众数'],
            description: '一组数据中出现次数最多的数据'
          },
          {
            name: '平均数、中位数、众数的选用',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '数据分析'],
            description: '根据数据特点和分析目的选择合适的代表数'
          },
          {
            name: '用样本估计总体',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '抽样'],
            description: '用样本的平均数估计总体的平均水平'
          },
        ],
      },
      {
        sectionNumber: 2,
        sectionName: '20.2 数据的波动程度',
        knowledgePoints: [
          {
            name: '极差的概念与计算',
            weight: 2,
            inAssess: true,
            concepts: ['统计', '极差'],
            description: '极差 = 最大值 - 最小值，反映数据的波动范围'
          },
          {
            name: '方差的概念与计算',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '方差'],
            description: '$s^2 = \\frac{1}{n}[(x_1 - \\bar{x})^2 + (x_2 - \\bar{x})^2 + ... + (x_n - \\bar{x})^2]$'
          },
          {
            name: '标准差的概念与计算',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '标准差'],
            description: '$s = \\sqrt{s^2}$，与原数据单位相同'
          },
          {
            name: '方差的意义',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '方差'],
            description: '方差越大，数据波动越大；方差越小，数据波动越小'
          },
          {
            name: '用样本方差估计总体方差',
            weight: 3,
            inAssess: true,
            concepts: ['统计', '抽样'],
            description: '用样本方差估计总体的波动程度'
          },
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
    // 1. 创建或获取 Subject (数学 八年级)
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
          category: index < 8 ? 'core' : 'extended',
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
    const createdKps: { id: string; name: string; chapterName: string }[] = [];

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
            sort: chapterData.chapterNumber * 100 + sectionData.sectionNumber,
          },
        });
        totalSections++;
        console.log(`      ${sectionData.sectionName}`);

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
              description: kpData.description || null,
            },
          });
          totalKnowledgePoints++;
          createdKps.push({
            id: knowledgePoint.id,
            name: knowledgePoint.name,
            chapterName: chapterData.chapterName,
          });
          console.log(`         ✓ ${kpData.name}`);
        }
      }
    }

    // 5. 统计总结
    console.log('\n' + '='.repeat(60));
    console.log('✅ 初始化完成！');
    console.log('='.repeat(60));
    console.log(`📚 章节: ${totalChapters} 章`);
    console.log(`📄 小节: ${totalSections} 节`);
    console.log(`🎯 知识点: ${totalKnowledgePoints} 个`);
    console.log(`🏷️  概念: ${allConcepts.length} 个`);
    console.log('='.repeat(60));

    // 输出知识点ID供后续使用
    console.log('\n📋 知识点列表（按章节）:');
    let currentChapter = '';
    for (const kp of createdKps) {
      if (kp.chapterName !== currentChapter) {
        currentChapter = kp.chapterName;
        console.log(`\n  【${currentChapter}】`);
      }
      console.log(`    - ${kp.name}: ${kp.id}`);
    }

    return { totalKnowledgePoints, createdKps };

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