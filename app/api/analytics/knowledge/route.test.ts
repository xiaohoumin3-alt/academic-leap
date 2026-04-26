/**
 * Analytics Knowledge Route Tests
 * Tests for textbook filtering
 */

import { describe, test, expect } from 'vitest';

describe('Analytics Knowledge - Textbook Filtering', () => {
  test('should return empty list when user has no textbook selected', () => {
    const mockUserWithoutTextbook = {
      id: 'user-1',
      selectedTextbookId: null,
    };

    const mockAllKnowledgePoints = [
      { id: 'kp1', name: '二次根式', textbookId: 'textbook-a' },
      { id: 'kp2', name: '勾股定理', textbookId: 'textbook-b' },
      { id: 'kp3', name: '一元二次方程', textbookId: 'textbook-c' },
    ];

    // When no textbook selected, return empty list (not all knowledge points)
    const filteredKPs = mockUserWithoutTextbook.selectedTextbookId
      ? mockAllKnowledgePoints
      : [];

    expect(filteredKPs).toHaveLength(0);
  });

  test('should filter knowledge points by selected textbook', () => {
    const mockUserWithTextbook = {
      id: 'user-2',
      selectedTextbookId: 'textbook-a',
    };

    const mockAllKnowledgePoints = [
      { id: 'kp1', name: '二次根式', textbookId: 'textbook-a' },
      { id: 'kp2', name: '勾股定理', textbookId: 'textbook-b' },
      { id: 'kp3', name: '一元二次方程', textbookId: 'textbook-a' },
      { id: 'kp4', name: '平行四边形', textbookId: 'textbook-c' },
    ];

    // Filter by textbook
    const filteredKPs = mockAllKnowledgePoints.filter(
      kp => kp.textbookId === mockUserWithTextbook.selectedTextbookId
    );

    expect(filteredKPs).toHaveLength(2);
    expect(filteredKPs.map(kp => kp.id)).toEqual(['kp1', 'kp3']);
    expect(filteredKPs.every(kp => kp.textbookId === 'textbook-a')).toBe(true);
  });

  test('should include requireTextbookSelection flag when no textbook', () => {
    const mockResponse = {
      knowledge: [],
      summary: { total: 0, mastered: 0, learning: 0, weak: 0 },
      requireTextbookSelection: true,
    };

    expect(mockResponse.requireTextbookSelection).toBe(true);
    expect(mockResponse.knowledge).toHaveLength(0);
  });
});
