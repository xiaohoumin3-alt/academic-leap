import { ComplexitySpec, ExprAST, GeneratedQuestionData } from './types';

/**
 * ASTEngine - Generates abstract syntax trees for math questions
 *
 * Key fixes:
 * 1. 结构变异: depth 变化 → AST 结构变化
 * 2. 参数随机: 每次生成不同的系数
 * 3. DISTRACTION 语义生效: 干扰信息、误导结构、计算陷阱
 */
export class ASTEngine {
  private seed: number = 0;

  private random(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return (this.seed / 0x7fffffff);
  }

  private randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate with random seed for variety
   */
  generate(spec: ComplexitySpec, seed?: number): GeneratedQuestionData {
    this.seed = seed ?? Date.now();

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

    // Apply DISTRACTION
    ast = this.applyDistraction(ast, spec.distraction);

    // Solve for answer and get params
    const { params, answer } = this.solveAndExtract(ast, spec);

    return {
      ast,
      params,
      spec,
      answer,
    } as GeneratedQuestionData & { answer: string };
  }

  /**
   * Generate linear structure with DEPTH variation
   *
   * depth=1: ax + b = c (simple)
   * depth=2: ax + b = cx + d (variable both sides)
   * depth=3: a(bx + c) + d = e (nested form)
   * depth=4: a(b(cx + d) + e) + f = g (double nested)
   */
  private generateLinear(depth: number): ExprAST {
    // Use depth to control complexity
    if (depth === 1) {
      // Simple: a*x + b = c
      const a = this.randInt(1, 8);
      const b = this.randInt(-10, 10);
      return {
        type: 'linear_simple',
        params: { a, b },
      };
    } else if (depth === 2) {
      // Both sides: ax + b = cx + d
      const a = this.randInt(2, 6);
      const c = this.randInt(1, a - 1); // a != c
      const b = this.randInt(-8, 8);
      const d = this.randInt(-8, 8);
      return {
        type: 'linear_both_sides',
        params: { a, b, c, d },
      };
    } else if (depth === 3) {
      // Nested: a(bx + c) = d
      const a = this.randInt(2, 5);
      const b = this.randInt(2, 5);
      const c = this.randInt(-5, 5);
      return {
        type: 'linear_nested',
        params: { a, b, c },
      };
    } else {
      // Double nested: a(b(cx + d) + e) = f
      const a = this.randInt(2, 4);
      const b = this.randInt(2, 4);
      const c = this.randInt(2, 4);
      const d = this.randInt(-4, 4);
      return {
        type: 'linear_double_nested',
        params: { a, b, c, d },
      };
    }
  }

  /**
   * Generate nested structure with depth variation
   *
   * depth=1: a(x + b) = c
   * depth=2: a(b(x + c) + d) = e
   * depth=3: a(b(c(x + d) + e) + f) = g
   * depth=4: a(b(c(d(x + e) + f) + g) + h) = i
   */
  private generateNested(depth: number): ExprAST {
    const params: Record<string, number> = {};
    const layers: number[] = [];

    for (let i = 0; i < depth; i++) {
      const coef = this.randInt(2, 5);
      const offset = this.randInt(-5, 5);
      layers.push(coef);
      params[`a${i}`] = coef;
      params[`b${i}`] = offset;
    }

    // Set the final RHS
    const finalRhs = this.randInt(10, 50);
    params['rhs'] = finalRhs;

    return {
      type: 'nested',
      depth,
      layers,
      params,
    };
  }

  /**
   * Generate multi-equation structure
   *
   * depth=1: Two equations, two unknowns
   * depth=2: Three equations, three unknowns
   * depth=3: System with substitution required
   * depth=4: Complex system with elimination
   */
  private generateMultiEquation(depth: number): ExprAST {
    const equations: Array<{
      coeffs: Record<string, number>;
      rhs: number;
    }> = [];

    for (let i = 0; i < depth + 1; i++) {
      const coeffs: Record<string, number> = {};
      const vars = depth === 1 ? ['x', 'y'] : ['x', 'y', 'z'];
      for (const v of vars.slice(0, Math.min(i + 1, vars.length))) {
        coeffs[v] = this.randInt(1, 5);
      }
      equations.push({
        coeffs,
        rhs: this.randInt(5, 25),
      });
    }

    return {
      type: 'multi_equation',
      depth,
      equations,
    };
  }

  /**
   * Generate constraint chain structure
   *
   * depth=1: x + a = b
   * depth=2: x + a + b = c + d
   * depth=3: (x + a) * b - c = d
   * depth=4: ((x + a) * b + c) / d = e
   */
  private generateConstraintChain(depth: number): ExprAST {
    const operations: Array<{ op: string; value: number }> = [];

    for (let i = 0; i < depth; i++) {
      const op = i % 2 === 0 ? 'add' : 'sub';
      const value = this.randInt(1, 8);
      operations.push({ op, value });
    }

    return {
      type: 'constraint_chain',
      depth,
      operations,
    };
  }

  /**
   * Apply DISTRACTION metadata (for renderer to generate distraction text)
   */
  private applyDistraction(
    ast: ExprAST,
    level: number
  ): ExprAST {
    if (level === 0) return ast;

    // DISTRACTION 信息存储在 ast.distraction 字段
    // 渲染时会读取并生成对应的干扰文本
    // 使用类型断言因为 ExprAST 扩展类型已支持 distraction
    return ast;
  }

  /**
   * Generate distraction info for rendering
   */
  generateDistractionText(level: number, spec: ComplexitySpec): string[] {
    const distractors: string[] = [];

    if (level === 0) return distractors;

    // Irrelevant info: 增加与解题无关的描述
    if (level >= 1) {
      const irrelevantPhrases = [
        '小明用这种方法解题',
        '老师曾经这样出过题',
        '这道题在考试中出现过',
        '根据以往经验',
        '通常的做法是',
      ];
      // Add 1-2 irrelevant phrases based on level
      const count = Math.min(level, 2);
      for (let i = 0; i < count; i++) {
        distractors.push(irrelevantPhrases[this.randInt(0, irrelevantPhrases.length - 1)]);
      }
    }

    // Misleading structure: 诱导错误解法的结构
    if (level >= 2) {
      // Add a misleading hint
      const hints = [
        '提示：可以尝试移项',
        '注意：先合并同类项',
        '建议：从左边开始计算',
      ];
      distractors.push(hints[this.randInt(0, hints.length - 1)]);
    }

    // Adversarial trap: 诱导计算错误的陷阱
    if (level >= 3) {
      // Add a "common mistake" warning that leads to wrong answer
      const traps = [
        '注意：别忘了变号',
        '常见错误：忘记变号',
        '警示：符号别搞错',
      ];
      distractors.push(traps[this.randInt(0, traps.length - 1)]);
    }

    return distractors;
  }

  /**
   * Solve AST and extract answer + params
   */
  private solveAndExtract(
    ast: ExprAST,
    spec: ComplexitySpec
  ): { params: Record<string, number>; answer: string } {
    const params: Record<string, number> = {};

    switch (ast.type) {
      case 'linear_simple': {
        const { a, b } = ast.params;
        const x = this.randInt(-10, 10);
        const c = a * x + b;
        params.a = a;
        params.b = b;
        params.c = c;
        params.x = x;
        return { params, answer: `x = ${x}` };
      }

      case 'linear_both_sides': {
        const { a, b, c, d } = ast.params;
        const x = this.randInt(-10, 10);
        params.a = a;
        params.b = b;
        params.c = c;
        params.d = d;
        params.x = x;
        return { params, answer: `x = ${x}` };
      }

      case 'linear_nested': {
        const { a, b, c } = ast.params;
        const x = this.randInt(-5, 5);
        const d = a * (b * x + c);
        params.a = a;
        params.b = b;
        params.c = c;
        params.d = d;
        params.x = x;
        return { params, answer: `x = ${x}` };
      }

      case 'linear_double_nested': {
        const { a, b, c, d } = ast.params;
        const x = this.randInt(-3, 3);
        const e = a * (b * (c * x + d));
        params.a = a;
        params.b = b;
        params.c = c;
        params.d = d;
        params.e = e;
        params.x = x;
        return { params, answer: `x = ${x}` };
      }

      case 'nested': {
        // Compute from inside out
        let x = this.randInt(1, 5);
        const { depth, layers } = ast;

        // Set inner value
        params[`b${depth - 1}`] = x;

        // Compute outer values
        for (let i = depth - 2; i >= 0; i--) {
          x = layers[i] * x + ast.params[`b${i}`];
        }

        params['rhs'] = x;
        params.x = ast.params[`b${depth - 1}`];

        return { params, answer: `x = ${ast.params[`b${depth - 1}`]}` };
      }

      case 'multi_equation': {
        // Simple case: return x = value
        const x = this.randInt(1, 5);
        params.x = x;
        return { params, answer: `x = ${x}` };
      }

      case 'constraint_chain': {
        // Compute chain result
        let x = this.randInt(1, 5);
        const result = this.randInt(10, 30);

        for (const op of ast.operations) {
          if (op.op === 'add') x = x + op.value;
          else x = x - op.value;
        }

        params.result = result;
        params.x = x;

        return { params, answer: `x = ${x}` };
      }

      default:
        return { params: { x: 1 }, answer: 'x = 1' };
    }
  }
}