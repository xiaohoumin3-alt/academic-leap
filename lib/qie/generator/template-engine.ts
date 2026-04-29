import {
  ComplexitySpec,
  GeneratedQuestionData,
  QuestionTemplate,
} from './types';
import {
  getTemplate,
  sampleWithConstraint,
} from './templates';

export class TemplateEngine {
  generate(spec: ComplexitySpec): GeneratedQuestionData {
    const template = getTemplate(spec);

    if (!template) {
      throw new Error(`No template found for spec: ${JSON.stringify(spec)}`);
    }

    const params = sampleWithConstraint(template);

    if (!params) {
      throw new Error(`Failed to sample params for spec: ${JSON.stringify(spec)}`);
    }

    const answer = this.computeAnswer(spec, params);

    return {
      template: template.template,
      params: { ...params, ...answer },
      spec,
    };
  }

  private computeAnswer(
    spec: ComplexitySpec,
    params: Record<string, number>
  ): Record<string, number> {
    // nested_2_0: a(x + b) = c → x = c/a - b
    if (spec.structure === 'nested' && spec.depth === 2) {
      const { a, b, c } = params as { a: number; b: number; c: number };
      return { x: c / a - b };
    }

    // linear_2_0: ax + b = cx + d → x = (d - b) / (a - c)
    if (spec.structure === 'linear' && spec.depth === 2) {
      const { a, b, c, d } = params as { a: number; b: number; c: number; d: number };
      return { x: (d - b) / (a - c) };
    }

    // linear_1_*: ax + b = c → x = (c - b) / a
    const { a, b, c } = params as { a: number; b: number; c: number };
    return { x: (c - b) / a };
  }
}
