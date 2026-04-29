import { ComplexitySpec, ExprAST, GeneratedQuestionData } from './types';

/**
 * ASTEngine - Generates abstract syntax trees for math questions
 *
 * Handles complex structures: nested, multi_equation, constraint_chain
 * Supports depth-based generation and distraction levels
 */
export class ASTEngine {
  /**
   * Generate an AST based on the complexity specification
   */
  generate(spec: ComplexitySpec): GeneratedQuestionData {
    let ast: ExprAST;

    switch (spec.structure) {
      case 'nested':
        ast = this.generateNested(spec.depth);
        break;
      case 'multi_equation':
        ast = this.generateMultiEquation(spec.depth);
        break;
      case 'constraint_chain':
        ast = this.generateConstraintChain(spec.depth);
        break;
      case 'linear':
        ast = this.generateLinear(spec.depth);
        break;
      default:
        throw new Error(`Unknown structure: ${spec.structure}`);
    }

    ast = this.addDistraction(ast, spec.distraction);
    const params = this.solveAndSample(ast, spec);

    return { ast, params, spec };
  }

  /**
   * Generate linear structure: ax + b form
   */
  private generateLinear(depth: number): ExprAST {
    if (depth === 1) {
      return {
        type: 'add',
        left: { type: 'mul', left: { type: 'const', value: 1 }, right: { type: 'var', name: 'x' } },
        right: { type: 'const', value: 0 },
      };
    }

    // For depth > 1, create a subtraction expression
    return {
      type: 'sub',
      left: {
        type: 'add',
        left: { type: 'mul', left: { type: 'const', value: 1 }, right: { type: 'var', name: 'x' } },
        right: { type: 'const', value: 0 },
      },
      right: {
        type: 'add',
        left: { type: 'mul', left: { type: 'const', value: 1 }, right: { type: 'var', name: 'x' } },
        right: { type: 'const', value: 0 },
      },
    };
  }

  /**
   * Generate nested structure: a(b(x + c) + d) form
   * Creates depth levels of nesting with increasing coefficients
   */
  private generateNested(depth: number): ExprAST {
    let expr: ExprAST = { type: 'var', name: 'x' };

    for (let i = 0; i < depth; i++) {
      const a = 2 + i;
      const b = 1 + i;
      expr = {
        type: 'add',
        left: { type: 'mul', left: { type: 'const', value: a }, right: expr },
        right: { type: 'const', value: b },
      };
    }

    return { type: 'group', expr };
  }

  /**
   * Generate multi_equation structure: ax = b form
   * Uses linear generation with adjusted depth
   */
  private generateMultiEquation(depth: number): ExprAST {
    return this.generateLinear(Math.max(1, depth - 1));
  }

  /**
   * Generate constraint_chain structure: x + offset form
   * Creates a chain of addition operations
   */
  private generateConstraintChain(depth: number): ExprAST {
    let expr: ExprAST = { type: 'var', name: 'x' };

    for (let i = 0; i < depth - 1; i++) {
      expr = {
        type: 'add',
        left: expr,
        right: { type: 'const', value: 1 },
      };
    }

    return expr;
  }

  /**
   * Add distraction to the AST based on level
   * Level 0: no distraction
   * Level 1: pass through
   * Level 2: add +0 term
   * Level 3: add x*0 term
   */
  private addDistraction(ast: ExprAST, level: number): ExprAST {
    if (level === 0) return ast;

    switch (level) {
      case 1:
        return ast;
      case 2:
        return {
          type: 'add',
          left: ast,
          right: { type: 'const', value: 0 },
        };
      case 3:
        return {
          type: 'add',
          left: ast,
          right: {
            type: 'mul',
            left: { type: 'var', name: 'x' },
            right: { type: 'const', value: 0 },
          },
        };
      default:
        return ast;
    }
  }

  /**
   * Solve the AST and sample parameter values
   * For nested: a(b(x + c) + d) = e → simplified sampling
   */
  private solveAndSample(ast: ExprAST, spec: ComplexitySpec): Record<string, number> {
    // Default coefficients for nested expressions
    const a = 2;
    const b = 3;
    const c = 1;
    const d = 2;
    const e = a * (b * (c + 1) + d); // x=1
    const x = 1;

    return { a, b, c, d, e, x };
  }
}
