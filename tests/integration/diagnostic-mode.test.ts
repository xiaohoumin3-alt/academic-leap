/**
 * 集成测试 - 诊断模式流程
 *
 * 测试场景：
 * 1. 诊断模式完整流程（answering → submitting → result）
 * 2. 批量提交和结果计算
 * 3. XP 奖励计算
 */

// Jest globals are provided by ts-jest preset

interface DiagnosticQuestion {
  id: string;
  type: 'fill_blank' | 'multiple_choice' | 'short_answer';
  question: string;
  answer: string | string[];
  options?: string[];
  explanation?: string;
}

type DiagnosticState = 'answering' | 'submitting' | 'result' | 'error';

interface DiagnosticResult {
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  wrongQuestions: { question: DiagnosticQuestion; userAnswer: string }[];
  earnedXP: number;
}

// 模拟诊断流程的状态机
class DiagnosticFlowMachine {
  private questions: DiagnosticQuestion[];
  private answers: (string | null)[] = [];
  private currentIndex: number = 0;
  private state: DiagnosticState = 'answering';
  private result: DiagnosticResult | null = null;

  constructor(questions: DiagnosticQuestion[]) {
    this.questions = questions;
    this.answers = new Array(questions.length).fill(null);
  }

  getState(): DiagnosticState {
    return this.state;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getProgress(): number {
    const total = this.questions.length;
    if (total === 0) return 0;
    return ((this.currentIndex + (this.answers[this.currentIndex] !== null ? 1 : 0)) / total) * 100;
  }

  isLastQuestion(): boolean {
    return this.currentIndex === this.questions.length - 1;
  }

  hasAnswered(): boolean {
    return this.answers[this.currentIndex] !== null;
  }

  handleAnswer(answer: string): void {
    if (this.state !== 'answering') return;
    this.answers[this.currentIndex] = answer;
  }

  handleNext(): void {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    }
  }

  private checkAnswer(userAnswer: string | null, correctAnswer: string | string[]): boolean {
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

  async handleSubmit(): Promise<DiagnosticResult> {
    this.state = 'submitting';

    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 100));

    const wrongQuestions: { question: DiagnosticQuestion; userAnswer: string }[] = [];
    let correctCount = 0;

    this.questions.forEach((q, i) => {
      const userAnswer = this.answers[i];
      if (this.checkAnswer(userAnswer, q.answer)) {
        correctCount++;
      } else {
        wrongQuestions.push({ question: q, userAnswer: userAnswer || '' });
      }
    });

    const baseXP = correctCount * 5;
    const bonusXP = correctCount === this.questions.length ? 50 : 0;

    this.result = {
      accuracy: this.questions.length > 0 ? Math.round((correctCount / this.questions.length) * 100) : 0,
      correctCount,
      wrongCount: this.questions.length - correctCount,
      wrongQuestions,
      earnedXP: baseXP + bonusXP,
    };

    this.state = 'result';
    return this.result;
  }

  getResult(): DiagnosticResult | null {
    return this.result;
  }

  handleRestart(): void {
    this.answers = new Array(this.questions.length).fill(null);
    this.currentIndex = 0;
    this.state = 'answering';
    this.result = null;
  }
}

describe('诊断模式流程集成测试', () => {
  const mockQuestions: DiagnosticQuestion[] = [
    { id: 'q1', type: 'fill_blank', question: '1 + 1 = ____', answer: '2' },
    { id: 'q2', type: 'fill_blank', question: '2 + 2 = ____', answer: '4' },
    { id: 'q3', type: 'fill_blank', question: '3 + 3 = ____', answer: '6' },
    { id: 'q4', type: 'fill_blank', question: '4 + 4 = ____', answer: ['8', '八'] }, // 多答案
  ];

  let flowMachine: DiagnosticFlowMachine;

  beforeEach(() => {
    flowMachine = new DiagnosticFlowMachine(mockQuestions);
  });

  describe('初始状态', () => {
    it('初始状态应为 answering', () => {
      expect(flowMachine.getState()).toBe('answering');
    });

    it('初始索引应为 0', () => {
      expect(flowMachine.getCurrentIndex()).toBe(0);
    });

    it('初始进度应为 0%', () => {
      expect(flowMachine.getProgress()).toBe(0);
    });

    it('非最后一题', () => {
      expect(flowMachine.isLastQuestion()).toBe(false);
    });

    it('当前题未作答', () => {
      expect(flowMachine.hasAnswered()).toBe(false);
    });
  });

  describe('答题流程', () => {
    it('应正确回答第一题', () => {
      flowMachine.handleAnswer('2');
      expect(flowMachine.hasAnswered()).toBe(true);
      expect(flowMachine.getProgress()).toBeGreaterThan(0);
    });

    it('应正确移动到下一题', () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      expect(flowMachine.getCurrentIndex()).toBe(1);
      expect(flowMachine.hasAnswered()).toBe(false);
    });

    it('应在最后一题时正确判断 (4题模式)', () => {
      // mockQuestions 有 4 题，索引从 0 开始
      // q1 -> index 0 -> next -> index 1
      // q2 -> index 1 -> next -> index 2
      // q3 -> index 2 -> next -> index 3 (最后一题)
      flowMachine.handleAnswer('2');
      flowMachine.handleNext(); // index 0 -> 1
      flowMachine.handleAnswer('4');
      flowMachine.handleNext(); // index 1 -> 2
      flowMachine.handleAnswer('6');
      flowMachine.handleNext(); // index 2 -> 3 (最后一题)
      expect(flowMachine.getCurrentIndex()).toBe(3);
      expect(flowMachine.isLastQuestion()).toBe(true);
    });
  });

  describe('批量提交', () => {
    it('应正确提交所有答案', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('8');

      const result = await flowMachine.handleSubmit();

      expect(result.correctCount).toBe(4);
      expect(result.wrongCount).toBe(0);
      expect(result.accuracy).toBe(100);
      expect(result.earnedXP).toBe(70); // 4*5 + 50
      expect(flowMachine.getState()).toBe('result');
    });

    it('应正确处理部分正确', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('8');

      const result = await flowMachine.handleSubmit();

      expect(result.correctCount).toBe(3);
      expect(result.wrongCount).toBe(1);
      expect(result.accuracy).toBe(75);
      expect(result.earnedXP).toBe(15); // 3*5, no bonus
    });

    it('应正确处理全错', async () => {
      flowMachine.handleAnswer('wrong');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong');

      const result = await flowMachine.handleSubmit();

      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(4);
      expect(result.accuracy).toBe(0);
      expect(result.earnedXP).toBe(0);
    });

    it('应正确记录错题', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('8');

      const result = await flowMachine.handleSubmit();

      expect(result.wrongQuestions.length).toBe(1);
      expect(result.wrongQuestions[0].question.id).toBe('q2');
      expect(result.wrongQuestions[0].userAnswer).toBe('wrong');
    });

    it('应支持多答案匹配', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('八'); // 使用中文答案

      const result = await flowMachine.handleSubmit();

      expect(result.correctCount).toBe(4);
      expect(result.accuracy).toBe(100);
    });
  });

  describe('XP 奖励规则', () => {
    it('全对应获得额外奖励', async () => {
      // 4题全部正确
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('8');

      const result = await flowMachine.handleSubmit();

      expect(result.earnedXP).toBe(70); // 4*5 + 50
    });

    it('非全对无额外奖励', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('wrong'); // 最后一题错

      const result = await flowMachine.handleSubmit();

      expect(result.earnedXP).toBe(15); // 3*5, no bonus
    });
  });

  describe('进度计算', () => {
    it('答题后进度应增加', () => {
      expect(flowMachine.getProgress()).toBe(0);

      flowMachine.handleAnswer('2');
      expect(flowMachine.getProgress()).toBeCloseTo(25, 0);

      flowMachine.handleNext();
      expect(flowMachine.getProgress()).toBeCloseTo(25, 0);

      flowMachine.handleAnswer('4');
      expect(flowMachine.getProgress()).toBeCloseTo(50, 0);
    });
  });

  describe('重新开始', () => {
    it('handleRestart 应重置所有状态', async () => {
      // 答题
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');

      // 提交
      await flowMachine.handleSubmit();
      expect(flowMachine.getState()).toBe('result');

      // 重新开始
      flowMachine.handleRestart();
      expect(flowMachine.getState()).toBe('answering');
      expect(flowMachine.getCurrentIndex()).toBe(0);
      expect(flowMachine.getProgress()).toBe(0);
      expect(flowMachine.getResult()).toBe(null);
    });
  });

  describe('异步行为', () => {
    it('submit 应进入 submitting 状态', async () => {
      flowMachine.handleAnswer('2');
      flowMachine.handleNext();
      flowMachine.handleAnswer('4');
      flowMachine.handleNext();
      flowMachine.handleAnswer('6');
      flowMachine.handleNext();
      flowMachine.handleAnswer('8');

      const submitPromise = flowMachine.handleSubmit();
      expect(flowMachine.getState()).toBe('submitting');

      await submitPromise;
      expect(flowMachine.getState()).toBe('result');
    });
  });

  describe('10题完整流程', () => {
    it('10题诊断流程应正确执行', async () => {
      const tenQuestions: DiagnosticQuestion[] = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i + 1}`,
        type: 'fill_blank' as const,
        question: `${i + 1} + ${i + 1} = ____`,
        answer: String((i + 1) * 2),
      }));

      const tenMachine = new DiagnosticFlowMachine(tenQuestions);

      // 全部答对
      for (let i = 0; i < 10; i++) {
        tenMachine.handleAnswer(String((i + 1) * 2));
        if (i < 9) tenMachine.handleNext();
      }

      const result = await tenMachine.handleSubmit();

      expect(result.correctCount).toBe(10);
      expect(result.wrongCount).toBe(0);
      expect(result.accuracy).toBe(100);
      expect(result.earnedXP).toBe(100); // 10*5 + 50
    });

    it('10题部分正确应正确计算', async () => {
      const tenQuestions: DiagnosticQuestion[] = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i + 1}`,
        type: 'fill_blank' as const,
        question: `${i + 1} + ${i + 1} = ____`,
        answer: String((i + 1) * 2),
      }));

      const tenMachine = new DiagnosticFlowMachine(tenQuestions);

      // 奇数题答对，偶数题答错
      for (let i = 0; i < 10; i++) {
        tenMachine.handleAnswer(i % 2 === 0 ? String((i + 1) * 2) : 'wrong');
        if (i < 9) tenMachine.handleNext();
      }

      const result = await tenMachine.handleSubmit();

      expect(result.correctCount).toBe(5);
      expect(result.wrongCount).toBe(5);
      expect(result.accuracy).toBe(50);
      expect(result.earnedXP).toBe(25); // 5*5, no bonus
    });
  });
});
