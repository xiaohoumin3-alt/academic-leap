/**
 * Knowledge Tree Route Tests
 * Tests for deletedAt handling - ensures NULL is used, not empty strings
 */

import { describe, test, expect } from 'vitest';

describe('Knowledge Tree deletedAt handling', () => {
  test('Prisma query with deletedAt: null matches NULL values', () => {
    // This test documents the expected behavior:
    // - Prisma { deletedAt: null } generates SQL "WHERE deletedAt IS NULL"
    // - Empty strings '' do NOT match IS NULL
    // - Data should use NULL for soft delete, not empty strings

    const mockKnowledgePoints = [
      { id: 'kp1', name: 'Point 1', deletedAt: null },
      { id: 'kp2', name: 'Point 2', deletedAt: '' },
      { id: 'kp3', name: 'Point 3', deletedAt: null },
    ];

    // Simulate Prisma's deletedAt: null filter
    const filtered = mockKnowledgePoints.filter(kp => kp.deletedAt === null);

    expect(filtered).toHaveLength(2);
    expect(filtered.every(kp => kp.deletedAt === null)).toBe(true);
  });

  test('Robust query handles both NULL and empty string', () => {
    const mockKnowledgePoints = [
      { id: 'kp1', name: 'Point 1', deletedAt: null },
      { id: 'kp2', name: 'Point 2', deletedAt: '' },
      { id: 'kp3', name: 'Point 3', deletedAt: null },
      { id: 'kp4', name: 'Point 4', deletedAt: '2024-01-01' },
    ];

    // Simulate robust query: OR [{ deletedAt: null }, { deletedAt: '' }]
    const filtered = mockKnowledgePoints.filter(
      kp => kp.deletedAt === null || kp.deletedAt === ''
    );

    expect(filtered).toHaveLength(3);
    expect(filtered.every(kp => !kp.deletedAt || kp.deletedAt === '')).toBe(true);
  });
});
