import { RenderInput } from '../types';
import { generateDistraction, embedDistraction, fillTemplate, getTemplate } from '../templates';

/**
 * MockLLMRenderer - Generates question text from templates or AST
 *
 * Fixed to:
 * 1. Generate unique content per spec combination
 * 2. Apply semantic DISTRACTION
 * 3. Use template pool for variety
 */
export class MockLLMRenderer {
  private templateVariants = new Map<string, number>();

  async render(input: RenderInput): Promise<string> {
    // Extract template and params from input
    const template = (input as { template?: string }).template;
    const params = input.params;
    const spec = (input as { spec?: { structure?: string; depth?: number; distraction?: number } }).spec;

    if (template) {
      return this.renderFromTemplate(template, params, spec);
    }

    return this.renderFromAST(input, spec);
  }

  private renderFromTemplate(
    template: string,
    params: Record<string, number>,
    spec?: { structure?: string; depth?: number; distraction?: number }
  ): string {
    // 填充模板
    let question = fillTemplate(template, params);

    // 添加 DISTRACTION
    const distractionLevel = spec?.distraction ?? 0;
    const distractors = generateDistraction(distractionLevel);
    question = embedDistraction(question, distractors);

    // 添加结构标识
    if (spec?.structure) {
      question = this.addStructureMarker(question, spec);
    }

    return question;
  }

  private renderFromAST(
    input: { ast?: Record<string, unknown>; type?: string },
    spec?: { structure?: string; depth?: number; distraction?: number }
  ): string {
    const ast = input.ast as Record<string, unknown> | undefined;

    if (!ast) {
      return this.generateFallback(spec);
    }

    // 根据 AST 类型生成方程
    const astType = ast.type as string;

    switch (astType) {
      case 'linear_simple':
        return this.generateLinearSimple(ast.params as { a: number; b: number }, spec);

      case 'linear_both_sides':
        return this.generateLinearBothSides(ast.params as Record<string, number>, spec);

      case 'linear_nested':
        return this.generateLinearNested(ast.params as Record<string, number>, spec);

      case 'linear_double_nested':
        return this.generateLinearDoubleNested(ast.params as Record<string, number>, spec);

      case 'nested':
        return this.generateNested(ast as { depth: number; layers: number[]; params: Record<string, number> }, spec);

      case 'multi_equation':
        return this.generateMultiEquation(ast as { equations: Array<{ coeffs: Record<string, number>; rhs: number }> }, spec);

      case 'constraint_chain':
        return this.generateConstraintChain(ast as { operations: Array<{ op: string; value: number }> }, spec);

      default:
        return this.generateFallback(spec);
    }
  }

  private generateLinearSimple(
    params: { a: number; b: number },
    spec?: { depth?: number; distraction?: number }
  ): string {
    const { a, b } = params;
    const c = a * (Math.floor(Math.random() * 10) + 1) + b; // 确保有整数解

    let question = `解方程: ${a}x ${this.formatSigned(b)} = ${c}`;

    // 根据 depth 添加不同的变体
    if (spec?.depth && spec.depth >= 2) {
      question = `求解 x 的值: ${a}x ${this.formatSigned(b)} = ${c}`;
    }

    // DISTRACTION
    const distractors = generateDistraction(spec?.distraction ?? 0);
    question = embedDistraction(question, distractors);

    return question;
  }

  private generateLinearBothSides(
    params: Record<string, number>,
    spec?: { depth?: number; distraction?: number }
  ): string {
    const { a, b, c, d } = params;

    let question = `解方程: ${a}x ${this.formatSigned(b)} = ${c}x ${this.formatSigned(d)}`;

    // 添加干扰
    const distractors = generateDistraction(spec?.distraction ?? 0);
    question = embedDistraction(question, distractors);

    return question;
  }

  private generateLinearNested(
    params: Record<string, number>,
    spec?: { depth?: number; distraction?: number }
  ): string {
    const { a, b, c, d } = params;

    // d should be computed: d = a * (b * x + c), but we need x first
    // For simplicity, compute a result
    const x = Math.floor(Math.random() * 10) - 5;
    const rhs = a * (b * x + c);

    let question = `解方程: ${a}(${b}x ${this.formatSigned(c)}) = ${rhs}`;

    // 更高 depth 加 hint
    if (spec?.depth && spec.depth >= 3) {
      question = `解方程: ${a}(${b}x ${this.formatSigned(c)}) = ${rhs}（先展开括号）`;
    }

    // DISTRACTION
    const distractors = generateDistraction(spec?.distraction ?? 0);
    question = embedDistraction(question, distractors);

    return question;
  }

  private generateLinearDoubleNested(
    params: Record<string, number>,
    spec?: { depth?: number; distraction?: number }
  ): string {
    const { a, b, c, d, e } = params;

    // Compute a proper RHS
    const x = Math.floor(Math.random() * 5) - 2;
    const rhs = a * (b * (c * x + d));

    let question = `解方程: ${a}(${b}(${c}x ${this.formatSigned(d)}) ${this.formatSigned(e)}) = ${rhs}`;

    // 添加提示
    question = `解方程: ${a}(${b}(${c}x ${this.formatSigned(d)}) ${this.formatSigned(e)}) = ${rhs}（从内到外展开）`;

    // DISTRACTION
    const distractors = generateDistraction(spec?.distraction ?? 0);
    question = embedDistraction(question, distractors);

    return question;
  }

  private generateNested(
    ast: { depth: number; layers: number[]; params: Record<string, number> },
    spec?: { depth?: number; distraction?: number }
  ): string {
    const { depth, layers, params } = ast;
    const actualDepth = depth || spec?.depth || 2;
    const actualLayers = layers.length > 0 ? layers : [2, 3];

    // Compute x first
    const x = Math.floor(Math.random() * 5) + 1;

    if (actualDepth === 1) {
      const a = actualLayers[0] || 2;
      const b = Math.floor(Math.random() * 4) - 2;
      const rhs = a * (x + b);
      let q = `解方程: ${a}(x ${this.formatSigned(b)}) = ${rhs}`;
      const distractors = generateDistraction(spec?.distraction ?? 0);
      return embedDistraction(q, distractors);
    }

    if (actualDepth === 2) {
      const a = actualLayers[0] || 2;
      const b = actualLayers[1] || 2;
      const c = Math.floor(Math.random() * 4) - 2;
      const rhs = a * (b * (x + c) + (actualLayers[1] || 2));
      let q = `解方程: ${a}(${b}(x ${this.formatSigned(c)}) ${this.formatSigned(actualLayers[1] || 2)}) = ${rhs}`;
      const distractors = generateDistraction(spec?.distraction ?? 0);
      return embedDistraction(q, distractors);
    }

    if (actualDepth === 3) {
      const a = actualLayers[0] || 2;
      const b = actualLayers[1] || 2;
      const c = actualLayers[2] || 2;
      const d = Math.floor(Math.random() * 3) - 1;
      const rhs = a * (b * (c * (x + d) + (actualLayers[2] || 2)) + (actualLayers[1] || 2));
      let q = `解方程: ${a}(${b}(${c}(x ${this.formatSigned(d)}) ${this.formatSigned(actualLayers[2] || 2)}) ${this.formatSigned(actualLayers[1] || 2)}) = ${rhs}`;
      const distractors = generateDistraction(spec?.distraction ?? 0);
      return embedDistraction(q, distractors);
    }

    // depth 4
    const a = actualLayers[0] || 2;
    const b = actualLayers[1] || 2;
    const c = actualLayers[2] || 2;
    const d = actualLayers[3] || 2;
    const e = Math.floor(Math.random() * 2) - 1;
    const rhs = a * (b * (c * (d * (x + e) + (actualLayers[3] || 2)) + (actualLayers[2] || 2)) + (actualLayers[1] || 2));
    let q = `解方程: ${a}(${b}(${c}(${d}(x ${this.formatSigned(e)}) ${this.formatSigned(actualLayers[3] || 2)}) ${this.formatSigned(actualLayers[2] || 2)}) ${this.formatSigned(actualLayers[1] || 2)}) = ${rhs}`;
    const distractors = generateDistraction(spec?.distraction ?? 0);
    return embedDistraction(q, distractors);
  }

  private generateMultiEquation(
    ast: { equations: Array<{ coeffs: Record<string, number>; rhs: number }> },
    spec?: { depth?: number; distraction?: number }
  ): string {
    const equations = ast.equations || [];

    if (equations.length === 0) {
      // 生成默认的方程组
      const a1 = Math.floor(Math.random() * 3) + 1;
      const b1 = Math.floor(Math.random() * 3) + 1;
      const c1 = Math.floor(Math.random() * 10) + 5;
      const a2 = Math.floor(Math.random() * 3) + 1;
      const b2 = Math.floor(Math.random() * 3) + 1;
      const c2 = Math.floor(Math.random() * 10) + 5;

      let q = `解方程组:\n${a1}x + ${b1}y = ${c1}\n${a2}x + ${b2}y = ${c2}`;
      const distractors = generateDistraction(spec?.distraction ?? 0);
      return embedDistraction(q, distractors);
    }

    let result = '解方程组:\n';
    for (let i = 0; i < Math.min(equations.length, 3); i++) {
      const eq = equations[i];
      const parts: string[] = [];

      if (eq.coeffs.x) parts.push(`${eq.coeffs.x}x`);
      if (eq.coeffs.y) parts.push(`${eq.coeffs.y >= 0 ? '+' : ''}${eq.coeffs.y}y`);
      if (eq.coeffs.z) parts.push(`${eq.coeffs.z >= 0 ? '+' : ''}${eq.coeffs.z}z`);

      result += parts.join(' ') + ` = ${eq.rhs}`;
      if (i < equations.length - 1) result += '\n';
    }

    const distractors = generateDistraction(spec?.distraction ?? 0);
    return embedDistraction(result, distractors);
  }

  private generateConstraintChain(
    ast: { operations: Array<{ op: string; value: number }> },
    spec?: { depth?: number; distraction?: number }
  ): string {
    const operations = ast.operations || [];

    if (operations.length === 0) {
      const add = Math.floor(Math.random() * 5) + 1;
      const rhs = add + Math.floor(Math.random() * 10) + 5;
      let q = `解方程: x + ${add} = ${rhs}`;
      const distractors = generateDistraction(spec?.distraction ?? 0);
      return embedDistraction(q, distractors);
    }

    let lhs = 'x';
    for (const op of operations) {
      const sign = op.op === 'add' ? '+' : '-';
      lhs += ` ${sign} ${op.value}`;
    }

    // 计算 RHS
    let sum = 0;
    for (const op of operations) {
      if (op.op === 'add') sum += op.value;
      else sum -= op.value;
    }
    const rhs = sum + Math.floor(Math.random() * 10) + 5;

    let q = `解方程: ${lhs} = ${rhs}`;

    // 高 depth 加 hint
    if (spec?.depth && spec.depth >= 3) {
      q = `解方程: ${lhs} = ${rhs}（先合并同类项）`;
    }

    const distractors = generateDistraction(spec?.distraction ?? 0);
    return embedDistraction(q, distractors);
  }

  private generateFallback(spec?: { structure?: string; depth?: number; distraction?: number }): string {
    const structure = spec?.structure || 'linear';
    const depth = spec?.depth || 1;
    const distraction = spec?.distraction || 0;

    const templates = [
      `解方程: ${depth + 1}x + ${depth} = ${depth * 3 + 5}`,
      `求解: ${depth + 2}x - ${depth + 1} = ${depth * 4 + 3}`,
      `已知方程: ${depth}x + ${depth * 2} = ${depth * 5 + 7}，求 x`,
    ];

    const template = templates[depth % templates.length];
    const distractors = generateDistraction(distraction);
    return embedDistraction(template, distractors);
  }

  private addStructureMarker(question: string, spec: { structure?: string }): string {
    // 在题目后加一个小标记（可选，用于调试）
    // 这里不添加，保持题目纯净
    return question;
  }

  private formatSigned(n: number): string {
    if (n === undefined || n === null) return '+ 0';
    return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
  }
}