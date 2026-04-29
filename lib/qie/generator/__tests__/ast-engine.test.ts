import { ASTEngine } from '../ast-engine';

describe('ASTEngine', () => {
  describe('generate', () => {
    it('should generate nested structure', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'nested',
        depth: 2,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
      expect(result.params).toBeDefined();
      expect(result.params).toHaveProperty('x');
    });

    it('should add distraction level 2', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'nested',
        depth: 2,
        distraction: 2,
      });

      expect(result.ast).toBeDefined();
    });

    it('should generate multi_equation structure', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'multi_equation',
        depth: 2,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });

    it('should generate constraint_chain structure', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'constraint_chain',
        depth: 2,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });

    it('should generate linear structure', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'linear',
        depth: 1,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
      expect(result.params).toBeDefined();
    });

    it('should satisfy constraints in params', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'nested',
        depth: 2,
        distraction: 0,
      });

      // a should not be 0
      expect(result.params.a).not.toBe(0);
    });

    it('should throw error for unknown structure', () => {
      const engine = new ASTEngine();
      expect(() => {
        engine.generate({
          // @ts-expect-error - testing invalid structure
          structure: 'unknown',
          depth: 1,
          distraction: 0,
        });
      }).toThrow('Unknown structure');
    });
  });

  describe('generateNested', () => {
    it('should generate depth 1 nested expression', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'nested',
        depth: 1,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
      expect(result.ast?.type).toBe('group');
    });

    it('should generate depth 3 nested expression', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'nested',
        depth: 3,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });
  });

  describe('distraction levels', () => {
    it('should handle distraction level 0 (no distraction)', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'linear',
        depth: 1,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });

    it('should handle distraction level 1', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'linear',
        depth: 1,
        distraction: 1,
      });

      expect(result.ast).toBeDefined();
    });

    it('should handle distraction level 3', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'linear',
        depth: 1,
        distraction: 3,
      });

      expect(result.ast).toBeDefined();
    });
  });

  describe('multi_equation structure', () => {
    it('should generate multi_equation at depth 1', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'multi_equation',
        depth: 1,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });

    it('should generate multi_equation at depth 4', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'multi_equation',
        depth: 4,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });
  });

  describe('constraint_chain structure', () => {
    it('should generate constraint_chain at depth 1', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'constraint_chain',
        depth: 1,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });

    it('should generate constraint_chain at depth 4', () => {
      const engine = new ASTEngine();
      const result = engine.generate({
        structure: 'constraint_chain',
        depth: 4,
        distraction: 0,
      });

      expect(result.ast).toBeDefined();
    });
  });
});
