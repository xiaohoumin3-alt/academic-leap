import type { LLMClientConfig, LLMResponse } from '../types';

export class LLMClient {
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
  }

  get model(): string {
    return this.config.model;
  }

  async generate(
    prompt: string,
    options?: {
      responseFormat?: 'text' | 'json';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<LLMResponse> {
    const model = this.config.model;

    if (model.startsWith('gemini')) {
      return this.generateGemini(prompt, options);
    } else if (model.startsWith('gpt')) {
      return this.generateOpenAI(prompt, options);
    }

    throw new Error(`Unsupported model: ${model}`);
  }

  private async generateGemini(
    prompt: string,
    options?: { responseFormat?: 'text' | 'json'; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || this.config.maxTokens || 4096,
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          responseMimeType: options?.responseFormat === 'json' ? 'application/json' : 'text/plain',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed: unknown = undefined;
    if (options?.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // If JSON parse fails, parsed remains undefined
      }
    }

    return {
      content,
      parsed,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  private async generateOpenAI(
    prompt: string,
    options?: { responseFormat?: 'text' | 'json'; maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        response_format: options?.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsed: unknown = undefined;
    if (options?.responseFormat === 'json') {
      try {
        parsed = JSON.parse(content);
      } catch {
        // If JSON parse fails, parsed remains undefined
      }
    }

    return {
      content,
      parsed,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}
