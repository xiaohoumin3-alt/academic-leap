import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock Prisma
const mockFindMany = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    skeleton: {
      findMany: mockFindMany,
    }
  }
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/admin/factory/skeletons', () => {
  beforeAll(() => {
    mockFindMany.mockResolvedValue([
      { id: 'test_skeleton', stepType: 'COMPUTE_SQRT', name: '测试', status: 'pending' }
    ]);
  });

  afterAll(() => {
    mockFindMany.mockReset();
  });

  test('returns skeleton list', async () => {
    const request = new NextRequest('http://localhost/api/admin/factory/skeletons');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  test('filters by status', async () => {
    mockFindMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/admin/factory/skeletons?status=pending');
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });
  });
});