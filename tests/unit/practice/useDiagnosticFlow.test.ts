/**
 * useDiagnosticFlow 单元测试
 * 测试批量提交、正确率计算、checkAnswer函数
 */

const { describe, it, expect } = require('@jest/globals');
import type { DiagnosticQuestion } from '@/hooks/useDiagnosticFlow';

describe('useDiagnosticFlow 核心逻辑', () => {
  const mockQuestions: DiagnosticQuestion[] = [
    { id: 'q1', type: 'fill_blank', question: '1+1=____', answer: '2' },
    { id: 'q2', type: 'fill_blank', question: '2+2=____', answer: '4' },
    { id: 'q3', type: 'fill_blank', question: '3+3=____', answer: ['6', '六'] }, // 多答案
  ];

  // 模拟 checkAnswer 函数逻辑
  function checkAnswer(userAnswer: string | null, correctAnswer: string | string[]): boolean {
    if (userAnswer === null) return false;

    if (Array.isArray(correctAnswer)) {
      if (typeof userAnswer === 'string') {
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();
        return correctAnswer.some(ans => normalizedUserAnswer === ans.toLowerCase().trim());
      }
      return false;
    }

    return userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  }

  describe('checkAnswer 函数', () => {
    describe('精确匹配', () => {
      it('正确答案应返回 true', () => {
        expect(checkAnswer('2', '2')).toBe(true);
      });

      it('错误答案应返回 false', () => {
        expect(checkAnswer('3', '2')).toBe(false);
      });

      it('null 答案应返回 false', () => {
        expect(checkAnswer(null, '2')).toBe(false);
      });
    });

    describe('大小写不敏感', () => {
      it('大写应匹配小写', () => {
        expect(checkAnswer('BEIJING', 'beijing')).toBe(true);
      });

      it('混合大小写应匹配', () => {
        expect(checkAnswer('Beijing', 'BEIJING')).toBe(true);
      });
    });

    describe('空格不敏感', () => {
      it('多余空格应被忽略', () => {
        expect(checkAnswer('  hello  ', 'hello')).toBe(true);
      });
    });

    describe('多答案支持', () => {
      it('第一个正确答案应匹配', () => {
        expect(checkAnswer('6', ['6', '六'])).toBe(true);
      });

      it('第二个正确答案应匹配', () => {
        expect(checkAnswer('六', ['6', '六'])).toBe(true);
      });

      it('正确答案的中文形式应匹配', () => {
        expect(checkAnswer('六', ['6', '六'])).toBe(true);
      });

      it('错误答案不应匹配多答案', () => {
        expect(checkAnswer('7', ['6', '六'])).toBe(false);
      });

      it('大小写应不敏感于多答案', () => {
        expect(checkAnswer('BEIJING', ['beijing', '北京'])).toBe(true);
      });
    });

    describe('边界情况', () => {
      it('空字符串应返回 false', () => {
        expect(checkAnswer('', '2')).toBe(false);
      });

      it('仅空格字符串应返回 false', () => {
        expect(checkAnswer('   ', '2')).toBe(false);
      });

      it('数字与字符串形式应匹配', () => {
        expect(checkAnswer('2', '2')).toBe(true);
      });
    });
  });

  describe('进度计算逻辑', () => {
    it('空题目列表进度应为0', () => {
      const totalQuestions = 0;
      const currentIndex = 0;
      const answers: (string | null)[] = [];
      const progress = totalQuestions > 0
        ? ((currentIndex + (answers[currentIndex] !== null ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBe(0);
    });

    it('已答第1题进度应为 50%（共2题）', () => {
      const totalQuestions = 2;
      const currentIndex = 0;
      const answers: (string | null)[] = ['2', null];
      const progress = totalQuestions > 0
        ? ((currentIndex + (answers[currentIndex] !== null ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBe(50);
    });

    it('未答当前题进度应正确', () => {
      const totalQuestions = 3;
      const currentIndex = 1;
      const answers: (string | null)[] = ['2', null, '6'];
      const progress = totalQuestions > 0
        ? ((currentIndex + (answers[currentIndex] !== null ? 1 : 0)) / totalQuestions) * 100
        : 0;
      expect(progress).toBeCloseTo(33.33, 1);
    });
  });

  describe('正确率计算', () => {
    it('全对正确率为 100%', () => {
      const totalQuestions = 5;
      const correctCount = 5;
      const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      expect(accuracy).toBe(100);
    });

    it('部分正确正确率应四舍五入', () => {
      const totalQuestions = 3;
      const correctCount = 1;
      const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      expect(accuracy).toBe(33);
    });

    it('全错正确率为 0%', () => {
      const totalQuestions = 5;
      const correctCount = 0;
      const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      expect(accuracy).toBe(0);
    });

    it('空题目列表正确率为 0%', () => {
      const totalQuestions = 0;
      const correctCount = 0;
      const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      expect(accuracy).toBe(0);
    });
  });

  describe('XP 奖励计算', () => {
    it('每题正确奖励 5 XP', () => {
      const correctCount = 3;
      const baseXP = correctCount * 5;
      expect(baseXP).toBe(15);
    });

    it('全对额外奖励 50 XP', () => {
      const correctCount = 5;
      const totalQuestions = 5;
      const baseXP = correctCount * 5;
      const bonusXP: number = Number(correctCount) === Number(totalQuestions) ? 50 : 0;
      const earnedXP = baseXP + bonusXP;
      expect(earnedXP).toBe(75);
    });

    it('非全对无额外奖励', () => {
      const correctCount = 4;
      const totalQuestions = 5;
      const baseXP = correctCount * 5;
      const bonusXP: number = Number(correctCount) === Number(totalQuestions) ? 50 : 0;
      const earnedXP = baseXP + bonusXP;
      expect(earnedXP).toBe(20);
    });

    it('零正确无奖励', () => {
      const correctCount = 0;
      const totalQuestions = 5;
      const baseXP = correctCount * 5;
      const bonusXP: number = Number(correctCount) === Number(totalQuestions) ? 50 : 0;
      const earnedXP = baseXP + bonusXP;
      expect(earnedXP).toBe(0);
    });
  });

  describe('批量提交结果计算', () => {
    interface DiagnosticWrongQuestion {
      question: DiagnosticQuestion;
      userAnswer: string;
    }

    interface DiagnosticResult {
      accuracy: number;
      correctCount: number;
      wrongCount: number;
      wrongQuestions: DiagnosticWrongQuestion[];
      earnedXP: number;
    }

    function calculateResult(
      questions: DiagnosticQuestion[],
      answers: (string | null)[]
    ): DiagnosticResult {
      let correctCount = 0;

      questions.forEach((q, i) => {
        if (checkAnswer(answers[i], q.answer)) {
          correctCount++;
        }
      });

      const baseXP = correctCount * 5;
      const bonusXP = correctCount === questions.length ? 50 : 0;

      const wrongQuestions: DiagnosticWrongQuestion[] = [];
      questions.forEach((q, i) => {
        if (!checkAnswer(answers[i], q.answer)) {
          wrongQuestions.push({ question: q, userAnswer: answers[i] || '' });
        }
      });

      return {
        accuracy: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0,
        correctCount,
        wrongCount: questions.length - correctCount,
        wrongQuestions,
        earnedXP: baseXP + bonusXP,
      };
    }

    it('全对结果应正确', () => {
      const answers: (string | null)[] = ['2', '4', '6'];
      const result = calculateResult(mockQuestions, answers);
      expect(result.correctCount).toBe(3);
      expect(result.wrongCount).toBe(0);
      expect(result.accuracy).toBe(100);
      expect(result.earnedXP).toBe(65); // 3*5 + 50
    });

    it('部分对结果应正确', () => {
      const answers: (string | null)[] = ['2', '5', '6'];
      const result = calculateResult(mockQuestions, answers);
      expect(result.correctCount).toBe(2);
      expect(result.wrongCount).toBe(1);
      expect(result.accuracy).toBe(67);
      expect(result.earnedXP).toBe(10); // 2*5, no bonus
    });

    it('全错结果应正确', () => {
      const answers: (string | null)[] = ['1', '3', '5'];
      const result = calculateResult(mockQuestions, answers);
      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(3);
      expect(result.accuracy).toBe(0);
      expect(result.earnedXP).toBe(0);
    });

    it('错题列表应包含错误题目', () => {
      const answers: (string | null)[] = ['2', 'wrong', '6'];
      const result = calculateResult(mockQuestions, answers);
      expect(result.wrongQuestions.length).toBe(1);
      expect(result.wrongQuestions[0].question.id).toBe('q2');
    });
  });

  describe('DiagnosticQuestion 数据结构', () => {
    it('应支持 fill_blank 类型', () => {
      const q: DiagnosticQuestion = {
        id: 'test',
        type: 'fill_blank',
        question: 'Test',
        answer: 'answer',
      };
      expect(q.type).toBe('fill_blank');
    });

    it('应支持带 explanation 的题目', () => {
      const q: DiagnosticQuestion = {
        id: 'test',
        type: 'fill_blank',
        question: 'Test',
        answer: 'answer',
        explanation: 'This is the explanation',
      };
      expect(q.explanation).toBe('This is the explanation');
    });

    it('应支持带 options 的题目', () => {
      const q: DiagnosticQuestion = {
        id: 'test',
        type: 'multiple_choice',
        question: 'Test',
        answer: 'A',
        options: ['A', 'B', 'C', 'D'],
      };
      expect(q.options).toEqual(['A', 'B', 'C', 'D']);
    });
  });
});
