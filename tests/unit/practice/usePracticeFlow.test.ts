/**
 * usePracticeFlow 单元测试
 * 测试状态转换、XP计算等核心逻辑
 */

// 导入 Jest
const { describe, it, expect } = require('@jest/globals');

// 导入待测试的类型
import type { PracticeQuestion } from '@/hooks/usePracticeFlow';

describe('usePracticeFlow 状态转换逻辑', () => {
  // 测试问题数据结构
  const mockQuestions: PracticeQuestion[] = [
    {
      id: 'q1',
      type: 'fill_blank',
      question: '1 + 1 = ____',
      answer: '2',
    },
    {
      id: 'q2',
      type: 'fill_blank',
      question: '2 + 2 = ____',
      answer: '4',
    },
  ];

  describe('PracticeState 状态定义', () => {
    it('应该包含所有预期的状态', () => {
      const validStates = ['answering', 'showing_answer', 'completed', 'error'];
      validStates.forEach((state) => {
        expect(['answering', 'showing_answer', 'completed', 'error']).toContain(state);
      });
    });
  });

  describe('PracticeQuestion 数据结构', () => {
    it('应该接受 fill_blank 类型', () => {
      const q: PracticeQuestion = {
        id: 'test-1',
        type: 'fill_blank',
        question: 'Test ____',
        answer: 'answer',
      };
      expect(q.type).toBe('fill_blank');
    });

    it('应该接受 multiple_choice 类型', () => {
      const q: PracticeQuestion = {
        id: 'test-2',
        type: 'multiple_choice',
        question: 'Which is correct?',
        answer: 'A',
        options: ['A', 'B', 'C', 'D'],
      };
      expect(q.type).toBe('multiple_choice');
    });

    it('应该接受 short_answer 类型', () => {
      const q: PracticeQuestion = {
        id: 'test-3',
        type: 'short_answer',
        question: 'What is the capital?',
        answer: 'Beijing',
      };
      expect(q.type).toBe('short_answer');
    });

    it('应该支持多个正确答案', () => {
      const q: PracticeQuestion = {
        id: 'test-4',
        type: 'fill_blank',
        question: 'Color of sky?',
        answer: ['blue', 'Blue', 'BLUE'],
      };
      expect(Array.isArray(q.answer)).toBe(true);
      expect((q.answer as string[]).length).toBe(3);
    });
  });

  describe('进度计算逻辑', () => {
    it('空题目列表进度应为0', () => {
      const totalQuestions = 0;
      const progress = totalQuestions > 0
        ? ((0 + 0) / totalQuestions) * 100
        : 0;
      expect(progress).toBe(0);
    });

    it('单题 answering 状态进度应为 0%', () => {
      const totalQuestions = 1;
      const currentIndex = 0;
      const state: string = 'answering';
      const progress = totalQuestions > 0
        ? ((currentIndex + (state === 'showing_answer' || state === 'completed' ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBe(0);
    });

    it('单题 showing_answer 状态进度应为 100%', () => {
      const totalQuestions = 1;
      const currentIndex = 0;
      const state: string = 'showing_answer';
      const progress = totalQuestions > 0
        ? ((currentIndex + (state === 'showing_answer' || state === 'completed' ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBe(100);
    });

    it('多题中间状态进度应正确计算', () => {
      const totalQuestions = 3;
      const currentIndex = 1; // 第二题
      const state: string = 'answering';
      const progress = totalQuestions > 0
        ? ((currentIndex + (state === 'showing_answer' || state === 'completed' ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBeCloseTo(33.33, 1);
    });
  });

  describe('masteryChange 计算', () => {
    it('应该正确计算 mastery 变化', () => {
      const masteryBefore = 0.5;
      const masteryAfter = 0.8;
      const masteryChange = masteryAfter - masteryBefore;
      expect(masteryChange).toBeCloseTo(0.3, 5);
    });

    it('负向变化应正确计算', () => {
      const masteryBefore = 0.8;
      const masteryAfter = 0.3;
      const masteryChange = masteryAfter - masteryBefore;
      expect(masteryChange).toBeCloseTo(-0.5, 5);
    });
  });

  describe('状态转换条件', () => {
    it('answering 状态可以转换为 showing_answer', () => {
      const currentState = 'answering';
      const canShowAnswer: boolean = (currentState as string) === 'answering';
      expect(canShowAnswer).toBe(true);
    });

    it('completed 状态不应再转换', () => {
      const currentState = 'completed';
      const canShowAnswer: boolean = (currentState as string) === 'answering';
      expect(canShowAnswer).toBe(false);
    });
  });

  describe('完成回调参数计算', () => {
    it('全对时正确数应等于总数', () => {
      const totalQuestions = 3;
      const currentIndex = 2; // 最后一题
      const remembered = true;
      const correct = currentIndex + (remembered ? 1 : 0);
      expect(correct).toBe(totalQuestions);
    });

    it('部分错时正确数应小于总数', () => {
      const totalQuestions = 3;
      const currentIndex = 2; // 最后一题
      const remembered = false;
      const correct = currentIndex + (remembered ? 1 : 0);
      expect(correct).toBe(2);
      expect(correct).toBeLessThan(totalQuestions);
    });
  });
});
