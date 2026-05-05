/**
 * Question Validator Tests
 *
 * Tests for mathematical question validation
 */

import { describe, it, expect } from '@jest/globals';
import { validateQuestion, validateQuestions } from './validator';

describe('Question Validator', () => {
  describe('Fill-in-the-Blank Questions', () => {
    it('should validate correct addition', async () => {
      const result = await validateQuestion({
        question: '2 + 3 = ?',
        answer: '5',
        knowledgePoint: '加法'
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.confidence).toBe(1);
    });

    it('should detect incorrect arithmetic answer', async () => {
      const result = await validateQuestion({
        question: '5 + 3 = ?',
        answer: '9',
        knowledgePoint: '加法'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Mathematical error: expected 8, got 9');
    });

    it('should detect division by zero', async () => {
      const result = await validateQuestion({
        question: '10 / 0 = ?',
        answer: 'undefined',
        knowledgePoint: '除法'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Division by zero detected in expression');
    });
  });

  describe('Required Field Validation', () => {
    it('should reject empty question', async () => {
      const result = await validateQuestion({
        question: '',
        answer: '5',
        knowledgePoint: '加法'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Question text is required');
    });

    it('should reject empty answer', async () => {
      const result = await validateQuestion({
        question: '2 + 2 = ?',
        answer: '',
        knowledgePoint: '加法'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Answer is required');
    });
  });

  describe('Question Type Detection', () => {
    it('should detect multiple choice questions', async () => {
      const result = await validateQuestion({
        question: 'What is 2 + 2?\nA. 3\nB. 4\nC. 5',
        answer: 'B',
        knowledgePoint: '加法'
      });

      // Should detect as multiple choice and validate
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect true/false questions', async () => {
      const result = await validateQuestion({
        question: '2 + 2 = 4 is true.',
        answer: 'True',
        knowledgePoint: '加法'
      });

      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Quality Checks', () => {
    it('should warn about trivial questions', async () => {
      const result = await validateQuestion({
        question: '1 + 1 = ?',
        answer: '2',
        knowledgePoint: '加法'
      });

      expect(result.warnings).toContain('Question may be too trivial');
    });

    it('should warn about ambiguous language', async () => {
      const result = await validateQuestion({
        question: '大约 5 + 3 是多少?',
        answer: '8',
        knowledgePoint: '加法'
      });

      expect(result.warnings).toContain('Question contains ambiguous language');
    });
  });

  describe('Confidence Scoring', () => {
    it('should have high confidence for valid questions', async () => {
      const result = await validateQuestion({
        question: '12 + 15 = ?',
        answer: '27',
        knowledgePoint: '加法'
      });

      expect(result.confidence).toBe(1);
    });

    it('should reduce confidence for questions with errors', async () => {
      const result = await validateQuestion({
        question: '5 + 3 = ?',
        answer: '10',
        knowledgePoint: '加法'
      });

      expect(result.confidence).toBeLessThan(1);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple questions in parallel', async () => {
      const questions = [
        {
          question: '2 + 2 = ?',
          answer: '4',
          knowledgePoint: '加法'
        },
        {
          question: '3 + 3 = ?',
          answer: '6',
          knowledgePoint: '加法'
        },
        {
          question: '5 + 5 = ?',
          answer: '11', // Wrong!
          knowledgePoint: '加法'
        }
      ];

      const results = await validateQuestions(questions);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });
  });
});
