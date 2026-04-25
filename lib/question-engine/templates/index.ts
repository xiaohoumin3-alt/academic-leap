/**
 * 模板注册表
 * 所有题目模板的中央仓库
 */

import { prisma } from '@/lib/prisma';
import { QuestionTemplate } from '../protocol';
import { QuadraticVertexTemplate, QuadraticEvaluateTemplate } from './quadratic-function';
import { PythagorasTemplate } from './pythagoras';
import { ProbabilityTemplate, LinearEquationTemplate } from './probability';
import { QuadraticIdentifyTemplate } from './chapter19/quadratic_identify';
import { QuadraticDirectRootTemplate } from './chapter19/quadratic_direct_root';
import { QuadraticFormulaTemplate } from './chapter19/quadratic_formula';
import { QuadraticCompleteSquareTemplate } from './chapter19/quadratic_complete_square';
import { QuadraticFactorizeTemplate } from './chapter19/quadratic_factorize';
import { QuadraticGrowthTemplate } from './chapter19/quadratic_growth';
import { QuadraticAreaTemplate } from './chapter19/quadratic_area';
import { CentralTendencyTemplate } from './chapter20/central_tendency';
import { DataStddevTemplate } from './chapter20/data_stddev';
import { DataVarianceTemplate } from './chapter20/data_variance';
import { SqrtConceptTemplate } from './chapter16/sqrt_concept';
import { SqrtSimplifyTemplate } from './chapter16/sqrt_simplify';
import { SqrtPropertyTemplate } from './chapter16/sqrt_property';
import { SqrtMultiplyTemplate } from './chapter16/sqrt_multiply';
import { SqrtDivideTemplate } from './chapter16/sqrt_divide';
import { SqrtAddSubtractTemplate } from './chapter16/sqrt_add_subtract';
import { RhombusPropertyTemplate } from './chapter18/rhombus_property';
import { RhombusVerifyTemplate } from './chapter18/rhombus_verify';
import { ParallelogramVerifyTemplate } from './chapter18/parallelogram_verify';
import { RectanglePropertyTemplate } from './chapter18/rectangle_property';
import { RectangleVerifyTemplate } from './chapter18/rectangle_verify';
import { SquarePropertyTemplate } from './chapter18/square_property';
import { SquareVerifyTemplate } from './chapter18/square_verify';
import { QuadrilateralPerimeterTemplate } from './chapter18/quadrilateral_perimeter';
import { QuadrilateralAreaTemplate } from './chapter18/quadrilateral_area';
import { TrapezoidPropertyTemplate } from './chapter18/trapezoid_property';

/**
 * 模板注册表
 */
export const TEMPLATE_REGISTRY: Record<string, QuestionTemplate> = {
  // 二次函数
  quadratic_vertex: QuadraticVertexTemplate,
  quadratic_evaluate: QuadraticEvaluateTemplate,

  // 勾股定理
  pythagoras: PythagorasTemplate,

  // 概率统计
  probability: ProbabilityTemplate,

  // 一元一次方程
  linear_equation: LinearEquationTemplate,

  // 一元二次方程（第19章）
  quadratic_identify: QuadraticIdentifyTemplate,
  quadratic_direct_root: QuadraticDirectRootTemplate,
  quadratic_formula: QuadraticFormulaTemplate,
  quadratic_complete_square: QuadraticCompleteSquareTemplate,
  quadratic_factorize: QuadraticFactorizeTemplate,
  quadratic_growth: QuadraticGrowthTemplate,
  quadratic_area: QuadraticAreaTemplate,

  // 数据分析（第20章）
  central_tendency: CentralTendencyTemplate,
  data_stddev: DataStddevTemplate,
  data_variance: DataVarianceTemplate,

  // 二次根式（第16章）
  sqrt_concept: SqrtConceptTemplate,
  sqrt_simplify: SqrtSimplifyTemplate,
  sqrt_property: SqrtPropertyTemplate,
  sqrt_multiply: SqrtMultiplyTemplate,
  sqrt_divide: SqrtDivideTemplate,
  sqrt_add_subtract: SqrtAddSubtractTemplate,

  // 菱形（第18章）
  rhombus_property: RhombusPropertyTemplate,
  rhombus_verify: RhombusVerifyTemplate,

  // 平行四边形与矩形（第18章）
  parallelogram_verify: ParallelogramVerifyTemplate,
  rectangle_property: RectanglePropertyTemplate,
  rectangle_verify: RectangleVerifyTemplate,

  // 正方形（第18章）
  square_property: SquarePropertyTemplate,
  square_verify: SquareVerifyTemplate,

  // 四边形周长计算（第18章）
  quadrilateral_perimeter: QuadrilateralPerimeterTemplate,

  // 四边形面积计算（第18章）
  quadrilateral_area: QuadrilateralAreaTemplate,

  // 梯形性质计算（第18章）
  trapezoid_property: TrapezoidPropertyTemplate,
};

/**
 * 根据知识点获取可用的模板KEY列表
 * 支持ID或名称查询
 * 查询优先级：概念ID匹配 > 概念名称匹配 > 知识点概念查找
 * 返回 TEMPLATE_REGISTRY 的 key（如 quadratic_vertex），而不是数据库 id
 */
export async function getTemplateIdsByKnowledgePointId(
  knowledgePointIdOrName: string
): Promise<string[]> {
  // 1. 直接匹配：Template.knowledgeId (conceptId) == input（使用 templateKey）
  const directTemplates = await prisma.template.findMany({
    where: {
      knowledgeId: knowledgePointIdOrName,
      status: 'production',
      templateKey: { not: null }
    },
    select: { templateKey: true }
  });

  if (directTemplates.length > 0) {
    return directTemplates.map(t => t.templateKey!).filter(Boolean);
  }

  // 2. 名称匹配：通过概念名称查找对应的模板（使用 templateKey）
  const nameTemplates = await prisma.template.findMany({
    where: {
      status: 'production',
      templateKey: { not: null },
      knowledge: {
        name: knowledgePointIdOrName
      }
    },
    select: { templateKey: true }
  });

  if (nameTemplates.length > 0) {
    return nameTemplates.map(t => t.templateKey!).filter(Boolean);
  }

  // 3. 知识点概念查找：如果是知识点ID或名称，找到其对应的概念，然后查找模板
  const kp = await prisma.knowledgePoint.findFirst({
    where: {
      OR: [
        { id: knowledgePointIdOrName },
        { name: knowledgePointIdOrName }
      ]
    },
    select: { conceptId: true }
  });

  if (kp) {
    const conceptTemplates = await prisma.template.findMany({
      where: {
        status: 'production',
        templateKey: { not: null },
        knowledgeId: kp.conceptId
      },
      select: { templateKey: true }
    });
    return conceptTemplates.map(t => t.templateKey!).filter(Boolean);
  }

  // 4. 无匹配
  return [];
}

/**
 * 根据知识点获取一个随机模板KEY
 */
export async function getTemplateIdByKnowledgePointId(
  knowledgePointId: string
): Promise<string | null> {
  const templateKeys = await getTemplateIdsByKnowledgePointId(knowledgePointId);
  if (templateKeys.length === 0) {
    return null;
  }
  return templateKeys[Math.floor(Math.random() * templateKeys.length)];
}

/**
 * 根据模板KEY获取模板实例
 * @param templateKey - TEMPLATE_REGISTRY 的 key（如 quadratic_vertex）
 */
export function getTemplate(templateKey: string): QuestionTemplate | null {
  return TEMPLATE_REGISTRY[templateKey] || null;
}

/**
 * 获取所有可用的知识点
 */
export function getAllKnowledgePoints(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * 获取所有可用的模板ID
 */
export function getAllTemplateIds(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}