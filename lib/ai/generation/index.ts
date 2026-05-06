/**
 * AI Generation Module
 *
 * Exports AI-powered question generation functionality
 */

export {
  callMimoAPI,
  splitContentIntoChunks,
  parseCardsResponse,
  generateCardsDirect,
  generateCardsWithChunks,
  type GeneratedQuestionType,
  type GeneratedCard,
  type GenerateCardsParams,
} from './minimax'

export { PROMPTS } from './prompt-templates'

export {
  generateAndSaveCards,
  generateCardsWithComplexity,
  generateCards,
  calculateCardCount,
  type QuestionType,
  type GeneratedCard as AIGeneratedCard,
} from './question-generator'
