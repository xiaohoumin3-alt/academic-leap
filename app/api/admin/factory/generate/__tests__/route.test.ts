import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    knowledgePoint: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/template-factory/generator', () => ({
  TemplateGenerator: jest.fn().mockImplementation(function() {
    return {
      generate: jest.fn(),
    };
  }),
}));

jest.mock('@/lib/template-factory/validator', () => ({
  TemplateValidator: jest.fn().mockImplementation(function() {
    return {
      validateBatch: jest.fn(),
    };
  }),
}));

jest.mock('@/lib/template-factory/quality-scorer', () => ({
  QualityScorer: jest.fn().mockImplementation(function() {
    return {
      calculate: jest.fn(),
      shouldAutoApprove: jest.fn(),
    };
  }),
}));

jest.mock('@/lib/template-factory/utils/llm-client', () => ({
  LLMClient: jest.fn(),
}));

// Import after mocking
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { TemplateGenerator } from '@/lib/template-factory/generator';
import { TemplateValidator } from '@/lib/template-factory/validator';
import { QualityScorer } from '@/lib/template-factory/quality-scorer';

describe('/api/admin/factory/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should return 400 for missing knowledgePointId', async () => {
      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for invalid knowledgePointId type', async () => {
      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({
          knowledgePointId: 123,
          count: 3,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for count out of range', async () => {
      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({
          knowledgePointId: 'kp-1',
          count: 15, // max is 10
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 404 for non-existent knowledge point', async () => {
      (prisma.knowledgePoint.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({
          knowledgePointId: 'non-existent',
          count: 3,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Knowledge point not found');
    });

    it('should generate templates successfully', async () => {
      const mockKnowledgePoint = {
        id: 'kp-1',
        name: '勾股定理',
        chapter: {
          textbook: {
            name: '初中数学',
            grade: 8,
          },
        },
      };

      (prisma.knowledgePoint.findUnique as jest.Mock).mockResolvedValue(mockKnowledgePoint);

      // Mock the generator instance
      const mockGenerate = jest.fn().mockResolvedValue({
        generationId: 'gen-123',
        templates: [{
          name: 'Template 1',
          template: '{a}^2 + {b}^2 = {c}^2',
          answer: '{c}',
          params: {},
          constraint: 'a^2 + b^2 = c^2',
          steps: [],
          hint: 'Hint',
          difficulty: 2,
          cognitiveLoad: 0.5,
          reasoningDepth: 0.5,
          learningObjective: 'Learn Pythagorean theorem',
          concepts: ['勾股定理'],
        }],
        summary: { total: 1, successful: 1, failed: 0 },
      });
      (TemplateGenerator as jest.Mock).mockImplementation(() => ({
        generate: mockGenerate,
      }));

      // Mock the validator instance
      const mockValidateBatch = jest.fn().mockResolvedValue([{
        templateId: 'Template 1',
        mathCorrectness: { passed: true, issues: [], confidence: 0.9 },
        pedagogyQuality: { passed: true, issues: [], score: 85 },
        overallScore: 90,
        recommendation: 'approve',
      }]);
      (TemplateValidator as jest.Mock).mockImplementation(() => ({
        validateBatch: mockValidateBatch,
      }));

      // Mock the scorer instance
      const mockCalculate = jest.fn().mockReturnValue({
        mathCorrectness: 100,
        pedagogyQuality: 85,
        difficultyAccuracy: 90,
        completeness: 100,
        innovation: 92,
        overall: 92,
      });
      const mockShouldAutoApprove = jest.fn().mockReturnValue({
        approve: true,
        reason: 'High quality',
      });
      (QualityScorer as jest.Mock).mockImplementation(() => ({
        calculate: mockCalculate,
        shouldAutoApprove: mockShouldAutoApprove,
      }));

      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({
          knowledgePointId: 'kp-1',
          count: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.generationId).toBeDefined();
      expect(data.status).toBe('completed');
      expect(data.templates).toHaveLength(1);
      expect(data.summary.total).toBe(1);
      expect(data.summary.approved).toBe(1);
    });

    it('should handle generation errors gracefully', async () => {
      const mockKnowledgePoint = {
        id: 'kp-1',
        name: 'Test KP',
        chapter: null,
      };

      (prisma.knowledgePoint.findUnique as jest.Mock).mockResolvedValue(mockKnowledgePoint);

      // Mock the generator to throw error
      const mockGenerate = jest.fn().mockRejectedValue(new Error('Generation failed'));
      (TemplateGenerator as jest.Mock).mockImplementation(() => ({
        generate: mockGenerate,
      }));

      const request = new NextRequest('https://example.com/api/admin/factory/generate', {
        method: 'POST',
        body: JSON.stringify({
          knowledgePointId: 'kp-1',
          count: 1,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Generation failed');
    });
  });
});
