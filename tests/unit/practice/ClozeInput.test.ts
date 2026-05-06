/**
 * ClozeInput 单元测试
 * 测试正则解析、答案验证
 */

const { describe, it, expect } = require('@jest/globals');

// 模拟 parseQuestion 函数逻辑
function parseQuestion(question: string): Array<{ type: 'text' | 'input'; content: string; index?: number }> {
  const parts: Array<{ type: 'text' | 'input'; content: string; index?: number }> = [];
  let lastIndex = 0;
  let inputIndex = 0;

  // 匹配连续的下划线（3个或更多）
  const regex = /_{3,}/g;
  let match;

  while ((match = regex.exec(question)) !== null) {
    // 添加匹配前的文本
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: question.slice(lastIndex, match.index)
      });
    }

    // 添加输入框
    parts.push({
      type: 'input',
      content: '',
      index: inputIndex++
    });

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  if (lastIndex < question.length) {
    parts.push({
      type: 'text',
      content: question.slice(lastIndex)
    });
  }

  return parts;
}

// 模拟答案验证逻辑
function isAnswerCorrect(
  userAnswer: string | undefined,
  correctAnswer: string | undefined,
  showResult: boolean
): boolean | null {
  if (!showResult || !userAnswer) return null;
  const normalizedUser = userAnswer?.toLowerCase().trim();
  const normalizedCorrect = correctAnswer?.toLowerCase().trim();
  if (!normalizedCorrect) return null;
  return normalizedUser === normalizedCorrect;
}

// 模拟 parseAnswers 函数
function parseAnswers(answerString: string): string[] {
  return answerString
    .split(/[,，、]/)
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

describe('ClozeInput 正则解析', () => {
  describe('基本解析', () => {
    it('应正确解析单个填空', () => {
      const parts = parseQuestion('1 + 1 = ____');
      expect(parts.length).toBe(2);
      expect(parts[0]).toEqual({ type: 'text', content: '1 + 1 = ' });
      expect(parts[1]).toEqual({ type: 'input', content: '', index: 0 });
    });

    it('应正确解析多个填空', () => {
      const parts = parseQuestion('____ + ____ = 4');
      expect(parts.length).toBe(4);
      expect(parts[0]).toEqual({ type: 'input', content: '', index: 0 });
      expect(parts[1]).toEqual({ type: 'text', content: ' + ' });
      expect(parts[2]).toEqual({ type: 'input', content: '', index: 1 });
      expect(parts[3]).toEqual({ type: 'text', content: ' = 4' });
    });

    it('无填空时返回原文本', () => {
      const parts = parseQuestion('No blanks here');
      expect(parts.length).toBe(1);
      expect(parts[0]).toEqual({ type: 'text', content: 'No blanks here' });
    });
  });

  describe('下划线匹配规则', () => {
    it('应匹配3个以上下划线', () => {
      const parts = parseQuestion('___ + ____ + _____');
      expect(parts.filter(p => p.type === 'input').length).toBe(3);
    });

    it('应忽略少于3个下划线', () => {
      const parts = parseQuestion('__ is short');
      // 单个下划线不应被匹配
      const textOnly = parts.filter(p => p.type === 'text');
      expect(textOnly.some(p => p.content.includes('__'))).toBe(true);
    });

    it('应匹配连续下划线为一个填空', () => {
      const parts = parseQuestion('ten underscores: __________');
      const inputs = parts.filter(p => p.type === 'input');
      expect(inputs.length).toBe(1);
    });
  });

  describe('边界情况', () => {
    it('空字符串应返回空数组', () => {
      const parts = parseQuestion('');
      expect(parts.length).toBe(0);
    });

    it('仅下划线应返回单个输入', () => {
      const parts = parseQuestion('______');
      expect(parts.length).toBe(1);
      expect(parts[0].type).toBe('input');
    });

    it('开头为下划线应正确解析', () => {
      const parts = parseQuestion('____ is first');
      expect(parts[0].type).toBe('input');
      expect(parts[1].content).toBe(' is first');
    });

    it('结尾为下划线应正确解析', () => {
      const parts = parseQuestion('answer is ____');
      expect(parts.length).toBe(2);
      expect(parts[0].content).toBe('answer is ');
      expect(parts[1].type).toBe('input');
    });
  });

  describe('复杂场景', () => {
    it('应正确处理数学表达式', () => {
      const parts = parseQuestion('x² + 2x + ____ = (x + ____)²');
      expect(parts.length).toBe(5);
      const inputs = parts.filter(p => p.type === 'input');
      expect(inputs.length).toBe(2);
      expect(inputs[0].index).toBe(0);
      expect(inputs[1].index).toBe(1);
    });

    it('应正确处理中文内容', () => {
      const parts = parseQuestion('中国的首都是____');
      expect(parts.length).toBe(2);
      expect(parts[1].type).toBe('input');
    });

    it('应正确处理英文内容', () => {
      const parts = parseQuestion('The capital of China is ____');
      expect(parts.length).toBe(2);
      expect(parts[1].type).toBe('input');
    });
  });
});

describe('parseAnswers 答案解析', () => {
  describe('基本分隔', () => {
    it('应解析逗号分隔的答案', () => {
      const result = parseAnswers('A, B, C');
      expect(result).toEqual(['A', 'B', 'C']);
    });

    it('应解析中文逗号分隔的答案', () => {
      const result = parseAnswers('正确，错误，对');
      expect(result).toEqual(['正确', '错误', '对']);
    });

    it('应解析顿号分隔的答案', () => {
      const result = parseAnswers('北京、上海、广州');
      expect(result).toEqual(['北京', '上海', '广州']);
    });

    it('应解析混合分隔符', () => {
      const result = parseAnswers('A，B、C');
      expect(result).toEqual(['A', 'B', 'C']);
    });
  });

  describe('空格处理', () => {
    it('应去除首尾空格', () => {
      const result = parseAnswers('  hello  ,  world  ');
      expect(result).toEqual(['hello', 'world']);
    });

    it('仅空格分隔时保留原始空格', () => {
      // 注意：当前实现不会分割中间的空格
      const result = parseAnswers('hello   world');
      expect(result).toEqual(['hello   world']);
    });
  });

  describe('空值过滤', () => {
    it('应过滤空字符串', () => {
      const result = parseAnswers('A, , B');
      expect(result).toEqual(['A', 'B']);
    });

    it('应过滤纯空格项', () => {
      const result = parseAnswers('A,   , B');
      expect(result).toEqual(['A', 'B']);
    });

    it('单个答案应正确返回', () => {
      const result = parseAnswers('only one');
      expect(result).toEqual(['only one']);
    });
  });

  describe('边界情况', () => {
    it('空字符串应返回空数组', () => {
      const result = parseAnswers('');
      expect(result).toEqual([]);
    });

    it('仅空格应返回空数组', () => {
      const result = parseAnswers('   ');
      expect(result).toEqual([]);
    });

    it('分隔符连续应正确处理', () => {
      const result = parseAnswers('A,,B');
      expect(result).toEqual(['A', 'B']);
    });
  });
});

describe('ClozeInput 答案验证逻辑', () => {
  describe('isAnswerCorrect 函数', () => {
    it('showResult=false 应返回 null', () => {
      expect(isAnswerCorrect('2', '2', false)).toBeNull();
    });

    it('正确答案应返回 true', () => {
      expect(isAnswerCorrect('2', '2', true)).toBe(true);
    });

    it('错误答案应返回 false', () => {
      expect(isAnswerCorrect('3', '2', true)).toBe(false);
    });

    it('空用户答案应返回 null', () => {
      expect(isAnswerCorrect(undefined, '2', true)).toBeNull();
    });

    it('大小写应不敏感', () => {
      expect(isAnswerCorrect('BEIJING', 'beijing', true)).toBe(true);
    });

    it('空格应被忽略', () => {
      expect(isAnswerCorrect('  2  ', '2', true)).toBe(true);
    });
  });
});
