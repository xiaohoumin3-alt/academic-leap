/**
 * AI Generation Configuration
 * 后端环境变量配置
 */

export const AI_CONFIG = {
  baseURL: process.env.MINIMAX_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/anthropic',
  apiKey: process.env.MINIMAX_API_KEY,
  model: process.env.MINIMAX_MODEL || 'claude-haiku-4-20250514',
  maxTokens: 131072, // API支持的最大值
  timeout: 360000, // 6 minutes
  complexityBatchSize: parseInt(process.env.COMPLEXITY_BATCH_SIZE || '8', 10),
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    totalTimeout: 300000, // 5 minutes total timeout
  },
}

/**
 * 获取运行时AI配置（验证API Key存在）
 */
export function getAIConfig() {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY is required at runtime')
  }
  return { ...AI_CONFIG, apiKey }
}
