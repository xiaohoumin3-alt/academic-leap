import type { GeneratedTemplate, ValidationResult } from './types';
import { LLMClient } from './utils/llm-client';
import {
  buildMathValidationPrompt,
  buildPedagogyValidationPrompt,
  parseValidationResponse,
} from './prompts/validation';

export class TemplateValidator {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async validateMath(
    template: GeneratedTemplate,
    templateId: string
  ): Promise<{ passed: boolean; issues: string[]; confidence: number }> {
    const prompt = buildMathValidationPrompt(template);
    const response = await this.llm.generate(prompt, { responseFormat: 'json' });
    const parsed = parseValidationResponse(response.content);

    if (!parsed) {
      return {
        passed: false,
        issues: ['Failed to parse validation response'],
        confidence: 0,
      };
    }

    return {
      passed: parsed.passed,
      issues: parsed.issues,
      confidence: parsed.confidence ?? 0.5,
    };
  }

  async validatePedagogy(
    template: GeneratedTemplate,
    context: { knowledgePoint: string; grade: number }
  ): Promise<{ passed: boolean; issues: string[]; score: number }> {
    const prompt = buildPedagogyValidationPrompt(template, context);
    const response = await this.llm.generate(prompt, { responseFormat: 'json' });
    const parsed = parseValidationResponse(response.content);

    if (!parsed) {
      return {
        passed: false,
        issues: ['Failed to parse validation response'],
        score: 0,
      };
    }

    return {
      passed: parsed.passed,
      issues: parsed.issues,
      score: parsed.score ?? 50,
    };
  }

  async validate(
    template: GeneratedTemplate,
    context: { knowledgePoint: string; grade: number }
  ): Promise<ValidationResult> {
    const templateId = template.name;

    const [mathResult, pedagogyResult] = await Promise.all([
      this.validateMath(template, templateId),
      this.validatePedagogy(template, context),
    ]);

    const mathScore = mathResult.passed ? 100 : 0;
    const overallScore = Math.round(
      mathScore * 0.4 +
      pedagogyResult.score * 0.3 +
      (100 - pedagogyResult.issues.length * 10) * 0.3
    );

    let recommendation: 'approve' | 'review' | 'reject';
    if (!mathResult.passed) {
      recommendation = 'reject';
    } else if (overallScore >= 90) {
      recommendation = 'approve';
    } else if (overallScore >= 75) {
      recommendation = 'review';
    } else {
      recommendation = 'reject';
    }

    return {
      templateId,
      mathCorrectness: {
        passed: mathResult.passed,
        issues: mathResult.issues,
        confidence: mathResult.confidence,
      },
      pedagogyQuality: {
        passed: pedagogyResult.passed,
        issues: pedagogyResult.issues,
        score: pedagogyResult.score,
      },
      overallScore,
      recommendation,
    };
  }

  async validateBatch(
    templates: GeneratedTemplate[],
    context: { knowledgePoint: string; grade: number }
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(
      templates.map((template) => this.validate(template, context))
    );
    return results;
  }
}
