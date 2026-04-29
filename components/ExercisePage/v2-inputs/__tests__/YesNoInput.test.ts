/**
 * YesNoInput 组件导出测试
 * 验证组件模块可以正确加载
 */

describe('YesNoInput', () => {
  it('应该导出 YesNoInput 组件', () => {
    const module = require('../YesNoInput');
    expect(module.YesNoInput).toBeDefined();
  });

  it('应该是 React 函数组件', () => {
    const module = require('../YesNoInput');
    expect(typeof module.YesNoInput).toBe('function');
  });
});

describe('NumberInput', () => {
  it('应该导出 NumberInput 组件', () => {
    const module = require('../NumberInput');
    expect(module.NumberInput).toBeDefined();
  });
});

describe('ChoiceInput', () => {
  it('应该导出 ChoiceInput 组件', () => {
    const module = require('../ChoiceInput');
    expect(module.ChoiceInput).toBeDefined();
  });

  it('应该导出 ChoiceOption 类型', () => {
    const module = require('../ChoiceInput');
    expect(module.ChoiceOption).toBeDefined();
  });
});

describe('index', () => {
  it('应该导出所有 v2 输入组件', () => {
    const module = require('../index');
    expect(module.YesNoInput).toBeDefined();
    expect(module.NumberInput).toBeDefined();
    expect(module.ChoiceInput).toBeDefined();
  });
});
