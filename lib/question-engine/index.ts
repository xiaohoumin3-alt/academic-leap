/**
 * 学习执行引擎（Learning Execution Engine）
 * 统一导出
 */

// 协议定义
export * from './protocol';

// 模板引擎
export * from './templates/index';

// 判题引擎
export * from './judge';

// 渲染层
export * from './render';

// 难度配置
export * from './difficulty';

/**
 * 生成题目（主入口）
 */
import { QuestionProtocol } from './protocol';
import { getTemplateIdByKnowledgePointId, getTemplate } from './templates';
import { renderQuestion } from './render';

export interface GenerateQuestionOptions {
  knowledgePoint: string;
  difficultyLevel: number;
  renderStyle?: 'standard' | 'guided' | 'gamified' | 'story';
}

/**
 * 生成单个题目
 */
export async function generateQuestion(
  options: GenerateQuestionOptions
): Promise<QuestionProtocol | null> {
  const { knowledgePoint, difficultyLevel, renderStyle = 'standard' } = options;

  // 1. 选择模板（未知知识点时回退到"二次函数"）
  let resolvedKnowledge = knowledgePoint;
  let templateId = await getTemplateIdByKnowledgePointId(resolvedKnowledge);
  if (!templateId) {
    console.warn(`知识点 "${resolvedKnowledge}" 未找到模板，回退到"二次函数"`);
    resolvedKnowledge = '二次函数';
    templateId = await getTemplateIdByKnowledgePointId(resolvedKnowledge);
  }
  if (!templateId) {
    console.error(`无法为知识点 "${resolvedKnowledge}" 获取模板`);
    return null;
  }

  const template = getTemplate(templateId);
  if (!template) {
    console.error(`模板 "${templateId}" 不存在`);
    return null;
  }

  // 2. 生成参数
  const params = template.generateParams(difficultyLevel);

  // 3. 构建步骤
  const steps = template.buildSteps(params);

  // 4. 渲染内容
  const content = template.render(params);

  // 5. 组装题目
  const question: QuestionProtocol = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    knowledgePoint: resolvedKnowledge,
    templateId,
    difficultyLevel,
    params,
    steps,
    content,
    meta: {
      version: '1.0',
      source: 'template_engine',
    },
  };

  // 6. AI增强渲染（可选）
  return renderQuestion(question, renderStyle);
}

/**
 * 批量生成题目
 */
export async function generateQuestions(
  knowledgePoint: string,
  count: number,
  difficultyLevel: number = 2,
  renderStyle: 'standard' | 'guided' | 'gamified' | 'story' = 'standard'
): Promise<QuestionProtocol[]> {
  const questions: QuestionProtocol[] = [];

  for (let i = 0; i < count; i++) {
    const question = await generateQuestion({
      knowledgePoint,
      difficultyLevel,
      renderStyle,
    });
    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

/**
 * 获取所有支持的知识点
 */
export function getSupportedKnowledgePoints(): string[] {
  const { getAllKnowledgePoints } = require('./templates');
  return getAllKnowledgePoints();
}
