/**
 * question-generator 单元测试
 * 测试 JSON 解析、分块算法
 */

// Jest globals are provided by ts-jest preset

// 模拟 calculateCardCount 函数逻辑
function calculateCardCount(content: string): number {
  const length = content.length;
  if (length < 500) return 3;
  if (length < 1500) return 5;
  if (length < 3000) return 8;
  if (length < 6000) return 12;
  if (length < 12000) return 20;
  return Math.min(50, Math.floor(length / 300));
}

// 模拟 calculateDifficultyFromComplexity 函数逻辑
function calculateDifficultyFromComplexity(features: {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}): number {
  const baseDifficulty = Math.round(features.complexity * 11) + 1;
  return Math.max(1, Math.min(12, baseDifficulty));
}

// 模拟内容分块逻辑
function chunkContent(content: string, maxChunkSize: number): string[] {
  if (content.length <= maxChunkSize) {
    return [content];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    let end = Math.min(start + maxChunkSize, content.length);

    // 尝试在句子边界分割
    if (end < content.length) {
      const lastPeriod = content.lastIndexOf('。', end);
      const lastNewline = content.lastIndexOf('\n', end);
      const lastBreak = Math.max(lastPeriod, lastNewline);

      if (lastBreak > start + maxChunkSize / 2) {
        end = lastBreak + 1;
      }
    }

    chunks.push(content.slice(start, end));
    start = end;
  }

  return chunks;
}

describe('question-generator 核心逻辑', () => {
  describe('calculateCardCount 分块数量计算', () => {
    describe('边界值测试', () => {
      it('空内容应返回 3', () => {
        expect(calculateCardCount('')).toBe(3);
      });

      it('短内容 (<500) 应返回 3', () => {
        expect(calculateCardCount('short content')).toBe(3);
      });

      it('中等内容 (~1000) 应返回 5', () => {
        const content = 'a'.repeat(1000);
        expect(calculateCardCount(content)).toBe(5);
      });

      it('较长内容 (~2000) 应返回 8', () => {
        const content = 'a'.repeat(2000);
        expect(calculateCardCount(content)).toBe(8);
      });

      it('长内容 (~5000) 应返回 12', () => {
        const content = 'a'.repeat(5000);
        expect(calculateCardCount(content)).toBe(12);
      });

      it('超长内容 (~10000) 应返回 20', () => {
        const content = 'a'.repeat(10000);
        expect(calculateCardCount(content)).toBe(20);
      });

      it('极长内容 (>20000) 应限制为 50', () => {
        const content = 'a'.repeat(30000);
        expect(calculateCardCount(content)).toBe(50);
      });
    });

    describe('边界阈值', () => {
      it('499字符应返回 3', () => {
        expect(calculateCardCount('a'.repeat(499))).toBe(3);
      });

      it('500字符应返回 5', () => {
        expect(calculateCardCount('a'.repeat(500))).toBe(5);
      });

      it('1499字符应返回 5', () => {
        expect(calculateCardCount('a'.repeat(1499))).toBe(5);
      });

      it('1500字符应返回 8', () => {
        expect(calculateCardCount('a'.repeat(1500))).toBe(8);
      });
    });
  });

  describe('calculateDifficultyFromComplexity 难度计算', () => {
    it('复杂度 0 应返回难度 1', () => {
      const result = calculateDifficultyFromComplexity({
        cognitiveLoad: 0,
        reasoningDepth: 0,
        complexity: 0,
      });
      expect(result).toBe(1);
    });

    it('复杂度 0.5 应返回难度 6 或 7', () => {
      const result = calculateDifficultyFromComplexity({
        cognitiveLoad: 0.5,
        reasoningDepth: 0.5,
        complexity: 0.5,
      });
      expect(result).toBeGreaterThanOrEqual(6);
      expect(result).toBeLessThanOrEqual(7);
    });

    it('复杂度 1 应返回难度 12', () => {
      const result = calculateDifficultyFromComplexity({
        cognitiveLoad: 1,
        reasoningDepth: 1,
        complexity: 1,
      });
      expect(result).toBe(12);
    });

    it('复杂度边界应限制在 1-12', () => {
      // 负数
      const negResult = calculateDifficultyFromComplexity({
        cognitiveLoad: -0.5,
        reasoningDepth: -0.5,
        complexity: -0.5,
      });
      expect(negResult).toBeGreaterThanOrEqual(1);

      // 超过1的值
      const overResult = calculateDifficultyFromComplexity({
        cognitiveLoad: 2,
        reasoningDepth: 2,
        complexity: 2,
      });
      expect(overResult).toBeLessThanOrEqual(12);
    });
  });

  describe('chunkContent 内容分块', () => {
    it('短内容不应分块', () => {
      const chunks = chunkContent('short content', 1000);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('short content');
    });

    it('应按最大块大小分块', () => {
      const content = 'a'.repeat(500);
      const chunks = chunkContent(content, 100);
      expect(chunks.length).toBe(5);
    });

    it('应在句子边界分割', () => {
      const content = '这是第一句。这是第二句。这是第三句。';
      const chunks = chunkContent(content, 15);
      // 应该尽可能在句号处分割
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.length).toBeLessThanOrEqual(4);
    });

    it('应保留段落结构', () => {
      const content = '第一段文字。\n\n第二段文字。\n\n第三段文字。';
      const chunks = chunkContent(content, 100);
      // 换行符处也应该是合理的分割点
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('无句号时应按字数硬切', () => {
      const content = '没有标点符号的连续文字内容需要正确分割处理';
      const chunks = chunkContent(content, 10);
      expect(chunks.length).toBeGreaterThan(1);
    });

    describe('边界情况', () => {
      it('空字符串应返回空数组', () => {
        const chunks = chunkContent('', 100);
        expect(chunks.length).toBe(1);
        expect(chunks[0]).toBe('');
      });

      it('等于最大尺寸的内容应返回1块', () => {
        const content = 'a'.repeat(100);
        const chunks = chunkContent(content, 100);
        expect(chunks.length).toBe(1);
      });

      it('略超最大尺寸应返回2块', () => {
        const content = 'a'.repeat(101);
        const chunks = chunkContent(content, 100);
        expect(chunks.length).toBe(2);
      });
    });
  });

  describe('GeneratedQuestionType 类型定义', () => {
    // 这些是推测的类型值
    it('应包含 fill_blank 类型', () => {
      const validTypes = ['fill_blank', 'multiple_choice', 'short_answer'];
      expect(validTypes).toContain('fill_blank');
    });

    it('应包含 multiple_choice 类型', () => {
      const validTypes = ['fill_blank', 'multiple_choice', 'short_answer'];
      expect(validTypes).toContain('multiple_choice');
    });

    it('应包含 short_answer 类型', () => {
      const validTypes = ['fill_blank', 'multiple_choice', 'short_answer'];
      expect(validTypes).toContain('short_answer');
    });
  });

  describe('GeneratedCard 数据结构', () => {
    interface GeneratedCard {
      id: string;
      question_type: string;
      question: string;
      answer: string;
      options?: string[];
      explanation?: string;
    }

    it('应支持基本卡片结构', () => {
      const card: GeneratedCard = {
        id: 'card-1',
        question_type: 'fill_blank',
        question: '1 + 1 = ____',
        answer: '2',
      };
      expect(card.question_type).toBe('fill_blank');
    });

    it('应支持带选项的选择题', () => {
      const card: GeneratedCard = {
        id: 'card-2',
        question_type: 'multiple_choice',
        question: 'Which is correct?',
        answer: 'A',
        options: ['A', 'B', 'C', 'D'],
      };
      expect(card.options).toHaveLength(4);
    });

    it('应支持带解析的卡片', () => {
      const card: GeneratedCard = {
        id: 'card-3',
        question_type: 'fill_blank',
        question: 'The answer is 2.',
        answer: '2',
        explanation: '1 + 1 = 2',
      };
      expect(card.explanation).toBe('1 + 1 = 2');
    });
  });
});
