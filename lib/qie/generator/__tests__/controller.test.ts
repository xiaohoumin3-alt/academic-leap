import { GeneratorController } from '../controller';

describe('GeneratorController', () => {
  it('should select TemplateEngine for linear with depth <= 2', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'linear',
      depth: 1,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('TemplateEngine');
  });

  it('should select TemplateEngine for linear with depth = 2', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'linear',
      depth: 2,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('TemplateEngine');
  });

  it('should select ASTEngine for nested structure', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'nested',
      depth: 2,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('ASTEngine');
  });

  it('should select ASTEngine for linear with depth > 2', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'linear',
      depth: 3,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('ASTEngine');
  });

  it('should select ASTEngine for multi_equation', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'multi_equation',
      depth: 1,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('ASTEngine');
  });

  it('should select ASTEngine for constraint_chain', () => {
    const controller = new GeneratorController();
    const engine = controller.decide({
      structure: 'constraint_chain',
      depth: 1,
      distraction: 0,
    });
    expect(engine.constructor.name).toBe('ASTEngine');
  });
});
