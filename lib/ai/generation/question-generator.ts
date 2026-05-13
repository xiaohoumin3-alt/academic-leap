/**
 * AI Question Generator
 * 核心生成逻辑：AI生成 + 复杂度提取 + 入库
 */

import { prisma } from '@/lib/prisma'
import { ComplexityExtractor } from '@/lib/qie/complexity-extractor'
import {
  type GeneratedQuestionType,
  type GeneratedCard as AIGeneratedCard,
  type GenerateCardsParams,
  generateCardsDirect,
  generateCardsWithChunks,
} from './minimax'

// ============================================================
// 类型定义
// ============================================================

export type QuestionType = GeneratedQuestionType

export interface GeneratedCard {
  id: string
  question_type: GeneratedQuestionType
  question: string
  answer: string
  options?: string[]
  explanation?: string
}

export interface GenerateParams {
  knowledgePointId: string
  content: string
  types: GeneratedQuestionType[]
  count?: number
  difficulty?: number
  grade?: number
  onProgress?: (batch: number, total: number, cards: GeneratedCard[]) => void
}

export interface GenerateResult {
  questions: Question[]
  totalCount: number
}

// Prisma Question 类型（简化）- Updated for Json types
interface Question {
  id: string
  type: string
  difficulty: number
  content: unknown // Json type
  answer: string
  hint: string | null
  knowledgePoints: unknown // Json type
  createdBy: string | null
  isAI: boolean
  createdAt: Date
  params: unknown | null // Json type
  stepTypes: unknown | null // Json type
  templateId: string | null
  generatedFrom: string | null
  complexitySpec: unknown | null // Json type
  cognitiveLoad: number | null
  reasoningDepth: number | null
  complexity: number | null
  extractionStatus: string
  featuresExtractedAt: Date | null
  extractionError: string | null
  extractionModel: string | null
}

// ============================================================
// 复杂度特征计算
// ============================================================

/**
 * 根据复杂度特征计算难度等级（1-12）
 */
function calculateDifficultyFromComplexity(features: {
  cognitiveLoad: number
  reasoningDepth: number
  complexity: number
}): number {
  // baseDifficulty: complexity 0-1 映射到 1-12
  const baseDifficulty = Math.round(features.complexity * 11) + 1
  return Math.max(1, Math.min(12, baseDifficulty))
}

// ============================================================
// 核心生成函数
// ============================================================

/**
 * AI生成题目（仅内容，无复杂度）
 */
async function generateRawCards(params: {
  content: string
  types: GeneratedQuestionType[]
  count?: number
  difficulty?: number
  onProgress?: (batch: number, total: number, cards: GeneratedCard[]) => void
}): Promise<GeneratedCard[]> {
  return generateCardsWithChunks(params)
}

/**
 * 两步法：生成 → 入库 → 复杂度提取 → 更新
 *
 * 流程：
 * 1. AI生成题目
 * 2. 先入库获取真实数据库ID
 * 3. 使用真实ID批量提取复杂度特征
 * 4. 更新数据库中的复杂度特征
 */
export async function generateCardsWithComplexity(params: GenerateParams): Promise<Question[]> {
  const { knowledgePointId, difficulty, onProgress } = params

  // Step 1: AI生成题目
  const rawCards = await generateRawCards({
    content: params.content,
    types: params.types,
    count: params.count,
    difficulty: params.difficulty,
  })

  if (rawCards.length === 0) {
    throw new Error('AI生成失败，未返回任何题目')
  }

  // Step 1.5: 先入库获取真实数据库ID
  const tempQuestions = await prisma.$transaction(async (tx) => {
    return Promise.all(
      rawCards.map((card) =>
        tx.question.create({
          data: {
            type: card.question_type,
            difficulty: difficulty || 5,
            answer: card.answer,
            complexity: 0.5,
            cognitiveLoad: 0.5,
            reasoningDepth: 0.5,
            knowledgePoints: JSON.stringify([knowledgePointId]),
            content: JSON.stringify({
              question: card.question,
              options: card.options,
              explanation: card.explanation,
            }),
            isAI: true,
            extractionStatus: 'PENDING',
          },
        })
      )
    )
  })

  // Step 2: 使用真实ID提取复杂度特征
  const extractor = new ComplexityExtractor()
  const complexityResults = await extractor.extractBatch(
    tempQuestions.map((q) => {
      // content is now Json type - may be object or string
      const contentObj = typeof q.content === 'object' && q.content !== null
        ? q.content as { question?: string; options?: string[]; explanation?: string }
        : typeof q.content === 'string'
          ? JSON.parse(q.content || '{}')
          : { question: '' };
      return {
        id: q.id,
        content: {
          title: q.type,
          description: contentObj.question || '',
        },
      }
    }),
    {
      batchSize: 8,
      onProgress: (current, total) => {
        console.log(`[Complexity] Extracting ${current}/${total}`)
      },
    }
  )

  // Step 3: 更新数据库中的复杂度特征
  const finalQuestions = await prisma.$transaction(async (tx) => {
    return Promise.all(
      tempQuestions.map(async (q) => {
        const result = complexityResults.get(q.id)
        if (!result) {
          console.warn(`[Complexity] No result for ${q.id}, marking as FAILED`)
          return tx.question.update({
            where: { id: q.id },
            data: {
              extractionStatus: 'FAILED',
              extractionError: 'No result from batch extraction',
            },
          })
        }

        const calculatedDifficulty = difficulty || calculateDifficultyFromComplexity(result.features)

        return tx.question.update({
          where: { id: q.id },
          data: {
            complexity: result.features.complexity,
            cognitiveLoad: result.features.cognitiveLoad,
            reasoningDepth: result.features.reasoningDepth,
            difficulty: calculatedDifficulty,
            extractionStatus: 'SUCCESS',
            featuresExtractedAt: new Date(),
          },
        })
      })
    )
  })

  return finalQuestions
}

/**
 * 完整流程：AI生成 → 复杂度提取 → 入库
 * 生成失败直接抛错，不做降级处理
 */
export async function generateAndSaveCards(params: GenerateParams): Promise<GenerateResult> {
  const { onProgress } = params

  const adaptedProgress = (batch: number, total: number, cards: GeneratedCard[]) => {
    onProgress?.(batch, total, cards)
  }

  const questions = await generateCardsWithComplexity({ ...params, onProgress: adaptedProgress })

  return {
    questions,
    totalCount: questions.length,
  }
}

// ============================================================
// 便捷方法
// ============================================================

/**
 * 仅生成卡片（不入库）
 */
export async function generateCards(params: {
  content: string
  types: GeneratedQuestionType[]
  count?: number
  difficulty?: number
}): Promise<GeneratedCard[]> {
  return generateCardsDirect({
    content: params.content,
    types: params.types,
    count: params.count || 10,
    difficulty: params.difficulty,
  })
}

/**
 * 根据内容长度估算题目数量
 */
export function calculateCardCount(content: string): number {
  const length = content.length
  if (length < 500) return 3
  if (length < 1500) return 5
  if (length < 3000) return 8
  if (length < 6000) return 12
  if (length < 12000) return 20
  return Math.min(50, Math.floor(length / 300))
}
