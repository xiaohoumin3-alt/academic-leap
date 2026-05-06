/**
 * 题目生成器 - Phase 3增强版本
 *
 * 支持两种生成模式：
 * 1. 基础题型：直接AI生成（选择题、判断题）
 * 2. 复杂题型：模板+AI填充（计算题、应用题）
 */

import { ModelAdapter, ModelType, TaskComplexity } from '@/lib/ai/model-adapter';
import { generateFillBlank as generateFillBlankFromAI, type FillBlankRequest, type FillBlankQuestion } from '@/lib/ai/question-generator';

export type QuestionType =
  | 'multiple_choice'  // 选择题
  | 'true_false'       // 判断题
  | 'calculation'      // 计算题
  | 'word_problem'     // 应用题
  | 'fill_blank';     // 填空题

export interface GenerateRequest {
  type: QuestionType;
  knowledgePoint: string;
  grade: number;
  template?: {
    structure: string;
    params: Record<string, unknown>;
  };
  count?: number;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  question: string;
  answer: string | boolean;
  options?: string[];
  steps?: string[];
  explanation?: string;
  template?: string;
  difficulty: number;
  blanks?: { question: string; answer: string }[];  // 填空题答案
}

export class QuestionGenerator {
  private adapter: ModelAdapter;

  constructor(model?: ModelType) {
    this.adapter = new ModelAdapter({ model: model || 'claude-sonnet-4.6' });
  }

  /**
   * 生成单个题目
   */
  async generate(request: GenerateRequest): Promise<GeneratedQuestion> {
    // 根据题型选择生成策略
    switch (request.type) {
      case 'multiple_choice':
      case 'true_false':
        return this.generateSimpleQuestion(request);
      case 'calculation':
        return this.generateCalculation(request);
      case 'word_problem':
        return this.generateWordProblem(request);
      case 'fill_blank':
        return this.generateFillBlank(request);
      default:
        throw new Error(`Unsupported question type: ${request.type}`);
    }
  }

  /**
   * 基础题型AI生成（选择题、判断题）
   */
  private async generateSimpleQuestion(request: GenerateRequest): Promise<GeneratedQuestion> {
    const prompt = this.buildSimpleQuestionPrompt(request);

    // 简单任务使用Haiku
    const model = this.selectModelForQuestion(request);
    const adapter = new ModelAdapter({ model });

    const response = await adapter.generate(prompt, {
      responseFormat: 'json',
      maxTokens: 1000
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error('Failed to parse AI response');
    }

    const data = parsed as {
      question: string;
      options?: string[];
      answer: string | boolean;
      explanation?: string;
    };

    return {
      id: Math.random().toString(36).substring(7),
      type: request.type,
      question: data.question,
      options: data.options,
      answer: data.answer,
      explanation: data.explanation,
      difficulty: this.calculateDifficulty(request.grade)
    };
  }

  /**
   * 计算题生成（使用模板）
   */
  private async generateCalculation(request: GenerateRequest): Promise<GeneratedQuestion> {
    // 计算题使用预定义模板
    const template = request.template?.structure || 'COMPUTE_SQRT';
    const params = request.template?.params || { min: 1, max: 100 };

    // 使用AI生成具体数值
    const prompt = `
请根据以下模板生成一道${request.grade}年级的计算题：

模板类型：${template}
知识点：${request.knowledgePoint}
参数范围：${JSON.stringify(params)}

请返回JSON格式：
{
  "question": "题目描述",
  "answer": "答案",
  "steps": ["步骤1", "步骤2"]
}
`;

    const response = await this.adapter.generate(prompt, {
      responseFormat: 'json',
      maxTokens: 1000
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error('Failed to parse AI response');
    }

    const data = parsed as {
      question: string;
      answer: string;
      steps?: string[];
    };

    return {
      id: Math.random().toString(36).substring(7),
      type: 'calculation',
      question: data.question,
      answer: data.answer,
      steps: data.steps,
      template,
      difficulty: this.calculateDifficulty(request.grade)
    };
  }

  /**
   * 应用题生成（模板+AI）
   */
  private async generateWordProblem(request: GenerateRequest): Promise<GeneratedQuestion> {
    const prompt = `
请为${request.grade}年级学生生成一道关于"${request.knowledgePoint}"的应用题。

要求：
1. 情境贴近学生生活
2. 难度适中
3. 包含完整的解题步骤
4. 字数控制在100字以内

请返回JSON格式：
{
  "scenario": "题目描述",
  "steps": ["步骤1", "步骤2", "步骤3"],
  "answer": "最终答案"
}
`;

    // 复杂任务使用Sonnet
    const adapter = new ModelAdapter({ model: 'claude-sonnet-4.6' });
    const response = await adapter.generate(prompt, {
      responseFormat: 'json',
      maxTokens: 2000
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error('Failed to parse AI response');
    }

    const data = parsed as {
      scenario: string;
      steps: string[];
      answer: string;
    };

    return {
      id: Math.random().toString(36).substring(7),
      type: 'word_problem',
      question: data.scenario,
      answer: data.answer,
      steps: data.steps,
      difficulty: this.calculateDifficulty(request.grade)
    };
  }

  /**
   * 填空题生成（模板+AI）
   */
  private async generateFillBlank(request: GenerateRequest): Promise<GeneratedQuestion> {
    // 使用新的模板填充式填空题生成器
    const fillBlankRequest: FillBlankRequest = {
      knowledgePoint: request.knowledgePoint,
      difficultyLevel: this.calculateDifficulty(request.grade),
      grade: request.grade
    };

    const result = await generateFillBlankFromAI(fillBlankRequest);

    if (!result.success || !result.question) {
      throw new Error(result.error || 'Failed to generate fill-in-the-blank question');
    }

    const q: FillBlankQuestion = result.question;

    return {
      id: q.id,
      type: 'fill_blank' as const,
      question: q.question,
      answer: q.answer,
      explanation: q.explanation,
      template: q.template,
      difficulty: q.difficulty
    };
  }

  /**
   * 批量生成
   */
  async generateBatch(request: GenerateRequest & { count: number }): Promise<GeneratedQuestion[]> {
    const results: GeneratedQuestion[] = [];
    const count = request.count || 1;

    for (let i = 0; i < count; i++) {
      const question = await this.generate(request);
      results.push(question);
    }

    return results;
  }

  /**
   * 构建基础题型提示词
   */
  private buildSimpleQuestionPrompt(request: GenerateRequest): string {
    if (request.type === 'multiple_choice') {
      return `
请为${request.grade}年级学生生成一道关于"${request.knowledgePoint}"的选择题。

要求：
1. 4个选项
2. 只有一个正确答案
3. 简洁明了

请返回JSON格式：
{
  "question": "题目描述",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "正确选项的内容",
  "explanation": "答案解析（可选）"
}
`;
    } else {
      return `
请为${request.grade}年级学生生成一道关于"${request.knowledgePoint}"的判断题。

要求：
1. 陈述清晰
2. 答案明确

请返回JSON格式：
{
  "question": "题目描述",
  "answer": true或false,
  "explanation": "答案解析（可选）"
}
`;
    }
  }

  /**
   * 根据题目类型选择模型
   */
  private selectModelForQuestion(request: GenerateRequest): ModelType {
    // 简单题型用Haiku
    if (request.type === 'multiple_choice' || request.type === 'true_false') {
      return 'claude-haiku-4.5';
    }
    // 复杂题型用Sonnet（填空题需要较强的文本生成能力）
    return 'claude-sonnet-4.6';
  }

  /**
   * 根据年级计算难度
   */
  private calculateDifficulty(grade: number): number {
    // 年级1-9，难度1-5
    return Math.min(5, Math.max(1, Math.ceil(grade / 2)));
  }
}
