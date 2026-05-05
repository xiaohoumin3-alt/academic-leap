import { http, HttpResponse } from 'msw';

/**
 * MSW Mock Handlers for Phase 2 API Tests
 *
 * 为以下API提供mock响应：
 * - GET /api/ai/models - 返回可用模型列表
 * - POST /api/ai/generate - 返回生成的内容
 * - POST /api/questions/generate - 返回生成的题目
 * - POST /api/questions/generate-batch - 返回批量生成的题目
 */

// ============================================================================
// Types
// ============================================================================

interface AIModel {
  model: string;
  provider: string;
  description: string;
  maxTokens: number;
}

interface GenerateRequest {
  prompt: string;
  model?: string;
  taskComplexity?: {
    complexity: 'simple' | 'medium' | 'high';
    requiresReasoning: boolean;
    taskType?: string;
  };
}

interface GenerateResponse {
  success: boolean;
  data: {
    content: string;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
    };
  };
}

interface QuestionGenerateRequest {
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  knowledgePoint: string;
  grade: number;
}

interface QuestionGenerateResponse {
  success: boolean;
  data: {
    id: string;
    type: string;
    question: string;
    options?: string[];
    answer: string | number | boolean;
    explanation?: string;
  };
}

interface QuestionBatchGenerateRequest {
  type: 'multiple_choice' | 'true_false' | 'fill_blank';
  knowledgePoint: string;
  grade: number;
  count: number;
}

interface QuestionBatchGenerateResponse {
  success: boolean;
  data: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    answer: string | number | boolean;
  }>;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_MODELS: AIModel[] = [
  {
    model: 'claude-haiku-4.5',
    provider: 'anthropic',
    description: '快速响应模型，适合简单任务',
    maxTokens: 200000
  },
  {
    model: 'claude-sonnet-4.6',
    provider: 'anthropic',
    description: '平衡性能和速度，适合大多数任务',
    maxTokens: 200000
  },
  {
    model: 'claude-opus-4.5',
    provider: 'anthropic',
    description: '最强推理能力，适合复杂任务',
    maxTokens: 200000
  },
  {
    model: 'gpt-4o',
    provider: 'openai',
    description: 'OpenAI高性能模型',
    maxTokens: 128000
  }
];

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/ai/models - 获取可用模型列表
 */
export const modelsHandler = http.get('http://localhost:3000/api/ai/models', () => {
  return HttpResponse.json({
    success: true,
    data: MOCK_MODELS
  });
});

/**
 * POST /api/ai/generate - 使用AI生成内容
 */
export const generateHandler = http.post<any, GenerateRequest>(
  'http://localhost:3000/api/ai/generate',
  async ({ request }) => {
    const body = await request.json();

    // 根据任务复杂度选择模型
    let selectedModel = 'claude-sonnet-4.6'; // 默认

    if (body.taskComplexity) {
      const { complexity, requiresReasoning } = body.taskComplexity;

      if (complexity === 'simple' && !requiresReasoning) {
        selectedModel = 'claude-haiku-4.5';
      } else if (complexity === 'high' && requiresReasoning) {
        selectedModel = 'claude-opus-4.5';
      }
    } else if (body.model) {
      selectedModel = body.model;
    }

    // 模拟生成内容
    const mockContent = `[MOCK] AI生成的内容: ${body.prompt.substring(0, 50)}...`;

    return HttpResponse.json<GenerateResponse>({
      success: true,
      data: {
        content: mockContent,
        model: selectedModel,
        usage: {
          promptTokens: body.prompt.length,
          completionTokens: mockContent.length
        }
      }
    });
  }
);

/**
 * POST /api/questions/generate - 生成单个题目
 */
export const questionGenerateHandler = http.post<any, QuestionGenerateRequest>(
  'http://localhost:3000/api/questions/generate',
  async ({ request }) => {
    const body = await request.json();
    const { type, knowledgePoint, grade } = body;

    // 根据题目类型生成不同的mock数据
    let questionData: QuestionGenerateResponse['data'];

    switch (type) {
      case 'multiple_choice':
        questionData = {
          id: `q-mc-${Date.now()}`,
          type: 'multiple_choice',
          question: `[MOCK] 关于${knowledgePoint}的选择题（${grade}年级）`,
          options: ['选项A', '选项B', '选项C', '选项D'],
          answer: 'A',
          explanation: '这是mock的解析'
        };
        break;

      case 'true_false':
        questionData = {
          id: `q-tf-${Date.now()}`,
          type: 'true_false',
          question: `[MOCK] 关于${knowledgePoint}的判断题（${grade}年级）`,
          answer: true,
          explanation: '这是mock的解析'
        };
        break;

      case 'fill_blank':
        questionData = {
          id: `q-fb-${Date.now()}`,
          type: 'fill_blank',
          question: `[MOCK] 关于${knowledgePoint}的填空题（${grade}年级）`,
          answer: '答案',
          explanation: '这是mock的解析'
        };
        break;

      default:
        questionData = {
          id: `q-${Date.now()}`,
          type: 'multiple_choice',
          question: `[MOCK] 默认题目`,
          options: ['A', 'B', 'C', 'D'],
          answer: 'A'
        };
    }

    return HttpResponse.json<QuestionGenerateResponse>({
      success: true,
      data: questionData
    });
  }
);

/**
 * POST /api/questions/generate-batch - 批量生成题目
 */
export const questionBatchGenerateHandler = http.post<any, QuestionBatchGenerateRequest>(
  'http://localhost:3000/api/questions/generate-batch',
  async ({ request }) => {
    const body = await request.json();
    const { type, knowledgePoint, grade, count } = body;

    const questions = Array.from({ length: Math.min(count, 10) }, (_, i) => {
      const baseData = {
        id: `q-batch-${Date.now()}-${i}`,
        type,
        question: `[MOCK] ${knowledgePoint} - 第${i + 1}题（${grade}年级）`
      };

      if (type === 'multiple_choice') {
        return {
          ...baseData,
          options: ['A', 'B', 'C', 'D'],
          answer: 'A'
        };
      } else if (type === 'true_false') {
        return {
          ...baseData,
          answer: i % 2 === 0
        };
      } else {
        return {
          ...baseData,
          answer: '答案'
        };
      }
    });

    return HttpResponse.json<QuestionBatchGenerateResponse>({
      success: true,
      data: questions
    });
  }
);

/**
 * 导出所有handlers
 */
export const handlers = [
  modelsHandler,
  generateHandler,
  questionGenerateHandler,
  questionBatchGenerateHandler
];
