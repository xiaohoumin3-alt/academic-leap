import type { GenerationRequest, GeneratedTemplate } from '../types';

export function buildGenerationPrompt(request: GenerationRequest): string {
  const { knowledgePoint, targetStructures, targetDepths, count, context } = request;

  const structureDesc = targetStructures.join('、');
  const depthDesc = targetDepths.map((d) => `depth ${d}`).join('、');
  const relatedDesc = context.relatedConcepts.length > 0 ? context.relatedConcepts.join('、') : '无';

  return `你是一个数学教育专家。请为以下知识点生成${count}个题目模板。

知识点：${knowledgePoint.name}
${knowledgePoint.description ? `定义：${knowledgePoint.description}` : ''}
年级：${context.grade}年级
${context.textbook ? `教材：${context.textbook}` : ''}
相关概念：${relatedDesc}

要求：
1. 模板结构为：${structureDesc}
2. 模板深度为：${depthDesc}
3. 使用{param}占位符表示参数
4. 提供constraint约束条件
5. 提供详细的解题步骤
6. 标注难度等级（1-5）和认知负荷（0-1）
7. 关联相关的数学概念

输出JSON格式：
\`\`\`json
{
  "templates": [
    {
      "name": "模板名称",
      "template": "题目模板文本，如：解方程 {a}x + {b} = {c}",
      "answer": "答案模板，如：x = {x}",
      "params": {
        "a": {"type": "range", "min": 1, "max": 10},
        "b": {"type": "range", "min": -10, "max": 10}
      },
      "constraint": "约束条件说明",
      "steps": ["解题步骤1", "解题步骤2"],
      "hint": "给学生提示",
      "difficulty": 3,
      "cognitiveLoad": 0.5,
      "reasoningDepth": 0.6,
      "learningObjective": "学习目标描述",
      "concepts": ["相关概念1", "相关概念2"]
    }
  ]
}
\`\`\`

请生成${count}个不同变体的模板，确保多样性。`;
}

export function parseGenerationResponse(content: string): {
  templates: GeneratedTemplate[];
  errors: string[];
} {
  const templates: GeneratedTemplate[] = [];
  const errors: string[] = [];

  try {
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonContent);

    if (parsed.templates && Array.isArray(parsed.templates)) {
      templates.push(...parsed.templates);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown parse error');
  }

  return { templates, errors };
}
