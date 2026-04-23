/**
 * 模板注册表
 * 所有题目模板的中央仓库
 */

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
 * 知识点到模板ID的映射
 * 一个知识点可以有多个模板
 */
export const KNOWLEDGE_TO_TEMPLATES: Record<string, string[]> = {
  '二次函数': ['quadratic_vertex', 'quadratic_evaluate'],
  '勾股定理': ['pythagoras'],
  '概率统计': ['probability'],
  '一元一次方程': ['linear_equation'],
};

/**
 * 根据知识点获取模板ID
 * 随机选择一个模板
 */
export function getTemplateIdByKnowledge(knowledgePoint: string): string | null {
  const templates = KNOWLEDGE_TO_TEMPLATES[knowledgePoint];
  if (!templates || templates.length === 0) {
    return null;
  }
  // 随机选择一个模板
  return templates[Math.floor(Math.random() * templates.length)];
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
  return Object.keys(KNOWLEDGE_TO_TEMPLATES);
}

/**
 * 获取所有可用的模板ID
 */
export function getAllTemplateIds(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}
