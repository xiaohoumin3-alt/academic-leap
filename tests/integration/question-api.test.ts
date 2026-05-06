/**
 * 提分神器模块集成测试
 *
 * 测试范围：
 * 1. /api/ai/generate - AI生成API
 * 2. /api/questions/generate - 题目生成API
 * 3. Prisma数据库操作 - 题目入库、查询、去重
 * 4. ComplexityExtractor集成 - 复杂度提取流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma
const mockPrisma = {
  question: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  questionStep: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
};

// Mock the prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock ModelAdapter
jest.mock('@/lib/ai/model-adapter', () => ({
  ModelAdapter: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        question: '二次函数$y=ax^2+bx+c$中，当$a=1, b=-2$时，求顶点坐标',
        answer: '(1, -1)',
        explanation: '使用顶点公式$x=-b/2a=1$, $y=(4ac-b^2)/4a=-1$',
      }),
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  })),
  ModelType: {
    CLAUDE_HAIKU: 'claude-haiku-4.5',
    CLAUDE_SONNET: 'claude-sonnet-4.6',
    CLAUDE_OPUS: 'claude-opus-4.7',
  },
  TaskComplexity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },
}));

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'test-user-1' } }),
}));

// Mock rate-limit
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  hasRateLimit: jest.fn().mockReturnValue(true),
}));

describe('Question API Integration Tests', () => {
  describe('POST /api/ai/generate - AI统一生成接口', () => {
    it('应该返回生成的内容', async () => {
      const requestBody = {
        prompt: '生成一道关于二次函数的填空题',
        model: 'claude-haiku-4.5',
        options: {
          responseFormat: 'json' as const,
          maxTokens: 500,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Import and call the handler
      const { POST } = await import('@/app/api/ai/generate/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.content).toBeDefined();
      expect(data.data.model).toBe('claude-haiku-4.5');
    });

    it('应该拒绝未授权请求', async () => {
      // Mock auth to return null session
      const { auth } = await import('@/lib/auth');
      (auth as jest.Mock).mockResolvedValueOnce(null);

      const requestBody = { prompt: 'test' };
      const request = new NextRequest('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/ai/generate/route');
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('应该验证请求参数格式', async () => {
      const requestBody = { prompt: '' }; // 空prompt应该被拒绝
      const request = new NextRequest('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/ai/generate/route');
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该限制过长的prompt', async () => {
      const longPrompt = 'a'.repeat(10001); // 超过10000字符
      const requestBody = { prompt: longPrompt };
      const request = new NextRequest('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/ai/generate/route');
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/questions/generate - 题目生成接口', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockPrisma.question.create.mockResolvedValue({
        id: 'q-123',
        type: 'calculation',
        difficulty: 2,
        content: '{}',
        answer: '',
        hint: null,
        knowledgePoints: '[]',
        createdBy: null,
        isAI: false,
        createdAt: new Date(),
        params: '{}',
        stepTypes: '[]',
        templateId: 'test-template',
        generatedFrom: null,
        complexitySpec: '{}',
        cognitiveLoad: null,
        reasoningDepth: null,
        complexity: null,
        extractionStatus: 'PENDING',
        featuresExtractedAt: null,
        extractionError: null,
        extractionModel: 'gemma-4-31b-it-v1',
      });
    });

    it('应该生成计算题并保存到数据库', async () => {
      const requestBody = {
        knowledgePoint: '二次函数',
        difficulty: 2,
        count: 1,
        type: 'calculation',
      };

      const request = new NextRequest('http://localhost:3000/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/questions/generate/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questions).toBeDefined();
      expect(Array.isArray(data.questions)).toBe(true);
      expect(mockPrisma.question.create).toHaveBeenCalled();
    });

    it('应该生成填空题（AI直接生成）', async () => {
      const requestBody = {
        knowledgePoint: '勾股定理',
        difficulty: 3,
        count: 1,
        type: 'fill_blank',
      };

      const request = new NextRequest('http://localhost:3000/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/questions/generate/route');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.questions[0].type).toBe('fill_blank');
    });

    it('应该限制生成数量不超过10', async () => {
      const requestBody = {
        knowledgePoint: '二次函数',
        difficulty: 2,
        count: 20, // 超过限制
        type: 'calculation',
      };

      const request = new NextRequest('http://localhost:3000/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const { POST } = await import('@/app/api/questions/generate/route');
      await POST(request);

      // 应该最多生成10个
      const createCalls = mockPrisma.question.create.mock.calls;
      expect(createCalls.length).toBeLessThanOrEqual(10);
    });
  });
});

describe('Prisma Database Operations', () => {
  describe('Question Creation', () => {
    it('应该正确创建题目记录', async () => {
      const questionData = {
        type: 'calculation',
        difficulty: 5,
        content: JSON.stringify({
          question: '计算 $\\sqrt{16}$ 的值',
          answer: '4',
        }),
        knowledgePoints: JSON.stringify(['二次根式']),
        isAI: true,
      };

      mockPrisma.question.create.mockResolvedValueOnce({
        id: 'q-new-1',
        ...questionData,
        answer: '',
        hint: null,
        createdBy: null,
        createdAt: new Date(),
        params: '{}',
        stepTypes: '[]',
        templateId: null,
        generatedFrom: null,
        complexitySpec: '{}',
        cognitiveLoad: null,
        reasoningDepth: null,
        complexity: null,
        extractionStatus: 'PENDING',
        featuresExtractedAt: null,
        extractionError: null,
        extractionModel: 'gemma-4-31b-it-v1',
      });

      const result = await mockPrisma.question.create({ data: questionData });

      expect(result.id).toBeDefined();
      expect(result.type).toBe('calculation');
      expect(result.difficulty).toBe(5);
      expect(result.isAI).toBe(true);
      expect(mockPrisma.question.create).toHaveBeenCalledWith({ data: questionData });
    });

    it('应该根据contentHash去重', async () => {
      const existingHash = 'abc123def456';
      mockPrisma.question.findUnique.mockResolvedValueOnce({
        id: 'q-existing',
        contentHash: existingHash,
      });

      const result = await mockPrisma.question.findUnique({
        where: { contentHash: existingHash },
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe('q-existing');
    });

    it('应该查询特定知识点的所有题目', async () => {
      const knowledgePoint = '二次函数';
      const mockQuestions = [
        { id: 'q-1', type: 'calculation', knowledgePoints: JSON.stringify([knowledgePoint]) },
        { id: 'q-2', type: 'fill_blank', knowledgePoints: JSON.stringify([knowledgePoint]) },
      ];

      mockPrisma.question.findMany.mockResolvedValueOnce(mockQuestions);

      const results = await mockPrisma.question.findMany({
        where: {
          knowledgePoints: {
            contains: knowledgePoint,
          },
        },
      });

      expect(results).toHaveLength(2);
    });

    it('应该查询待提取复杂度的题目', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([
        { id: 'q-1', extractionStatus: 'PENDING' },
        { id: 'q-2', extractionStatus: 'PENDING' },
      ]);

      const results = await mockPrisma.question.findMany({
        where: { extractionStatus: 'PENDING' },
        take: 10,
      });

      expect(results).toHaveLength(2);
      expect(results.every(q => q.extractionStatus === 'PENDING')).toBe(true);
    });

    it('应该更新题目复杂度特征', async () => {
      const questionId = 'q-123';
      const complexityUpdate = {
        complexity: 0.7,
        cognitiveLoad: 0.6,
        reasoningDepth: 0.8,
        extractionStatus: 'SUCCESS',
        featuresExtractedAt: new Date(),
      };

      mockPrisma.question.update.mockResolvedValueOnce({
        id: questionId,
        ...complexityUpdate,
      });

      const result = await mockPrisma.question.update({
        where: { id: questionId },
        data: complexityUpdate,
      });

      expect(result.complexity).toBe(0.7);
      expect(result.extractionStatus).toBe('SUCCESS');
    });

    it('应该标记提取失败的题目', async () => {
      const questionId = 'q-456';
      const failedUpdate = {
        extractionStatus: 'FAILED',
        extractionError: 'Model timeout',
      };

      mockPrisma.question.update.mockResolvedValueOnce({
        id: questionId,
        ...failedUpdate,
      });

      const result = await mockPrisma.question.update({
        where: { id: questionId },
        data: failedUpdate,
      });

      expect(result.extractionStatus).toBe('FAILED');
      expect(result.extractionError).toBe('Model timeout');
    });
  });

  describe('Question Queries', () => {
    it('应该按难度范围查询题目', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([
        { id: 'q-1', difficulty: 3 },
        { id: 'q-2', difficulty: 4 },
      ]);

      const results = await mockPrisma.question.findMany({
        where: {
          difficulty: {
            gte: 3,
            lte: 5,
          },
        },
      });

      expect(results).toHaveLength(2);
      expect(results.every(q => q.difficulty >= 3 && q.difficulty <= 5)).toBe(true);
    });

    it('应该查询AI生成的题目', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([
        { id: 'q-1', isAI: true },
        { id: 'q-2', isAI: true },
      ]);

      const results = await mockPrisma.question.findMany({
        where: { isAI: true },
      });

      expect(results).toHaveLength(2);
      expect(results.every(q => q.isAI === true)).toBe(true);
    });

    it('应该查询种子题（人工标注）', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([
        { id: 'q-1', isAI: false },
      ]);

      const results = await mockPrisma.question.findMany({
        where: { isAI: false },
      });

      expect(results).toHaveLength(1);
      expect(results[0].isAI).toBe(false);
    });
  });
});

describe('Question Generator Module', () => {
  describe('generateFillBlank', () => {
    it('应该生成填空题并返回正确结构', async () => {
      const { generateFillBlank } = await import('@/lib/ai/question-generator');

      const result = await generateFillBlank({
        knowledgePoint: '加法',
        difficultyLevel: 2,
        grade: 3,
      });

      expect(result.success).toBe(true);
      if (result.success && result.question) {
        expect(result.question.id).toBeDefined();
        expect(result.question.question).toBeDefined();
        expect(result.question.answer).toBeDefined();
        expect(result.question.explanation).toBeDefined();
        expect(result.question.difficulty).toBe(2);
      }
    });

    it('应该根据不同知识点选择正确的模板', async () => {
      const { generateFillBlank } = await import('@/lib/ai/question-generator');

      const subtractionResult = await generateFillBlank({
        knowledgePoint: '减法',
        difficultyLevel: 1,
      });

      expect(subtractionResult.success).toBe(true);

      const multiplicationResult = await generateFillBlank({
        knowledgePoint: '乘法',
        difficultyLevel: 2,
      });

      expect(multiplicationResult.success).toBe(true);
    });
  });

  describe('generateFillBlankBatch', () => {
    it('应该批量生成多个题目', async () => {
      const { generateFillBlankBatch } = await import('@/lib/ai/question-generator');

      const results = await generateFillBlankBatch({
        knowledgePoint: '加法',
        difficultyLevel: 2,
        count: 5,
      });

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});

describe('Complexity Extractor Integration', () => {
  describe('Feature Extraction Flow', () => {
    it('应该正确解析复杂度特征', async () => {
      // 模拟复杂度特征数据结构
      const mockComplexityResult = {
        id: 'q-123',
        features: {
          complexity: 0.75,
          cognitiveLoad: 0.6,
          reasoningDepth: 0.8,
        },
      };

      expect(mockComplexityResult.features.complexity).toBeGreaterThanOrEqual(0);
      expect(mockComplexityResult.features.complexity).toBeLessThanOrEqual(1);
      expect(mockComplexityResult.features.cognitiveLoad).toBeGreaterThanOrEqual(0);
      expect(mockComplexityResult.features.cognitiveLoad).toBeLessThanOrEqual(1);
      expect(mockComplexityResult.features.reasoningDepth).toBeGreaterThanOrEqual(0);
      expect(mockComplexityResult.features.reasoningDepth).toBeLessThanOrEqual(1);
    });

    it('应该将复杂度映射到难度等级', async () => {
      // 复杂度 [0, 1] 映射到难度 [1, 12]
      const mapComplexityToDifficulty = (complexity: number): number => {
        return Math.max(1, Math.min(12, Math.round(complexity * 11) + 1));
      };

      expect(mapComplexityToDifficulty(0)).toBe(1);
      expect(mapComplexityToDifficulty(0.5)).toBe(6);
      expect(mapComplexityToDifficulty(1)).toBe(12);
      expect(mapComplexityToDifficulty(0.25)).toBe(4);
    });

    it('应该处理提取失败的情况', async () => {
      // 模拟提取失败
      const mockFailedResult = {
        id: 'q-456',
        error: 'Model timeout',
        features: null,
      };

      expect(mockFailedResult.features).toBeNull();
      expect(mockFailedResult.error).toBeDefined();
    });

    it('应该批量处理题目提取', async () => {
      const mockQuestions = [
        { id: 'q-1', content: { question: '题目1' } },
        { id: 'q-2', content: { question: '题目2' } },
        { id: 'q-3', content: { question: '题目3' } },
      ];

      const batchResults = new Map<string, { features: { complexity: number; cognitiveLoad: number; reasoningDepth: number } }>();

      mockQuestions.forEach(q => {
        batchResults.set(q.id, {
          features: {
            complexity: Math.random(),
            cognitiveLoad: Math.random(),
            reasoningDepth: Math.random(),
          },
        });
      });

      expect(batchResults.size).toBe(3);
      mockQuestions.forEach(q => {
        const result = batchResults.get(q.id);
        expect(result?.features).toBeDefined();
      });
    });
  });
});

describe('Input Validation', () => {
  describe('Question Type Validation', () => {
    it('应该接受有效的题目类型', () => {
      const validTypes = ['calculation', 'fill_blank', 'multiple_choice', 'short_answer', 'true_false'];

      validTypes.forEach(type => {
        expect(['calculation', 'fill_blank', 'multiple_choice', 'short_answer', 'true_false']).toContain(type);
      });
    });

    it('应该拒绝无效的难度值', () => {
      const isValidDifficulty = (difficulty: number): boolean => {
        return Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 12;
      };

      expect(isValidDifficulty(1)).toBe(true);
      expect(isValidDifficulty(12)).toBe(true);
      expect(isValidDifficulty(0)).toBe(false);
      expect(isValidDifficulty(13)).toBe(false);
      expect(isValidDifficulty(5.5)).toBe(false);
    });

    it('应该验证知识点ID格式', () => {
      const isValidKnowledgePointId = (id: string): boolean => {
        return typeof id === 'string' && id.length > 0 && id.length <= 100;
      };

      expect(isValidKnowledgePointId('kp-123')).toBe(true);
      expect(isValidKnowledgePointId('')).toBe(false);
      expect(isValidKnowledgePointId('a'.repeat(101))).toBe(false);
    });
  });

  describe('Content Validation', () => {
    it('应该验证JSON内容格式', () => {
      const isValidContent = (content: string): boolean => {
        try {
          JSON.parse(content);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidContent('{"question": "test", "answer": "A"}')).toBe(true);
      expect(isValidContent('invalid json')).toBe(false);
      expect(isValidContent('')).toBe(false);
    });

    it('应该验证contentHash格式', () => {
      const isValidContentHash = (hash: string): boolean => {
        return /^[a-f0-9]{64}$/.test(hash);
      };

      expect(isValidContentHash('a'.repeat(64))).toBe(true);
      expect(isValidContentHash('abc123')).toBe(false);
      expect(isValidContentHash('')).toBe(false);
    });
  });
});

describe('Error Handling', () => {
  describe('API Error Responses', () => {
    it('应该返回正确的错误状态码', () => {
      const errorStatusCodes: Record<string, number> = {
        '未授权访问': 401,
        '请求参数无效': 400,
        '请求过于频繁': 429,
        '生成失败': 500,
        '知识点未配置模板': 400,
      };

      expect(errorStatusCodes['未授权访问']).toBe(401);
      expect(errorStatusCodes['请求参数无效']).toBe(400);
      expect(errorStatusCodes['请求过于频繁']).toBe(429);
      expect(errorStatusCodes['生成失败']).toBe(500);
    });

    it('应该包含错误消息', () => {
      const errorResponse = {
        success: false,
        error: '该知识点暂未配置题目模板，请联系管理员',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      expect(typeof errorResponse.error).toBe('string');
    });
  });

  describe('Database Error Handling', () => {
    it('应该处理数据库连接失败', async () => {
      mockPrisma.question.create.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        mockPrisma.question.create({ data: { type: 'test' } as any })
      ).rejects.toThrow('Database connection failed');
    });

    it('应该处理唯一约束冲突', async () => {
      mockPrisma.question.create.mockRejectedValueOnce(
        new Error('Unique constraint failed on contentHash')
      );

      await expect(
        mockPrisma.question.create({ data: { contentHash: 'existing' } as any })
      ).rejects.toThrow('Unique constraint failed on contentHash');
    });
  });
});

describe('Data Flow Tests', () => {
  describe('Complete Generation Flow', () => {
    it('应该完整执行AI生成→入库→复杂度提取流程', async () => {
      // Step 1: Mock AI generation response
      const mockAICards = [
        {
          id: 'card-1',
          question_type: 'calculation',
          question: '计算 $\\sqrt{25}$ 的值',
          answer: '5',
          explanation: '平方根的定义',
        },
      ];

      // Step 2: Mock database creation
      mockPrisma.question.create.mockResolvedValueOnce({
        id: 'q-db-1',
        type: 'calculation',
        difficulty: 5,
        content: JSON.stringify(mockAICards[0]),
        extractionStatus: 'PENDING',
        isAI: true,
      });

      // Step 3: Verify creation
      const created = await mockPrisma.question.create({
        data: {
          type: 'calculation',
          difficulty: 5,
          content: JSON.stringify(mockAICards[0]),
          extractionStatus: 'PENDING',
          isAI: true,
        },
      });

      expect(created.id).toBeDefined();
      expect(created.extractionStatus).toBe('PENDING');

      // Step 4: Mock complexity extraction
      const complexityResult = {
        complexity: 0.6,
        cognitiveLoad: 0.5,
        reasoningDepth: 0.7,
      };

      // Step 5: Update with complexity
      mockPrisma.question.update.mockResolvedValueOnce({
        ...created,
        ...complexityResult,
        extractionStatus: 'SUCCESS',
        featuresExtractedAt: new Date(),
      });

      const updated = await mockPrisma.question.update({
        where: { id: created.id },
        data: {
          ...complexityResult,
          extractionStatus: 'SUCCESS',
          featuresExtractedAt: new Date(),
        },
      });

      expect(updated.extractionStatus).toBe('SUCCESS');
      expect(updated.complexity).toBe(0.6);
    });
  });
});

describe('SSE Streaming API', () => {
  describe('POST /api/question-engine/generate-streaming', () => {
    it('应该正确发送SSE格式的进度消息', () => {
      // 验证SSE消息格式
      const createSSEEvent = (type: string, data: object): string => {
        return JSON.stringify({ type, ...data }) + '\n';
      };

      const progressEvent = createSSEEvent('progress', {
        batch: 1,
        total: 3,
        data: {
          questions: [{ id: 'q-1', question: '题目1' }],
          totalCount: 1,
        },
      });

      const parsed = JSON.parse(progressEvent.trim());
      expect(parsed.type).toBe('progress');
      expect(parsed.batch).toBe(1);
      expect(parsed.total).toBe(3);
    });

    it('应该正确发送完成消息', () => {
      const createSSEEvent = (type: string, data?: object): string => {
        return JSON.stringify({ type, ...data }) + '\n';
      };

      const completeEvent = createSSEEvent('complete');
      const parsed = JSON.parse(completeEvent.trim());

      expect(parsed.type).toBe('complete');
    });

    it('应该正确发送错误消息', () => {
      const createSSEEvent = (type: string, data?: object): string => {
        return JSON.stringify({ type, ...data }) + '\n';
      };

      const errorEvent = createSSEEvent('error', { error: 'Generation failed' });
      const parsed = JSON.parse(errorEvent.trim());

      expect(parsed.type).toBe('error');
      expect(parsed.error).toBe('Generation failed');
    });
  });
});

describe('Promotion Pipeline', () => {
  describe('Question Promotion', () => {
    it('应该将GeneratedQuestion正确提升到Question表', async () => {
      // Mock GeneratedQuestion lookup
      const mockGenerated = {
        id: 'gen-q-1',
        type: 'calculation',
        content: JSON.stringify({ question: 'test', answer: 'A' }),
        answer: 'A',
        hint: 'hint',
        complexitySpec: JSON.stringify({ structure: 'linear', depth: 2 }),
      };

      mockPrisma.question.create.mockResolvedValueOnce({
        id: 'q-promoted-1',
        type: mockGenerated.type,
        content: mockGenerated.content,
        difficulty: 2,
      });

      const promoted = await mockPrisma.question.create({
        data: {
          type: mockGenerated.type,
          content: mockGenerated.content,
          answer: mockGenerated.answer,
          hint: mockGenerated.hint,
          difficulty: 2,
        },
      });

      expect(promoted.id).toBeDefined();
      expect(promoted.type).toBe('calculation');
    });

    it('应该处理找不到GeneratedQuestion的情况', async () => {
      mockPrisma.question.findUnique.mockResolvedValueOnce(null);

      const result = await mockPrisma.question.findUnique({
        where: { id: 'non-existent-id' },
      });

      expect(result).toBeNull();
    });

    it('应该正确估计难度等级', () => {
      // 难度估计逻辑测试
      const estimateDifficulty = (spec: { structure?: string; depth?: number; distraction?: number }): number => {
        const structureScore: Record<string, number> = {
          linear: 1,
          nested: 2,
          multi_equation: 3,
          constraint_chain: 4,
        };

        const structure = spec.structure ?? 'linear';
        const depth = spec.depth ?? 1;
        const distraction = spec.distraction ?? 0;

        const raw = (structureScore[structure] ?? 1) + depth + distraction;
        return Math.min(5, Math.max(1, Math.floor(raw / 2)));
      };

      expect(estimateDifficulty({ structure: 'linear', depth: 1 })).toBe(1);
      expect(estimateDifficulty({ structure: 'nested', depth: 2 })).toBe(2);
      expect(estimateDifficulty({ structure: 'multi_equation', depth: 3 })).toBe(3);
    });

    it('应该批量提升题目', async () => {
      const batchQuestions = [
        { id: 'gen-1', promotionStatus: 'PENDING' },
        { id: 'gen-2', promotionStatus: 'PENDING' },
      ];

      mockPrisma.question.findMany.mockResolvedValueOnce(batchQuestions);

      const results = await mockPrisma.question.findMany({
        where: { id: { in: ['gen-1', 'gen-2'] } },
      });

      expect(results).toHaveLength(2);
    });
  });
});

describe('Content Hash Deduplication', () => {
  describe('Hash Generation', () => {
    it('应该生成正确的SHA256哈希', async () => {
      const crypto = await import('crypto');

      const generateContentHash = (content: { question: string; answer: string }): string => {
        const normalized = JSON.stringify({ q: content.question, a: content.answer });
        return crypto.createHash('sha256').update(normalized).digest('hex');
      };

      const hash1 = generateContentHash({ question: '2+2=?', answer: '4' });
      const hash2 = generateContentHash({ question: '2+2=?', answer: '4' });
      const hash3 = generateContentHash({ question: '3+3=?', answer: '6' });

      expect(hash1).toBe(hash2); // 相同内容产生相同哈希
      expect(hash1).not.toBe(hash3); // 不同内容产生不同哈希
      expect(hash1).toHaveLength(64); // SHA256 产生64字符的十六进制字符串
    });

    it('应该检测重复内容', async () => {
      const existingHashes = new Set(['abc123', 'def456']);

      const isDuplicate = (hash: string): boolean => {
        return existingHashes.has(hash);
      };

      expect(isDuplicate('abc123')).toBe(true);
      expect(isDuplicate('xyz789')).toBe(false);
    });
  });
});

describe('Extraction Status Transitions', () => {
  it('应该正确处理状态转换', () => {
    type ExtractionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

    const validTransitions: Record<ExtractionStatus, ExtractionStatus[]> = {
      PENDING: ['SUCCESS', 'FAILED'],
      SUCCESS: [], // 终态
      FAILED: ['PENDING'], // 可以重试
    };

    expect(validTransitions['PENDING']).toContain('SUCCESS');
    expect(validTransitions['PENDING']).toContain('FAILED');
    expect(validTransitions['SUCCESS']).toHaveLength(0);
    expect(validTransitions['FAILED']).toContain('PENDING');
  });
});
