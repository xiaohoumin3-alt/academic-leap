import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock GapDetector
const mockDetectGaps = jest.fn<() => Promise<unknown[]>>();
jest.mock('@/lib/template-factory/gap-detector', () => ({
  GapDetector: jest.fn().mockImplementation(() => ({
    detectGaps: mockDetectGaps,
  })),
}));

// Mock prisma
const mockCount = jest.fn<() => Promise<number>>();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    knowledgePoint: {
      count: mockCount,
    },
  },
}));

import { GET } from '../route';

describe('/api/admin/factory/coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockResolvedValue(10);
    mockDetectGaps.mockResolvedValue([
      {
        knowledgePointId: 'kp-1',
        knowledgePointName: 'Linear Equations',
        currentTemplateCount: 1,
        targetTemplateCount: 3,
        gap: 2,
        priority: 'high' as const,
        estimatedDifficulty: 'medium' as const,
      },
      {
        knowledgePointId: 'kp-2',
        knowledgePointName: 'Quadratic Equations',
        currentTemplateCount: 2,
        targetTemplateCount: 3,
        gap: 1,
        priority: 'medium' as const,
        estimatedDifficulty: 'hard' as const,
      },
    ]);
  });

  test('should return coverage report', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(10);
    expect(data.coverageRate).toBeDefined();
    expect(data.coverageRate).toBeGreaterThanOrEqual(0);
    expect(data.coverageRate).toBeLessThanOrEqual(1);
    expect(Array.isArray(data.byKnowledgePoint)).toBe(true);
  });

  test('should calculate gap statistics', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(data.gaps).toBeDefined();
    expect(data.gaps).toHaveProperty('high');
    expect(data.gaps).toHaveProperty('medium');
    expect(data.gaps).toHaveProperty('low');
    expect(data.gaps.high).toBe(1);
    expect(data.gaps.medium).toBe(1);
    expect(data.gaps.low).toBe(0);
  });

  test('should include knowledge point details', async () => {
    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(data.byKnowledgePoint).toHaveLength(2);
    expect(data.byKnowledgePoint[0]).toMatchObject({
      id: 'kp-1',
      name: 'Linear Equations',
      current: 1,
      target: 3,
      gap: 2,
      priority: 'high',
    });
  });

  test('should handle empty gaps', async () => {
    mockDetectGaps.mockResolvedValue([]);
    mockCount.mockResolvedValue(5);

    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.covered).toBe(5);
    expect(data.coverageRate).toBe(1);
    expect(data.byKnowledgePoint).toHaveLength(0);
    expect(data.gaps).toEqual({ high: 0, medium: 0, low: 0 });
  });

  test('should handle errors gracefully', async () => {
    mockDetectGaps.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('https://example.com/api/admin/factory/coverage');

    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to generate coverage report');
  });
});
