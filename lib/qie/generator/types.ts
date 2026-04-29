/**
 * ComplexitySpec - 三轴复杂性定义
 */
export interface ComplexitySpec {
  structure: StructureType;
  depth: DepthLevel;
  distraction: DistractionLevel;
}

export type StructureType = 'linear' | 'nested' | 'multi_equation' | 'constraint_chain';
export type DepthLevel = 1 | 2 | 3 | 4;
export type DistractionLevel = 0 | 1 | 2 | 3;

/**
 * 表达式 AST 类型
 */
export type ExprAST =
  | { type: 'const'; value: number }
  | { type: 'var'; name: string }
  | { type: 'add'; left: ExprAST; right: ExprAST }
  | { type: 'sub'; left: ExprAST; right: ExprAST }
  | { type: 'mul'; left: ExprAST; right: ExprAST }
  | { type: 'div'; left: ExprAST; right: ExprAST }
  | { type: 'neg'; expr: ExprAST }
  | { type: 'group'; expr: ExprAST }
  // 扩展类型用于 ASTEngine
  | { type: 'linear_simple'; params: { a: number; b: number } }
  | { type: 'linear_both_sides'; params: { a: number; b: number; c: number; d: number } }
  | { type: 'linear_nested'; params: { a: number; b: number; c: number } }
  | { type: 'linear_double_nested'; params: { a: number; b: number; c: number; d: number } }
  | { type: 'nested'; depth: number; layers: number[]; params: Record<string, number> }
  | { type: 'multi_equation'; depth: number; equations: Array<{ coeffs: Record<string, number>; rhs: number }> }
  | { type: 'constraint_chain'; depth: number; operations: Array<{ op: string; value: number }> }
  | { type: 'irrelevant'; level: number }  // DISTRACTION marker
  | { type: 'unknown'; [key: string]: unknown };

/**
 * 题目模板
 */
export interface QuestionTemplate {
  template: string;
  answer: string;
  params: ParamSpec;
  constraint?: string;
  hint?: string;
  transforms?: string[];
  perturbations?: string[];
}

export interface ParamSpec {
  [key: string]: string;
}

/**
 * 生成结果
 */
export interface GeneratedQuestionData {
  ast?: ExprAST;
  template?: string;
  params: Record<string, number>;
  spec: ComplexitySpec;
  answer?: string;
}

/**
 * 渲染输入
 */
export type RenderInput =
  | { type: 'ast'; ast: ExprAST; params: Record<string, number>; spec?: ComplexitySpec }
  | { type: 'template'; template: string; params: Record<string, number>; spec?: ComplexitySpec };

/**
 * 验证函数
 */
export function validateComplexitySpec(spec: Partial<ComplexitySpec>): spec is ComplexitySpec {
  const validStructures: StructureType[] = ['linear', 'nested', 'multi_equation', 'constraint_chain'];
  const validDepths: DepthLevel[] = [1, 2, 3, 4];
  const validDistractions: DistractionLevel[] = [0, 1, 2, 3];

  return (
    validStructures.includes(spec.structure as StructureType) &&
    validDepths.includes(spec.depth as DepthLevel) &&
    validDistractions.includes(spec.distraction as DistractionLevel)
  );
}