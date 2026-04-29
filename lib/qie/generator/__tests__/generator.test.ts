import { QuestionGenerator } from '../generator';

describe('QuestionGenerator', () => {
  it('should generate question end-to-end', async () => {
    const generator = new QuestionGenerator();
    const result = await generator.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result.content).toBeDefined();
    expect(result.answer).toBeDefined();
    expect(result.complexitySpec).toBeDefined();
    expect(result.engine).toBe('template');
  });

  it('should use template engine for linear depth 1', async () => {
    const generator = new QuestionGenerator();
    const result = await generator.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result.engine).toBe('template');
  });

  it('should use ast engine for nested', async () => {
    const generator = new QuestionGenerator();
    const result = await generator.generate({
      structure: 'nested',
      depth: 2,
      distraction: 0,
    });

    expect(result.engine).toBe('ast');
  });

  it('should generate batch of questions', async () => {
    const generator = new QuestionGenerator();
    const specs = [
      { structure: 'linear' as const, depth: 1 as const, distraction: 0 as const },
      { structure: 'linear' as const, depth: 2 as const, distraction: 0 as const },
    ];

    const results = await generator.generateBatch(specs, 'batch-123');

    expect(results).toHaveLength(2);
    expect(results[0].batchId).toBe('batch-123');
    expect(results[1].batchId).toBe('batch-123');
  });

  it('should include x in answer for linear equations', async () => {
    const generator = new QuestionGenerator();
    const result = await generator.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result.answer).toContain('x');
  });

  it('should return proper result structure', async () => {
    const generator = new QuestionGenerator();
    const result = await generator.generate({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('batchId');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('complexitySpec');
    expect(result).toHaveProperty('engine');
    expect(result).toHaveProperty('promotionStatus');
  });
});
