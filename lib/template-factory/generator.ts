import type { GenerationRequest, GenerationResult, GeneratedTemplate } from './types';
import { LLMClient } from './utils/llm-client';
import { buildGenerationPrompt, parseGenerationResponse } from './prompts/generation';
import { randomUUID } from 'node:crypto';

export class TemplateGenerator {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generate(
    request: GenerationRequest,
    options?: { maxRetries?: number }
  ): Promise<GenerationResult> {
    const maxRetries = options?.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const prompt = buildGenerationPrompt(request);
        const response = await this.llm.generate(prompt, {
          responseFormat: 'json',
          maxTokens: 8192,
        });

        const { templates, errors } = parseGenerationResponse(response.content);

        return {
          generationId: randomUUID(),
          templates: templates as GeneratedTemplate[],
          summary: {
            total: request.count,
            successful: templates.length,
            failed: request.count - templates.length + errors.length,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Return failed result instead of throwing
    return {
      generationId: randomUUID(),
      templates: [],
      summary: {
        total: request.count,
        successful: 0,
        failed: request.count,
      },
    };
  }

  async generateBatch(
    requests: GenerationRequest[],
    options?: { concurrency?: number }
  ): Promise<GenerationResult[]> {
    const concurrency = options?.concurrency ?? 3;
    const results: GenerationResult[] = [];

    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(req => this.generate(req))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            generationId: randomUUID(),
            templates: [],
            summary: { total: 1, successful: 0, failed: 1 },
          });
        }
      }
    }

    return results;
  }
}
