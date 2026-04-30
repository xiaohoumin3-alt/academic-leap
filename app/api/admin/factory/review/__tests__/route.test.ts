import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock the dependencies before importing the route
jest.mock('@/lib/prisma', () => ({
  prisma: {
    template: {
      update: jest.fn(),
    },
    templateReview: {
      create: jest.fn(),
    },
  },
}));

// Import after mocking
import { POST } from '../route';
import { prisma } from '@/lib/prisma';

describe('/api/admin/factory/review/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should approve a template successfully', async () => {
      const mockUpdatedTemplate = {
        id: 'tpl-1',
        name: 'Test Template',
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        reviewNotes: 'Looks good',
      };

      (prisma.template.update as jest.Mock).mockResolvedValue(mockUpdatedTemplate);
      (prisma.templateReview.create as jest.Mock).mockResolvedValue({
        id: 'review-1',
        templateId: 'tpl-1',
        reviewerId: 'admin',
        decision: 'approve',
        notes: 'Looks good',
      });

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-1',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'approve',
            notes: 'Looks good',
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.templateId).toBe('tpl-1');
      expect(data.decision).toBe('approve');
    });

    it('should reject a template with notes', async () => {
      const mockUpdatedTemplate = {
        id: 'tpl-2',
        name: 'Problematic Template',
        reviewStatus: 'rejected',
        reviewedAt: new Date(),
        reviewNotes: 'Math error in step 2',
      };

      (prisma.template.update as jest.Mock).mockResolvedValue(mockUpdatedTemplate);
      (prisma.templateReview.create as jest.Mock).mockResolvedValue({
        id: 'review-2',
        templateId: 'tpl-2',
        reviewerId: 'admin',
        decision: 'reject',
        notes: 'Math error in step 2',
      });

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-2',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'reject',
            notes: 'Math error in step 2',
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-2' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.decision).toBe('reject');
    });

    it('should accept modify decision with modifications', async () => {
      const mockUpdatedTemplate = {
        id: 'tpl-3',
        name: 'Template to Modify',
        reviewStatus: 'rejected',
        reviewedAt: new Date(),
        reviewNotes: 'Please revise',
      };

      const modifications = {
        difficulty: 2,
        hint: 'Added hint',
        steps: [{ description: 'Fixed step 1' }],
      };

      (prisma.template.update as jest.Mock).mockResolvedValue(mockUpdatedTemplate);
      (prisma.templateReview.create as jest.Mock).mockResolvedValue({
        id: 'review-3',
        templateId: 'tpl-3',
        reviewerId: 'admin',
        decision: 'modify',
        notes: 'Please revise',
        modifications,
      });

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-3',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'modify',
            notes: 'Please revise',
            modifications,
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-3' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.decision).toBe('modify');
    });

    it('should return 400 for invalid decision', async () => {
      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-1',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'invalid',
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 400 for missing decision', async () => {
      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-1',
        {
          method: 'POST',
          body: JSON.stringify({
            notes: 'No decision provided',
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-1' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request');
    });

    it('should return 500 on database error', async () => {
      (prisma.template.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-1',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'approve',
          }),
        }
      );

      const response = await POST(request, { params: { id: 'tpl-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process review decision');
    });

    it('should create review record with all fields', async () => {
      const mockUpdatedTemplate = {
        id: 'tpl-4',
        name: 'Full Review Template',
        reviewStatus: 'approved',
        reviewedAt: new Date(),
        reviewNotes: 'Approved with modifications',
      };

      (prisma.template.update as jest.Mock).mockResolvedValue(mockUpdatedTemplate);
      (prisma.templateReview.create as jest.Mock).mockResolvedValue({
        id: 'review-4',
        templateId: 'tpl-4',
        reviewerId: 'admin',
        decision: 'modify',
        notes: 'Approved with modifications',
        modifications: { difficulty: 3 },
        duration: 0,
      });

      const request = new NextRequest(
        'https://example.com/api/admin/factory/review/tpl-4',
        {
          method: 'POST',
          body: JSON.stringify({
            decision: 'modify',
            notes: 'Approved with modifications',
            modifications: { difficulty: 3 },
          }),
        }
      );

      await POST(request, { params: { id: 'tpl-4' } });

      expect(prisma.templateReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'tpl-4',
          reviewerId: 'admin',
          decision: 'modify',
          notes: 'Approved with modifications',
          modifications: { difficulty: 3 },
          duration: 0,
        }),
      });
    });
  });
});
