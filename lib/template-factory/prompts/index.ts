/**
 * Template Factory Prompts
 *
 * Prompt builders and parsers for LLM-based template generation.
 */

export { buildGenerationPrompt, parseGenerationResponse } from './generation';
export {
  buildMathValidationPrompt,
  buildPedagogyValidationPrompt,
  parseValidationResponse,
} from './validation';
