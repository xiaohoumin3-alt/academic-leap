/**
 * MiniMax API 客户端（兼容 Anthropic 格式）
 * 用于 AI 题目生成
 */

import { AI_CONFIG, getAIConfig } from '../config'

// ============================================================
// 类型定义
// ============================================================

export type GeneratedQuestionType = 'fill_blank' | 'multiple_choice' | 'short_answer'

export interface GeneratedCard {
  id: string
  question_type: GeneratedQuestionType
  question: string
  answer: string
  options?: string[]
  explanation?: string
}

export interface GenerateRequest {
  content: string
  types: GeneratedQuestionType[]
  count?: number
}

export interface GenerateResponse {
  cards: Omit<GeneratedCard, 'id'>[]
}

// ============================================================
// API 响应类型
// ============================================================

interface MiniMaxContentBlock {
  type: 'text' | 'thinking'
  text?: string
  thinking?: string
}

interface MiniMaxResponse {
  content: MiniMaxContentBlock[]
  error?: { message: string }
}

// ============================================================
// JSON 解析工具
// ============================================================

/**
 * 修复 JSON 字符串中的 LaTeX 转义字符
 * AI 返回的 JSON 可能包含未正确转义的反斜杠（LaTeX 公式）
 */
function fixLaTeXEscapes(jsonString: string): string {
  let fixed = jsonString
  // 修复形如 $\$ 的情况（应该是 \\$）
  fixed = fixed.replace(/\$\\/g, '\\\\\\$')
  // 修复不在转义序列中的单个反斜杠
  const knownEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']
  fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
  return fixed
}

/**
 * 移除 AI 响应中的 markdown 代码块标记
 */
function stripMarkdownCodeBlock(text: string): string {
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    const lines = jsonText.split('\n')
    if (lines[0].trim().startsWith('```')) lines.shift()
    if (lines[lines.length - 1].trim() === '```') lines.pop()
    jsonText = lines.join('\n').trim()
  }
  return jsonText
}

/**
 * 指数退避重试（带总超时上限）
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; initialDelay: number; maxDelay: number; totalTimeout?: number }
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, totalTimeout } = config
  let lastError: Error
  const startTime = Date.now()

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (totalTimeout && Date.now() - startTime > totalTimeout) {
        throw new Error(`Retry timeout exceeded after ${Date.now() - startTime}ms`)
      }

      if (i < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(2, i), maxDelay)
        await sleep(delay)
        console.warn(`[AI] Retry ${i + 1}/${maxRetries} after ${delay}ms`)
      }
    }
  }

  throw lastError!
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// API 调用
// ============================================================

/**
 * 调用 MiniMax API
 */
export async function callMimoAPI(prompt: string): Promise<string> {
  const config = getAIConfig()

  return retryWithBackoff(
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      try {
        const response = await fetch(`${config.baseURL}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`Mimo API ${response.status}: ${error}`)
        }

        const data = (await response.json()) as MiniMaxResponse

        if (data.error) {
          throw new Error(`Mimo API error: ${data.error.message}`)
        }

        const textBlock = data.content?.find((b) => b.type === 'text')
        if (!textBlock?.text) {
          throw new Error('Mimo API: no text in response')
        }

        return textBlock.text
      } finally {
        clearTimeout(timeoutId)
      }
    },
    config.retryConfig
  )
}

// ============================================================
// 内容分块
// ============================================================

/**
 * 将长内容分割成多个块，每个块不超过指定长度
 * 优先按段落分割，保持语义完整
 */
export function splitContentIntoChunks(
  content: string,
  options: { maxLength: number; preserveParagraphs: boolean; preserveSections: boolean }
): string[] {
  const { maxLength, preserveParagraphs, preserveSections } = options

  if (content.length <= maxLength) {
    return [content]
  }

  if (preserveSections) {
    // 尝试按章节分割
    const sectionRegex = /(?:^|\n)\s*(第[一二三四五六七八九十\d]+[章节篇]|[1-9]\d*\.[1-9]\d*)\s*[^\n]*/g
    const sections: string[] = []
    let lastIndex = 0
    let match

    while ((match = sectionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        sections.push(content.slice(lastIndex, match.index).trim())
      }
      lastIndex = match.index
    }

    if (lastIndex < content.length) {
      sections.push(content.slice(lastIndex).trim())
    }

    if (sections.length > 1 && sections.every((s) => s.length > 50)) {
      return mergeSectionsToChunks(sections, maxLength)
    }
  }

  if (preserveParagraphs) {
    const paragraphs = content.split(/\n\n+/)
    const chunks: string[] = []
    let currentChunk = ''

    for (const para of paragraphs) {
      const trimmedPara = para.trim()
      if (!trimmedPara) continue

      if (trimmedPara.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
          currentChunk = ''
        }

        // 分割长段落
        let remainingText = trimmedPara
        while (remainingText.length > maxLength) {
          chunks.push(remainingText.slice(0, maxLength).trim())
          remainingText = remainingText.slice(maxLength)
        }
        if (remainingText) {
          currentChunk = remainingText
        }
      } else {
        if ((currentChunk + '\n\n' + trimmedPara).length > maxLength) {
          if (currentChunk) {
            chunks.push(currentChunk.trim())
          }
          currentChunk = trimmedPara
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter((chunk) => chunk.length >= 50)
  }

  // 降级：按句子分割
  const sentences = content.match(/[^。！？.!?]+[。！？.!?]*/g) || [content]
  return mergeSentencesToChunks(sentences, maxLength)
}

/**
 * 合并章节到块
 */
function mergeSectionsToChunks(sections: string[], maxLength: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  for (const section of sections) {
    if (section.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
      // 进一步按段落分割
      const subChunks = splitContentIntoChunks(section, {
        maxLength,
        preserveParagraphs: true,
        preserveSections: false,
      })
      chunks.push(...subChunks)
    } else if ((currentChunk + '\n\n' + section).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = section
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.length >= 50)
}

/**
 * 合并句子到块
 */
function mergeSentencesToChunks(sentences: string[], maxLength: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    if ((currentChunk + trimmed).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = trimmed
    } else {
      currentChunk += currentChunk ? trimmed : trimmed
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// ============================================================
// JSON 解析（容错）
// ============================================================

/**
 * 解析 AI 卡片响应（容错解析）
 */
export function parseCardsResponse(
  responseText: string,
  type: GeneratedQuestionType,
  maxCount: number
): GeneratedCard[] {
  let jsonText = stripMarkdownCodeBlock(responseText)
  jsonText = fixLaTeXEscapes(jsonText)

  let parsed: GenerateResponse | null = null

  // 尝试直接解析
  try {
    parsed = JSON.parse(jsonText) as GenerateResponse
  } catch {
    // 尝试修复截断的 JSON
    const cardsMatch = jsonText.match(/"cards"\s*:\s*\[([\s\S]*)\]/)
    if (cardsMatch) {
      try {
        const cardsArray = JSON.parse(`[${cardsMatch[1]}]`)
        parsed = { cards: cardsArray }
      } catch {
        // 尝试逐个提取 card 对象
        const cardMatches = jsonText.match(/\{[^{}]*"question"[^{}]*\}/g)
        if (cardMatches && cardMatches.length > 0) {
          const cards = cardMatches
            .map((m) => {
              try {
                return JSON.parse(m)
              } catch {
                return null
              }
            })
            .filter(Boolean)
          if (cards.length > 0) {
            parsed = { cards }
          }
        }
      }
    }
  }

  if (!parsed || !parsed.cards) {
    console.warn('[AI] Failed to parse cards response')
    return []
  }

  return (parsed.cards || [])
    .slice(0, maxCount)
    .map((card) => ({
      id: crypto.randomUUID(),
      question_type: type,
      question: card.question,
      answer: card.answer,
      options: card.options,
      explanation: card.explanation,
    }))
}

// ============================================================
// 核心生成函数
// ============================================================

export interface GenerateCardsParams {
  content: string
  types: GeneratedQuestionType[]
  count?: number
  difficulty?: number
  onProgress?: (batch: number, total: number, cards: GeneratedCard[]) => void
}

/**
 * 直接生成卡片（无分块）
 */
export async function generateCardsDirect(params: {
  content: string
  types: GeneratedQuestionType[]
  count: number
  difficulty?: number
}): Promise<GeneratedCard[]> {
  const { content, types, count, difficulty } = params

  // 导入提示词模板
  const { PROMPTS } = await import('./prompt-templates')

  const difficultyPrompt = difficulty ? `\n难度要求：${difficulty}/10，适合${difficulty}年级学生` : ''

  const results = await Promise.all(
    types.map(async (type) => {
      const prompt = PROMPTS[type].replace('{content}', content.slice(0, 8000)) + difficultyPrompt

      const response = await callMimoAPI(prompt)
      return parseCardsResponse(response, type, count)
    })
  )

  return results.flat()
}

/**
 * 带分块的卡片生成
 */
export async function generateCardsWithChunks(params: GenerateCardsParams): Promise<GeneratedCard[]> {
  const { content, types, count = 10, difficulty, onProgress } = params

  // 内容较短，直接生成
  if (content.length <= 500) {
    const cards = await generateCardsDirect({ content, types, count, difficulty })
    onProgress?.(1, 1, cards)
    return cards
  }

  // 分块生成
  const chunks = splitContentIntoChunks(content, {
    maxLength: 3000,
    preserveParagraphs: true,
    preserveSections: true,
  })

  const allCards: GeneratedCard[] = []
  const cardsPerChunk = Math.ceil(count / chunks.length)

  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunkCards = await generateCardsDirect({
        content: chunks[i],
        types,
        count: cardsPerChunk,
        difficulty,
      })
      allCards.push(...chunkCards)
      onProgress?.(i + 1, chunks.length, chunkCards)
    } catch (error) {
      console.warn(`[AI] Chunk ${i + 1}/${chunks.length} generation failed, skipping...`, error)
    }
  }

  return allCards.slice(0, count)
}
