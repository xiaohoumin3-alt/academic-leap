/**
 * 多模型适配器
 *
 * 支持多个AI提供商：
 * - Anthropic Claude (Haiku, Sonnet, Opus)
 * - OpenAI GPT
 * - Google Gemini
 */

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export type ModelType =
  | 'claude-haiku-4.5'
  | 'claude-sonnet-4.6'
  | 'claude-opus-4.7'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro';

export interface ModelConfig {
  model: ModelType;
  apiKey?: string;
  provider?: ModelProvider;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateOptions {
  responseFormat?: 'text' | 'json';
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface TaskComplexity {
  complexity: 'simple' | 'medium' | 'high';
  requiresReasoning: boolean;
  taskType?: 'coding' | 'analysis' | 'writing' | 'general';
}

/**
 * 模型配置映射
 */
const MODEL_CONFIGS: Record<ModelType, { provider: ModelProvider; endpoint: string; modelName: string }> = {
  'claude-haiku-4.5': {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelName: 'claude-3-5-haiku-20241022'
  },
  'claude-sonnet-4.6': {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelName: 'claude-3-5-sonnet-20241022'
  },
  'claude-opus-4.7': {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelName: 'claude-3-5-sonnet-20241022' // Opus 4.7 uses same endpoint
  },
  'gpt-4o': {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o'
  },
  'gpt-4o-mini': {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelName: 'gpt-4o-mini'
  },
  'gemini-2.5-flash': {
    provider: 'google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent',
    modelName: 'gemini-2.5-flash-exp'
  },
  'gemini-2.5-pro': {
    provider: 'google',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp:generateContent',
    modelName: 'gemini-2.5-pro-exp'
  }
};

/**
 * API Key 环境变量映射
 */
const API_KEY_ENV: Record<ModelProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY'
};

export class ModelAdapter {
  private config: ModelConfig;
  private provider: ModelProvider;
  private modelConfig: typeof MODEL_CONFIGS[ModelType];

  constructor(config: ModelConfig) {
    this.config = config;
    this.modelConfig = MODEL_CONFIGS[config.model];
    this.provider = config.provider || this.modelConfig.provider;
  }

  /**
   * 生成文本
   */
  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResponse> {
    switch (this.provider) {
      case 'anthropic':
        return this.generateAnthropic(prompt, options);
      case 'openai':
        return this.generateOpenAI(prompt, options);
      case 'google':
        return this.generateGemini(prompt, options);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Anthropic Claude 调用
   */
  private async generateAnthropic(
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResponse> {
    const apiKey = this.config.apiKey || process.env[API_KEY_ENV.anthropic];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const response = await fetch(this.modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.modelConfig.modelName,
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return {
      content,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0
      }
    };
  }

  /**
   * OpenAI GPT 调用
   */
  private async generateOpenAI(
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResponse> {
    const apiKey = this.config.apiKey || process.env[API_KEY_ENV.openai];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch(this.modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.modelConfig.modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens || 4096,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Google Gemini 调用
   */
  private async generateGemini(
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResponse> {
    const apiKey = this.config.apiKey || process.env[API_KEY_ENV.google];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const endpoint = `${this.modelConfig.endpoint}?key=${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || this.config.maxTokens || 4096,
          temperature: options?.temperature ?? this.config.temperature ?? 0.7,
          responseMimeType: options?.responseFormat === 'json' ? 'application/json' : 'text/plain'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  /**
   * 根据任务复杂度选择模型
   *
   * 策略：
   * - 简单任务 → Haiku (快速、低成本)
   * - 编码任务 → Sonnet (最佳编码模型)
   * - 深度分析 → Opus (最强推理)
   */
  static selectModelForTask(complexity: TaskComplexity): ModelType {
    // 简单任务使用 Haiku
    if (complexity.complexity === 'simple' && !complexity.requiresReasoning) {
      return 'claude-haiku-4.5';
    }

    // 编码任务优先 Sonnet
    if (complexity.taskType === 'coding') {
      return 'claude-sonnet-4.6';
    }

    // 深度分析使用 Opus
    if (complexity.complexity === 'high' && complexity.requiresReasoning) {
      return 'claude-opus-4.7';
    }

    // 默认使用 Sonnet
    return 'claude-sonnet-4.6';
  }

  /**
   * 获取可用模型列表
   */
  static getAvailableModels(): Array<{ model: ModelType; provider: ModelProvider; description: string }> {
    return [
      {
        model: 'claude-haiku-4.5',
        provider: 'anthropic',
        description: '快速、低成本，适合简单任务'
      },
      {
        model: 'claude-sonnet-4.6',
        provider: 'anthropic',
        description: '平衡性能与成本，最佳编码模型'
      },
      {
        model: 'claude-opus-4.7',
        provider: 'anthropic',
        description: '最强推理能力，适合复杂分析'
      },
      {
        model: 'gpt-4o',
        provider: 'openai',
        description: 'OpenAI多模态模型'
      },
      {
        model: 'gemini-2.5-flash',
        provider: 'google',
        description: 'Google快速模型'
      }
    ];
  }
}
