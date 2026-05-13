/**
 * Unit tests for lib/qie/errors.ts
 * 统一错误响应类型测试
 */

import {
  ErrorCode,
  ErrorActionMap,
  ErrorMessageMap,
  createErrorResponse,
  createSuccessResponse,
  createRecommendationResponse,
} from '@/lib/qie/errors';

describe('ErrorCode enum', () => {
  it('should have all required error codes', () => {
    expect(ErrorCode.NEEDS_DIAGNOSTIC).toBe('NEEDS_DIAGNOSTIC');
    expect(ErrorCode.NO_LEARNING_PATH).toBe('NO_LEARNING_PATH');
    expect(ErrorCode.ALL_TOPICS_MASTERED).toBe('ALL_TOPICS_MASTERED');
    expect(ErrorCode.TOPIC_NO_QUESTIONS).toBe('TOPIC_NO_QUESTIONS');
    expect(ErrorCode.GENERATION_FAILED).toBe('GENERATION_FAILED');
    expect(ErrorCode.SYSTEM_ERROR).toBe('SYSTEM_ERROR');
    expect(ErrorCode.NO_TOPICS_DEFINED).toBe('NO_TOPICS_DEFINED');
  });
});

describe('ErrorActionMap', () => {
  it('should have action for each error code', () => {
    const codes = Object.values(ErrorCode);
    codes.forEach((code) => {
      expect(ErrorActionMap[code]).toBeDefined();
      expect(typeof ErrorActionMap[code]).toBe('string');
    });
  });

  it('should provide user-friendly actions', () => {
    expect(ErrorActionMap[ErrorCode.NEEDS_DIAGNOSTIC]).toContain('诊断测评');
    expect(ErrorActionMap[ErrorCode.TOPIC_NO_QUESTIONS]).toContain('生成题目');
  });
});

describe('ErrorMessageMap', () => {
  it('should have message for each error code', () => {
    const codes = Object.values(ErrorCode);
    codes.forEach((code) => {
      expect(ErrorMessageMap[code]).toBeDefined();
      expect(typeof ErrorMessageMap[code]).toBe('string');
    });
  });
});

describe('createErrorResponse', () => {
  it('should create error response with correct structure', () => {
    const error = createErrorResponse(ErrorCode.NEEDS_DIAGNOSTIC);

    expect(error).toHaveProperty('code', ErrorCode.NEEDS_DIAGNOSTIC);
    expect(error).toHaveProperty('message');
    expect(error).toHaveProperty('action');
  });

  it('should include message and action from maps', () => {
    const error = createErrorResponse(ErrorCode.ALL_TOPICS_MASTERED);

    expect(error.message).toBe(ErrorMessageMap[ErrorCode.ALL_TOPICS_MASTERED]);
    expect(error.action).toBe(ErrorActionMap[ErrorCode.ALL_TOPICS_MASTERED]);
  });

  it('should include details when provided', () => {
    const details = { topicId: 'kp-001', count: 0 };
    const error = createErrorResponse(ErrorCode.TOPIC_NO_QUESTIONS, details);

    expect(error.details).toEqual(details);
  });

  it('should omit details when not provided', () => {
    const error = createErrorResponse(ErrorCode.SYSTEM_ERROR);

    expect(error.details).toBeUndefined();
  });
});

describe('createSuccessResponse', () => {
  const mockQuestion = {
    id: 'q-123',
    content: { text: 'What is 2+2?' },
    cognitiveLoad: 1,
    reasoningDepth: 1,
    complexity: 0.5,
  };

  it('should create success response with question data', () => {
    const success = createSuccessResponse(
      mockQuestion,
      'kp-001',
      0.7,
      'Targeted at current mastery level'
    );

    expect(success).toHaveProperty('questionId', 'q-123');
    expect(success).toHaveProperty('questionContent');
    expect(success).toHaveProperty('beforeProbability', 0.7);
    expect(success).toHaveProperty('rationale');
    expect(success).toHaveProperty('knowledgePointId', 'kp-001');
  });

  it('should include complexity features when available', () => {
    const success = createSuccessResponse(
      mockQuestion,
      'kp-001',
      0.7,
      'Test rationale'
    );

    expect(success.complexity).toBe(0.5);
    expect(success.cognitiveLoad).toBe(1);
    expect(success.reasoningDepth).toBe(1);
  });

  it('should handle null complexity values', () => {
    const questionWithNulls = {
      id: 'q-456',
      content: {},
      cognitiveLoad: null,
      reasoningDepth: null,
      complexity: null,
    };

    const success = createSuccessResponse(
      questionWithNulls,
      'kp-002',
      0.5,
      'Test'
    );

    expect(success.complexity).toBeUndefined();
    expect(success.cognitiveLoad).toBeUndefined();
    expect(success.reasoningDepth).toBeUndefined();
  });
});

describe('createRecommendationResponse', () => {
  it('should create successful response with data', () => {
    const data = {
      questionId: 'q-123',
      questionContent: {},
      beforeProbability: 0.8,
      rationale: 'Test rationale',
      knowledgePointId: 'kp-001',
    };

    const response = createRecommendationResponse(true, data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
    expect(response.error).toBeUndefined();
  });

  it('should create error response', () => {
    const error = createErrorResponse(ErrorCode.SYSTEM_ERROR);
    const response = createRecommendationResponse(false, undefined, error);

    expect(response.success).toBe(false);
    expect(response.error).toEqual(error);
    expect(response.data).toBeUndefined();
  });

  it('should only include data when present', () => {
    const response = createRecommendationResponse(true);

    expect(response.success).toBe(true);
    expect('data' in response).toBe(false);
  });
});