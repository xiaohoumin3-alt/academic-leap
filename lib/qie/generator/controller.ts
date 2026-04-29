import { ComplexitySpec } from './types';
import { TemplateEngine } from './template-engine';
import { ASTEngine } from './ast-engine';

export type GeneratorEngine = TemplateEngine | ASTEngine;

/**
 * GeneratorController - 路由选择
 *
 * 决定使用 TemplateEngine 还是 ASTEngine
 *
 * 约束: 输出必须符合 ComplexitySpec，Engine 不引入额外复杂度
 */
export class GeneratorController {
  /**
   * 根据 ComplexitySpec 决定使用哪个 Engine
   *
   * 规则: STRUCTURE=linear AND DEPTH≤2 AND distraction=0 → TemplateEngine
   *       ELSE → ASTEngine
   *
   * 注意: distraction 由 ASTEngine 处理，所以 distraction>0 必须走 ASTEngine
   */
  decide(spec: ComplexitySpec): GeneratorEngine {
    if (spec.structure === 'linear' && spec.depth <= 2 && spec.distraction === 0) {
      return new TemplateEngine();
    }
    return new ASTEngine();
  }
}
