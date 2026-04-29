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

    const answer = this.computeAnswer(template, params);

    return {
      template: template.template,
      params: { ...params, ...answer },
      spec,
    };
  }

  private computeAnswer(
    template: QuestionTemplate,
    params: Record<string, number>
  ): Record<string, number> {
    // a(x + b) = c → x = c/a - b
    if (template.template.includes('(x {')) {
      const { a, b, c } = params as { a: number; b: number; c: number };
      return { x: c / a - b };
    }

    // ax + b = cx + d → x = (d - b) / (a - c)
    if (template.template.includes('= cx')) {
      const { a, b, c: c2, e: d } = params as { a: number; b: number; c: number; e: number; d: number };
      return { x: (d - b) / (a - c2) };
    }

    // ax + b = c → x = (c - b) / a
    const { a, b, c } = params as { a: number; b: number; c: number };
    return { x: (c - b) / a };
  }
}
