import { MockLLMRenderer } from './mocks';

describe('MockLLMRenderer', () => {
  it('should render template input', async () => {
    const renderer = new MockLLMRenderer();
    const result = await renderer.render({
      type: 'template',
      template: '解方程: {a}x {b:+d} = {c}',
      params: { a: 2, b: 3, c: 10, x: 3.5 },
      spec: {
        structure: 'linear',
        depth: 1,
        distraction: 0,
      },
    });

    expect(result).toContain('解方程');
    expect(result).toContain('2');
  });

  it('should render AST input', async () => {
    const renderer = new MockLLMRenderer();
    const result = await renderer.render({
      type: 'ast',
      ast: {
        type: 'group',
        expr: {
          type: 'add',
          left: { type: 'mul', left: { type: 'const', value: 2 }, right: { type: 'var', name: 'x' } },
          right: { type: 'const', value: 3 },
        },
      },
      params: { x: 1 },
      spec: {
        structure: 'nested',
        depth: 2,
        distraction: 0,
      },
    });

    expect(result).toBeDefined();
  });
});
