import { TemplateEngine } from '../template-engine';

describe('TemplateEngine', () => {
  it('should generate linear_1_0 question', () => {
    const engine = new TemplateEngine();
    const result = engine.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result.template).toBeDefined();
    expect(result.params).toHaveProperty('a');
    expect(result.params).toHaveProperty('x');
  });

  it('should satisfy constraint: a != 0', () => {
    const engine = new TemplateEngine();
    const result = engine.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result.params.a).not.toBe(0);
  });

  it('should generate nested_2_0 question', () => {
    const engine = new TemplateEngine();
    const result = engine.generate({
      structure: 'nested',
      depth: 2,
      distraction: 0,
    });

    expect(result.template).toBeDefined();
    expect(result.params).toHaveProperty('x');
  });

  it('should satisfy constraint: a != c for linear_2_0', () => {
    const engine = new TemplateEngine();
    const result = engine.generate({
      structure: 'linear',
      depth: 2,
      distraction: 0,
    });

    expect(result.params.a).not.toBe(result.params.c);
  });

  it('should compute correct answer for linear_1_0', () => {
    const engine = new TemplateEngine();
    const result = engine.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    // ax + b = c → x = (c - b) / a
    const { a, b, c, x } = result.params;
    const expectedX = (c - b) / a;
    expect(x).toBeCloseTo(expectedX, 10);
  });
});
