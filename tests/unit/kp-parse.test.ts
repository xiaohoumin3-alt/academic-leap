/**
 * Knowledge Point 解析测试 (P0 CRITICAL)
 *
 * 验证知识点 ID/Name 混用场景的处理
 *
 * TDD 流程:
 * 1. RED: 编写失败测试
 * 2. GREEN: 实现修复
 * 3. REFACTOR: 清理代码
 */

import { parseKnowledgePointNames } from '@/lib/utils/kp-parse';

describe('parseKnowledgePointNames - 知识点解析', () => {
  describe('基本类型支持', () => {
    it('应处理 null 输入', () => {
      expect(parseKnowledgePointNames(null)).toEqual([]);
    });

    it('应处理 undefined 输入', () => {
      expect(parseKnowledgePointNames(undefined)).toEqual([]);
    });

    it('应处理空字符串', () => {
      expect(parseKnowledgePointNames('')).toEqual([]);
    });

    it('应处理空数组', () => {
      expect(parseKnowledgePointNames([])).toEqual([]);
    });
  });

  describe('数组格式处理', () => {
    it('应正确处理字符串数组', () => {
      const input = ['kp1', 'kp2', 'kp3'];
      expect(parseKnowledgePointNames(input)).toEqual(input);
    });

    it('应处理混合 ID 和 Name 的数组', () => {
      // 场景: 数据库中可能混用 ID (如 "123") 和 Name (如 "二次函数")
      const input = ['123', '二次函数', '456', '一次函数'];
      expect(parseKnowledgePointNames(input)).toEqual(input);
    });

    it('应保留原始数组引用', () => {
      const input = ['kp1', 'kp2'];
      const result = parseKnowledgePointNames(input);
      expect(result).toBe(input); // 引用相同
    });
  });

  describe('JSON 字符串格式处理', () => {
    it('应解析 JSON 数组字符串', () => {
      const input = '["kp1", "kp2", "kp3"]';
      expect(parseKnowledgePointNames(input)).toEqual(['kp1', 'kp2', 'kp3']);
    });

    it('应处理 ID 数组的 JSON 字符串', () => {
      const input = '["123", "456", "789"]';
      expect(parseKnowledgePointNames(input)).toEqual(['123', '456', '789']);
    });

    it('应处理 Name 数组的 JSON 字符串', () => {
      const input = '["二次函数", "一次函数", "几何"]';
      expect(parseKnowledgePointNames(input)).toEqual(['二次函数', '一次函数', '几何']);
    });

    it('应处理无效的 JSON 字符串', () => {
      const input = 'not a valid json';
      expect(parseKnowledgePointNames(input)).toEqual([]);
    });

    it('应处理非数组的 JSON 字符串', () => {
      const input = '{"id": "123"}';
      expect(parseKnowledgePointNames(input)).toEqual([]);
    });
  });

  describe('ID/Name 混用场景', () => {
    it('应处理纯 ID 格式', () => {
      // 场景: 用户 ID 系统
      const input = ['1001', '1002', '1003'];
      expect(parseKnowledgePointNames(input)).toEqual(['1001', '1002', '1003']);
    });

    it('应处理纯 Name 格式', () => {
      // 场景: 名称系统
      const input = ['二次函数', '几何变换', '概率统计'];
      expect(parseKnowledgePointNames(input)).toEqual(['二次函数', '几何变换', '概率统计']);
    });

    it('应处理 ID/Name 混合格式', () => {
      // 场景: 数据库迁移期间，部分使用 ID，部分使用 Name
      const input = ['1001', '二次函数', '1003', '几何'];
      expect(parseKnowledgePointNames(input)).toEqual(['1001', '二次函数', '1003', '几何']);
    });

    it('应处理 JSON 中的 ID/Name 混合格式', () => {
      const input = '["1001", "二次函数", "1003", "几何"]';
      expect(parseKnowledgePointNames(input)).toEqual(['1001', '二次函数', '1003', '几何']);
    });

    it('应处理包含空字符串的数组', () => {
      const input = ['kp1', '', 'kp3'];
      const result = parseKnowledgePointNames(input);
      // 空字符串应被保留 (由调用方过滤)
      expect(result).toEqual(['kp1', '', 'kp3']);
    });
  });

  describe('边界情况', () => {
    it('应处理单元素数组', () => {
      expect(parseKnowledgePointNames(['single'])).toEqual(['single']);
    });

    it('应处理长数组', () => {
      const input = Array.from({ length: 100 }, (_, i) => `kp${i}`);
      expect(parseKnowledgePointNames(input)).toHaveLength(100);
    });

    it('应处理 Unicode 字符', () => {
      const input = ['知识点1', '二次函数', '几何变换'];
      expect(parseKnowledgePointNames(input)).toEqual(input);
    });

    it('应处理 JSON 中的 Unicode 字符', () => {
      const input = '["知识点1", "二次函数", "几何变换"]';
      expect(parseKnowledgePointNames(input)).toEqual(['知识点1', '二次函数', '几何变换']);
    });
  });
});

describe('parseKnowledgePointNames - 实际业务场景', () => {
  it('应处理题目知识点 (从 Prisma 返回的 JSON)', () => {
    // 模拟 Prisma 返回的 JSON 字段
    const dbValue = '["二次函数", "函数图像", "顶点坐标"]';
    const result = parseKnowledgePointNames(dbValue);
    expect(result).toHaveLength(3);
    expect(result).toContain('二次函数');
  });

  it('应处理从 question.knowledgePoints 字段', () => {
    // 模拟从 question 对象获取的知识点
    const question = {
      knowledgePoints: ['代数', '几何']
    };
    const result = parseKnowledgePointNames(question.knowledgePoints);
    expect(result).toEqual(['代数', '几何']);
  });

  it('应处理空 question.knowledgePoints', () => {
    const question = {
      knowledgePoints: null
    };
    const result = parseKnowledgePointNames(question.knowledgePoints);
    expect(result).toEqual([]);
  });

  it('应处理字符串形式的知识点 (单知识点)', () => {
    // 有时单知识点可能直接存储为字符串而非数组
    const input = 'single-kp';
    const result = parseKnowledgePointNames(input);
    // 由于不是有效 JSON，应该返回空数组
    expect(result).toEqual([]);
  });
});