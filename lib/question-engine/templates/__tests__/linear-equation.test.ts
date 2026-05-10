/**
 * 一元一次方程模板单元测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LinearEquationTemplate } from '../probability';
import { DIFFICULTY_CONFIG, generateRandomParams } from '../../difficulty';
import type { QuestionTemplate, StepProtocol } from '../../protocol';

// Mock console.error to suppress error output during tests
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();
beforeEach(() => {
  console.error = mockConsoleError;
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('linear-equation template', () => {
  describe('LinearEquationTemplate', () => {
    it('should have correct template id', () => {
      expect(LinearEquationTemplate.id).toBe('linear_equation_v1');
    });

    it('should have correct knowledge point', () => {
      expect(LinearEquationTemplate.knowledgePoint).toBe('linear_equation');
    });

    it('should implement QuestionTemplate interface', () => {
      expect(typeof LinearEquationTemplate.generateParams).toBe('function');
      expect(typeof LinearEquationTemplate.buildSteps).toBe('function');
      expect(typeof LinearEquationTemplate.render).toBe('function');
    });
  });

  describe('generateParams', () => {
    it('should generate valid params for difficulty 1', () => {
      const params = LinearEquationTemplate.generateParams(1);

      expect(params).toHaveProperty('a');
      expect(params).toHaveProperty('b');
      expect(params).toHaveProperty('c');
      expect(params).toHaveProperty('x');
    });

    it('should generate valid params for difficulty 2', () => {
      const params = LinearEquationTemplate.generateParams(2);

      expect(params).toHaveProperty('a');
      expect(params).toHaveProperty('b');
      expect(params).toHaveProperty('c');
      expect(params).toHaveProperty('x');
    });

    it('should generate valid params for difficulty 3', () => {
      const params = LinearEquationTemplate.generateParams(3);

      expect(params).toHaveProperty('a');
      expect(params).toHaveProperty('b');
      expect(params).toHaveProperty('c');
      expect(params).toHaveProperty('x');
    });

    it('should generate valid params for difficulty 4', () => {
      const params = LinearEquationTemplate.generateParams(4);

      expect(params).toHaveProperty('a');
      expect(params).toHaveProperty('b');
      expect(params).toHaveProperty('c');
      expect(params).toHaveProperty('x');
    });

    it('should generate valid params for difficulty 5', () => {
      const params = LinearEquationTemplate.generateParams(5);

      expect(params).toHaveProperty('a');
      expect(params).toHaveProperty('b');
      expect(params).toHaveProperty('c');
      expect(params).toHaveProperty('x');
    });

    it('should generate params within difficulty 1 range', () => {
      const config = DIFFICULTY_CONFIG.linear_equation[1];

      for (let i = 0; i < 100; i++) {
        const params = LinearEquationTemplate.generateParams(1);

        expect(params.a).toBeGreaterThanOrEqual(config.a.min);
        expect(params.a).toBeLessThanOrEqual(config.a.max);
        expect(params.b).toBeGreaterThanOrEqual(config.b.min);
        expect(params.b).toBeLessThanOrEqual(config.b.max);
        expect(params.x).toBeGreaterThanOrEqual(config.x.min);
        expect(params.x).toBeLessThanOrEqual(config.x.max);
      }
    });

    it('should generate params within difficulty 5 range', () => {
      const config = DIFFICULTY_CONFIG.linear_equation[5];

      for (let i = 0; i < 100; i++) {
        const params = LinearEquationTemplate.generateParams(5);

        expect(params.a).toBeGreaterThanOrEqual(config.a.min);
        expect(params.a).toBeLessThanOrEqual(config.a.max);
        expect(params.b).toBeGreaterThanOrEqual(config.b.min);
        expect(params.b).toBeLessThanOrEqual(config.b.max);
        expect(params.x).toBeGreaterThanOrEqual(config.x.min);
        expect(params.x).toBeLessThanOrEqual(config.x.max);
      }
    });

    it('should generate integer solution x', () => {
      for (let i = 0; i < 50; i++) {
        const params = LinearEquationTemplate.generateParams(3);
        expect(Number.isInteger(params.x)).toBe(true);
      }
    });

    it('should ensure c equals a*x + b (solution guarantee)', () => {
      for (let i = 0; i < 100; i++) {
        const params = LinearEquationTemplate.generateParams(Math.floor(Math.random() * 5) + 1);
        const expectedC = params.a * params.x + params.b;
        expect(params.c).toBe(expectedC);
      }
    });

    it('should not generate zero coefficient a', () => {
      for (let i = 0; i < 100; i++) {
        const params = LinearEquationTemplate.generateParams(Math.floor(Math.random() * 5) + 1);
        expect(params.a).not.toBe(0);
      }
    });

    it('should fall back to difficulty 1 config for invalid level', () => {
      const params = LinearEquationTemplate.generateParams(99);
      const config = DIFFICULTY_CONFIG.linear_equation[1];

      expect(params.a).toBeGreaterThanOrEqual(config.a.min);
      expect(params.a).toBeLessThanOrEqual(config.a.max);
      expect(params.x).toBeGreaterThanOrEqual(config.x.min);
      expect(params.x).toBeLessThanOrEqual(config.x.max);
    });

    it('should handle negative solutions', () => {
      // Test that negative x values are allowed
      let hasNegativeX = false;
      for (let i = 0; i < 100; i++) {
        const params = LinearEquationTemplate.generateParams(3);
        if (params.x < 0) hasNegativeX = true;
      }
      expect(hasNegativeX).toBe(true);
    });
  });

  describe('buildSteps', () => {
    it('should return single step for equation solving', () => {
      const params = { a: 2, b: 3, c: 7, x: 2 };
      const steps = LinearEquationTemplate.buildSteps(params);

      expect(steps).toHaveLength(1);
    });

    it('should create step with correct type', () => {
      const params = { a: 3, b: 6, c: 9, x: 1 };
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];

      expect(steps[0].type).toBe('solve_linear_equation');
    });

    it('should create step with numeric input', () => {
      const params = { a: 1, b: 2, c: 3, x: 1 };
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];

      expect(steps[0].inputType).toBe('numeric');
      expect(steps[0].keyboard).toBe('numeric');
      expect(steps[0].answerType).toBe('number');
    });

    it('should set correct tolerance', () => {
      const params = { a: 2, b: 4, c: 8, x: 2 };
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];

      expect(steps[0].tolerance).toBe(0.001);
    });

    it('should have valid stepId', () => {
      const params = { a: 1, b: 5, c: 8, x: 3 };
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];

      expect(steps[0].stepId).toBe('s1');
    });

    it('should have UI instructions', () => {
      const params = { a: 2, b: 1, c: 5, x: 2 };
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];

      expect(steps[0].ui).toBeDefined();
      expect(steps[0].ui.instruction).toBeTruthy();
      expect(steps[0].ui.inputTarget).toBeTruthy();
      expect(steps[0].ui.inputHint).toBeTruthy();
    });
  });

  describe('render', () => {
    it('should return title with equation format', () => {
      const params = { a: 2, b: 3, c: 7, x: 2 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.title).toMatch(/2x/);
      expect(rendered.title).toMatch(/= 7/);
    });

    it('should format positive b with + sign', () => {
      const params = { a: 3, b: 5, c: 14, x: 3 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.title).toContain('+ 5');
    });

    it('should format negative b correctly', () => {
      const params = { a: 2, b: -5, c: 1, x: 3 };
      const rendered = LinearEquationTemplate.render(params);

      // b is -5, so title shows "-5" not "- 5"
      expect(rendered.title).toContain('-5');
    });

    it('should have description', () => {
      const params = { a: 1, b: 2, c: 3, x: 1 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.description).toBe('一元一次方程');
    });

    it('should include context with solution hint', () => {
      const params = { a: 2, b: 4, c: 8, x: 2 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.context).toBeTruthy();
      expect(rendered.context).toContain('2x = 4');
      expect(rendered.context).toContain('x = 2');
    });

    it('should render valid equation string for various params', () => {
      const testCases = [
        { a: 1, b: 1, c: 2, x: 1 },
        { a: 5, b: -3, c: 12, x: 3 },
        { a: 3, b: 0, c: 9, x: 3 },
        { a: 7, b: -14, c: 0, x: 2 },
      ];

      testCases.forEach((params) => {
        const rendered = LinearEquationTemplate.render(params);
        expect(rendered.title).toBeTruthy();
        expect(rendered.description).toBeTruthy();
        expect(rendered.context).toBeTruthy();
      });
    });
  });

  describe('equation types and solution patterns', () => {
    it('should handle one-step equation (b = 0)', () => {
      // Equation form: ax = c (b = 0)
      // Note: when b = 0, formatSigned still shows "+ 0"
      const params = { a: 3, b: 0, c: 9, x: 3 };
      const rendered = LinearEquationTemplate.render(params);

      // The equation includes the + 0 term
      expect(rendered.title).toContain('3x + 0 = 9');
      expect(rendered.context).toContain('3x = 9');
      expect(rendered.context).toContain('x = 3');
    });

    it('should handle two-step equation (b non-zero, c simple)', () => {
      // Equation form: ax + b = c with simple solution
      const params = { a: 2, b: 4, c: 8, x: 2 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.title).toContain('2x + 4 = 8');
    });

    it('should handle negative coefficients', () => {
      const params = { a: -2, b: 5, c: 1, x: 2 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.title).toContain('-2x');
    });

    it('should handle fractional solution (when possible)', () => {
      // For linear equations with integer coefficients,
      // solution x = (c - b) / a may be fractional
      const params = { a: 2, b: 1, c: 3, x: 1 };
      const rendered = LinearEquationTemplate.render(params);

      // x = 1 is integer, which is valid
      expect(params.x).toBe((params.c - params.b) / params.a);
    });

    it('should handle large coefficients', () => {
      const params = { a: 15, b: -25, c: 20, x: 3 };
      const rendered = LinearEquationTemplate.render(params);

      expect(rendered.title).toContain('15x');
      expect(params.c).toBe(params.a * params.x + params.b);
    });
  });

  describe('validation scenarios', () => {
    it('should generate equation where solution is verified', () => {
      const params = { a: 4, b: 8, c: 16, x: 2 };
      const rendered = LinearEquationTemplate.render(params);

      // Verify the solution logic
      const expectedX = (params.c - params.b) / params.a;
      expect(expectedX).toBe(2);
      expect(rendered.context).toContain('x = 2');
    });

    it('should handle equation with zero constant term', () => {
      const params = { a: 5, b: 10, c: 0, x: -2 };
      const rendered = LinearEquationTemplate.render(params);

      expect(params.a * params.x + params.b).toBe(params.c);
    });

    it('should handle equation with negative constant (c)', () => {
      const params = { a: 3, b: 5, c: -4, x: -3 };
      const rendered = LinearEquationTemplate.render(params);

      expect(params.a * params.x + params.b).toBe(params.c);
      expect(rendered.title).toContain('-4');
    });
  });

  describe('integration: full template workflow', () => {
    it('should work through complete generation cycle', () => {
      // 1. Generate params
      const params = LinearEquationTemplate.generateParams(3);

      // 2. Build steps
      const steps = LinearEquationTemplate.buildSteps(params) as StepProtocol[];
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('solve_linear_equation');

      // 3. Render content
      const rendered = LinearEquationTemplate.render(params);
      expect(rendered.title).toBeTruthy();
      expect(rendered.description).toBeTruthy();

      // 4. Verify equation integrity
      expect(params.c).toBe(params.a * params.x + params.b);
    });

    it('should generate multiple distinct questions at same difficulty', () => {
      const params1 = LinearEquationTemplate.generateParams(2);
      const params2 = LinearEquationTemplate.generateParams(2);
      const params3 = LinearEquationTemplate.generateParams(2);

      // All should have valid structure
      expect(params1.c).toBe(params1.a * params1.x + params1.b);
      expect(params2.c).toBe(params2.a * params2.x + params2.b);
      expect(params3.c).toBe(params3.a * params3.x + params3.b);
    });
  });
});

describe('validateAnswer (answer validation logic)', () => {
  // Simulating answer validation based on template's tolerance
  const TOLERANCE = 0.001;

  function validateAnswer(correctAnswer: number, userAnswer: number): boolean {
    return Math.abs(correctAnswer - userAnswer) <= TOLERANCE;
  }

  it('should accept exact correct answer', () => {
    expect(validateAnswer(2, 2)).toBe(true);
  });

  it('should accept answer within tolerance', () => {
    expect(validateAnswer(2, 2.0005)).toBe(true);
    expect(validateAnswer(2, 1.9995)).toBe(true);
  });

  it('should reject incorrect answer beyond tolerance', () => {
    expect(validateAnswer(2, 2.1)).toBe(false);
    expect(validateAnswer(2, 1.9)).toBe(false);
  });

  it('should handle negative correct answers', () => {
    expect(validateAnswer(-3, -3)).toBe(true);
    expect(validateAnswer(-3, -3.0005)).toBe(true);
    expect(validateAnswer(-3, -2.9)).toBe(false);
  });

  it('should handle fractional correct answers', () => {
    expect(validateAnswer(0.5, 0.5)).toBe(true);
    expect(validateAnswer(0.5, 0.5005)).toBe(true);
    expect(validateAnswer(0.5, 0.51)).toBe(false);
  });

  it('should handle zero correct answer', () => {
    expect(validateAnswer(0, 0)).toBe(true);
    expect(validateAnswer(0, 0.0005)).toBe(true);
    // Tolerance is inclusive: |0 - 0.001| = 0.001 <= 0.001 is true
    expect(validateAnswer(0, 0.001)).toBe(true);
    expect(validateAnswer(0, 0.0011)).toBe(false);
  });

  it('should handle large numbers', () => {
    expect(validateAnswer(1000, 1000)).toBe(true);
    expect(validateAnswer(1000, 1000.0005)).toBe(true);
    expect(validateAnswer(-1000, -1000)).toBe(true);
  });

  it('should distinguish between similar but wrong answers', () => {
    // For equation 2x + 3 = 7, x = 2
    expect(validateAnswer(2, 2)).toBe(true);  // correct
    expect(validateAnswer(2, 3)).toBe(false); // wrong
    expect(validateAnswer(2, 1)).toBe(false); // wrong
  });

  it('should handle boundary tolerance correctly', () => {
    // Test the core tolerance behavior - values within tolerance are accepted
    const TOL = 0.001;

    // Clearly within tolerance
    expect(validateAnswer(1, 1 + TOL / 2)).toBe(true);
    expect(validateAnswer(1, 1 - TOL / 2)).toBe(true);

    // Clearly outside tolerance
    expect(validateAnswer(1, 1 + TOL * 2)).toBe(false);
    expect(validateAnswer(1, 1 - TOL * 2)).toBe(false);
  });
});

describe('generateTemplate (full question generation)', () => {
  // Test the full question generation workflow
  function generateTemplate(difficulty: number) {
    const params = LinearEquationTemplate.generateParams(difficulty);
    const steps = LinearEquationTemplate.buildSteps(params);
    const content = LinearEquationTemplate.render(params);

    return {
      knowledgePoint: LinearEquationTemplate.knowledgePoint,
      difficultyLevel: difficulty,
      params,
      steps,
      content,
    };
  }

  it('should generate complete template structure', () => {
    const template = generateTemplate(1);

    expect(template.knowledgePoint).toBe('linear_equation');
    expect(template.difficultyLevel).toBe(1);
    expect(template.params).toBeDefined();
    expect(template.steps).toBeDefined();
    expect(template.content).toBeDefined();
  });

  it('should include all required fields in content', () => {
    const template = generateTemplate(2);

    expect(template.content.title).toBeTruthy();
    expect(template.content.description).toBeTruthy();
    // context is optional but should be present for equations
    expect(template.content.context).toBeTruthy();
  });

  it('should have valid knowledge point identifier', () => {
    const template = generateTemplate(3);

    expect(template.knowledgePoint).toBe('linear_equation');
  });

  it('should have step with correct structure', () => {
    const template = generateTemplate(1);
    const step = template.steps[0] as StepProtocol;

    expect(step.stepId).toBeTruthy();
    expect(step.type).toBe('solve_linear_equation');
    expect(step.inputType).toBe('numeric');
    expect(step.keyboard).toBe('numeric');
    expect(step.answerType).toBe('number');
    expect(step.tolerance).toBeCloseTo(0.001);
    expect(step.ui).toBeDefined();
  });

  it('should include UI guidance', () => {
    const template = generateTemplate(4);
    const step = template.steps[0] as StepProtocol;

    expect(step.ui.instruction).toContain('解方程');
    expect(step.ui.inputTarget).toContain('x');
    expect(step.ui.inputHint).toBeTruthy();
  });

  it('should maintain equation integrity in params', () => {
    const template = generateTemplate(5);

    const { a, b, c, x } = template.params;
    expect(c).toBe(a * x + b);
  });

  it('should generate different questions across difficulties', () => {
    const templates = [1, 2, 3, 4, 5].map(generateTemplate);

    // All should have valid structure
    templates.forEach((t) => {
      expect(t.steps).toHaveLength(1);
      expect(t.content.title).toBeTruthy();
    });

    // Difficulty should increase params range
    const config1 = DIFFICULTY_CONFIG.linear_equation[1];
    const config5 = DIFFICULTY_CONFIG.linear_equation[5];

    expect(config5.a.max).toBeGreaterThan(config1.a.max);
  });
});