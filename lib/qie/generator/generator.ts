import { ComplexitySpec, RenderInput } from './types';
import { GeneratorController } from './controller';
import { MockLLMRenderer } from './__tests__/mocks';

export interface GeneratedQuestionResult {
  id: string;
  batchId: string;
  type: string;
  content: string;
  answer: string;
  hint?: string;
  complexitySpec: string;
  engine: string;
  promotionStatus: string;
}

/**
 * QuestionGenerator - Main entry point for question generation
 *
 * Integrates Controller (routing), Engine (generation), and Renderer (text output)
 * Provides high-level API for generating and persisting questions
 */
export class QuestionGenerator {
  private controller: GeneratorController;
  private renderer: MockLLMRenderer;

  constructor() {
    this.controller = new GeneratorController();
    this.renderer = new MockLLMRenderer();
  }

  /**
   * Generate a single question based on complexity spec
   */
  async generate(spec: ComplexitySpec): Promise<GeneratedQuestionResult> {
    const engine = this.controller.decide(spec);
    const data = engine.generate(spec);

    const renderInput: RenderInput = data.template
      ? {
          type: 'template',
          template: data.template,
          params: data.params,
          spec,
        }
      : {
          type: 'ast',
          ast: data.ast!,
          params: data.params,
          spec,
        };

    const content = await this.renderer.render(renderInput);

    const answer = this.extractAnswer(data);

    return {
      id: '',
      batchId: '',
      type: 'calculation',
      content: JSON.stringify({ text: content }),
      answer,
      complexitySpec: JSON.stringify(spec),
      engine: data.template ? 'template' : 'ast',
      promotionStatus: 'PENDING',
    };
  }

  /**
   * Generate a batch of questions
   */
  async generateBatch(
    specs: ComplexitySpec[],
    batchId: string
  ): Promise<GeneratedQuestionResult[]> {
    const results: GeneratedQuestionResult[] = [];

    for (const spec of specs) {
      const result = await this.generate(spec);
      result.batchId = batchId;
      results.push(result);
    }

    return results;
  }

  /**
   * Generate and persist to database
   */
  async generateAndSave(
    spec: ComplexitySpec,
    batchId: string
  ): Promise<GeneratedQuestionResult> {
    const result = await this.generate(spec);
    result.batchId = batchId;

    // Dynamic import to avoid circular dependency issues
    const { prisma } = await import('@/lib/prisma');

    const saved = await prisma.generatedQuestion.create({
      data: {
        type: result.type,
        content: result.content,
        answer: result.answer,
        hint: result.hint,
        complexitySpec: result.complexitySpec,
        engine: result.engine,
        promotionStatus: result.promotionStatus,
        batchId: result.batchId,
      },
    });

    return { ...result, id: saved.id };
  }

  /**
   * Extract answer from generated data
   */
  private extractAnswer(data: { params: Record<string, number> }): string {
    if (data.params.x !== undefined) {
      return `x = ${data.params.x}`;
    }
    return 'x = ?';
  }
}
