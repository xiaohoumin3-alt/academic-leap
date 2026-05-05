/**
 * Question Generator Module
 *
 * Exports all question generation functionality including:
 * - Free-form AI generation
 * - Fill-in-the-blank questions
 * - Template-based generation
 */

export { generateFreeForm, type FreeFormOptions, type FreeFormQuestion } from './free-form';
export { generateFillBlank, generateFillBlankBatch, type FillBlankRequest, type FillBlankQuestion, type FillBlankResult, type FillBlankTemplate, type FillBlankOperator } from './free-form';
export { fillTemplateWithAI, type TemplateFillOptions, type FilledTemplate } from './template-filler';
export { validateQuestion, validateQuestions, type ValidationResult, type QuestionToValidate } from './validator';
