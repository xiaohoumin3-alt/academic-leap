/**
 * 模板注册表
 * 所有题目模板的中央仓库
 */

import { prisma } from '@/lib/prisma';
import { QuestionTemplate } from '../protocol';
import { QuadraticVertexTemplate, QuadraticEvaluateTemplate } from './quadratic-function';
import { PythagorasTemplate } from './pythagoras';
import { ProbabilityTemplate, LinearEquationTemplate } from './probability';

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