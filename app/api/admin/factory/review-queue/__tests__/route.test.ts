import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    template: {
      findMany: jest.fn(),
    },
  },
}));

// Import after mocking
import { GET } from '../route';
import { prisma } from '@/lib/prisma';

describe('/api/admin/factory/review-queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return pending review items', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          name: '勾股定理练习1',
          structure: { type: 'application', steps: [] },
          qualityScore: 85,
          reviewStatus: 'pending',
          validationResult: { mathCorrectness: { passed: true } },
          createdAt: new Date(),
          knowledge: { name: '勾股定理' },
        },
        {
          id: 'tpl-2',
          name: '勾股定理练习2',
          structure: { type: 'application', steps: [] },
          qualityScore: 92,
          reviewStatus: 'pending',
          validationResult: { mathCorrectness: { passed: true } },
          createdAt: new Date(),
          knowledge: { name: '勾股定理' },
        },
      ];

      (prisma.template.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue?limit=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should calculate priority correctly based on quality score', async () => {
      const mockTemplates = [
        {
          id: 'tpl-high',
          name: 'High Quality Template',
          structure: { type: 'application', steps: [] },
          qualityScore: 95,
          reviewStatus: 'pending',
          validationResult: { mathCorrectness: { passed: true } },
          createdAt: new Date(),
          knowledge: { name: 'Test KP' },
        },
        {
          id: 'tpl-low',
          name: 'Low Quality Template',
          structure: { type: 'application', steps: [] },
          qualityScore: 75,
          reviewStatus: 'pending',
          validationResult: { mathCorrectness: { passed: true } },
          createdAt: new Date(),
          knowledge: { name: 'Test KP' },
        },
      ];

      (prisma.template.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items[0].priority).toBe('p3'); // High quality (>=90)
      expect(data.items[1].priority).toBe('p1'); // Low quality (<80)
    });

    it('should set p0 priority when math correctness fails', async () => {
      const mockTemplates = [
        {
          id: 'tpl-math-fail',
          name: 'Math Error Template',
          structure: { type: 'application', steps: [] },
          qualityScore: 80,
          reviewStatus: 'pending',
          validationResult: { mathCorrectness: { passed: false } },
          createdAt: new Date(),
          knowledge: { name: 'Test KP' },
        },
      ];

      (prisma.template.findMany as jest.Mock).mockResolvedValue(mockTemplates);

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items[0].priority).toBe('p0'); // Math correctness failed
      expect(data.items[0].estimatedTime).toBe(300); // Longer time for math errors
    });

    it('should handle empty review queue', async () => {
      (prisma.template.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(0);
      expect(data.total).toBe(0);
    });

    it('should filter by status when provided', async () => {
      (prisma.template.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue?status=approved'
      );

      await GET(request);

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reviewStatus: 'approved',
          }),
        })
      );
    });

    it('should return 500 on database error', async () => {
      (prisma.template.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review-queue'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch review queue');
    });
  });
});
