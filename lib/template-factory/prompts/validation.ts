import type { GeneratedTemplate } from '../types';

export function buildMathValidationPrompt(template: GeneratedTemplate): string {
  return `请验证以下数学题目模板的数学正确性验证。

模板名称：${template.name}
题目模板：${template.template}
答案模板：${template.answer}
参数：${JSON.stringify(template.params, null, 2)}
约束条件：${template.constraint}

检查项：
1. 答案计算是否正确
2. 参数约束是否完整
3. 边界条件是否考虑
4. 特殊情况是否处理

输出JSON格式：
\`\`\`json
{
  "passed": true/false,
  "issues": ["问题1", "问题2"],
  "confidence": 0.0-1.0,
  "explanation": "详细说明"
}
\`\`\``;
}

export function buildPedagogyValidationPrompt(
  template: GeneratedTemplate,
  context: { knowledgePoint: string; grade: number }
): string {
  return `请验证以下题目模板的教学有效性验证。

知识点：${context.knowledgePoint}
年级：${context.grade}年级

模板名称：${template.name}
题目模板：${template.template}
难度等级：${template.difficulty}
认知负荷：${template.cognitiveLoad}
推理深度：${template.reasoningDepth}
学习目标：${template.learningObjective}
提示：${template.hint}
相关概念：${template.concepts.join('、')}

检查项：
1. 题目是否符合教学目标
2. 难度标注是否合理
3. 步骤是否清晰
4. 提示是否有帮助
5. 概念关联是否准确

输出JSON格式：
\`\`\`json
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["问题1", "问题2"],
  "explanation": "详细说明"
}
\`\`\``;
}

export function parseValidationResponse(content: string): {
  passed: boolean;
  issues: string[];
  score?: number;
  confidence?: number;
  explanation?: string;
} | null {
  try {
    let jsonContent = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1];
    }

    return JSON.parse(jsonContent);
  } catch {
    return null;
  }
}
