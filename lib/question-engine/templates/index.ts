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
 * 根据知识点ID获取可用的模板ID列表
 * 查询优先级：直接匹配 > 概念匹配
 */
export async function getTemplateIdsByKnowledgePointId(
  knowledgePointId: string
): Promise<string[]> {
  // 1. 直接匹配：Template.knowledgeId == knowledgePointId
  const directTemplates = await prisma.template.findMany({
    where: {
      knowledgeId: knowledgePointId,
      status: 'production'
    },
    select: { id: true }
  });

  if (directTemplates.length > 0) {
    return directTemplates.map(t => t.id);
  }

  // 2. 概念匹配：获取该知识点的 conceptId，查找同学期的模板
  const kp = await prisma.knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    select: { conceptId: true }
  });

  if (kp) {
    const conceptTemplates = await prisma.template.findMany({
      where: {
        status: 'production',
        knowledge: {
          conceptId: kp.conceptId
        }
      },
      select: { id: true }
    });
    return conceptTemplates.map(t => t.id);
  }

  // 3. 无匹配
  return [];
}

/**
 * 根据知识点ID随机获取一个模板ID
 */
export async function getTemplateIdByKnowledgePointId(
  knowledgePointId: string
): Promise<string | null> {
  const templateIds = await getTemplateIdsByKnowledgePointId(knowledgePointId);
  if (templateIds.length === 0) {
    return null;
  }
  return templateIds[Math.floor(Math.random() * templateIds.length)];
}

/**
 * 根据模板ID获取模板
 */
export function getTemplate(templateId: string): QuestionTemplate | null {
  return TEMPLATE_REGISTRY[templateId] || null;
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