/**
 * Template Question Generator
 *
 * Generates questions on-the-fly using question templates.
 * Integrates with the recommendation engine to provide
 * template-based questions when database queries don't yield results.
 */

import type { StepProtocol, StepProtocolV2 } from '../question-engine/protocol';
import { generateQuestion, type GenerateQuestionOptions } from '../question-engine';
import { getTemplateIdForKnowledgePoint } from '../question-engine/knowledge-point-mapping';

export interface TemplateQuestionResult {
  id: string;
  knowledgePoint: string;
  templateId: string;
  difficultyLevel: number;
  content: {
    question: string;
    answer: string;
    explanation?: string;
  };
  params?: Record<string, number>;
}

/**
 * Extract answer from step (supports both v1 and v2 protocols)
 */
function extractAnswerFromStep(step: StepProtocol | StepProtocolV2): string {
  // V2 protocol: expectedAnswer
  if ('expectedAnswer' in step) {
    const expected = step.expectedAnswer;
    if (typeof expected === 'object' && expected !== null) {
      switch (expected.type) {
        case 'number':
          return expected.value.toString();
        case 'string':
          return expected.value;
        case 'coordinate':
          return `(${expected.x}, ${expected.y})`;
        case 'yes_no':
          return expected.value ? '是' : '否';
        case 'choice':
          return Array.isArray(expected.value) ? expected.value[0] : expected.value;
        case 'expression':
          return expected.value;
        case 'multi_fill':
          return expected.values.join(', ');
        case 'order':
          return expected.value.join(', ');
        case 'match':
          return Object.entries(expected.value).map(([k, v]) => `${k}:${v}`).join('; ');
      }
    }
  }

  // V1 protocol: ui.inputTarget
  if ('ui' in step && typeof step.ui === 'object') {
    return (step.ui as { inputTarget?: string }).inputTarget || '';
  }

  return '';
}

/**
 * Generate a template-based question
 *
 * @param knowledgePointId - Knowledge point identifier
 * @param difficultyLevel - Target difficulty (1-5)
 * @returns Generated question or null if generation fails
 */
export async function generateTemplateQuestion(
  knowledgePointId: string,
  difficultyLevel: number
): Promise<TemplateQuestionResult | null> {
  try {
    const question = await generateQuestion({
      knowledgePoint: knowledgePointId,
      difficultyLevel,
      renderStyle: 'standard',
    });

    if (!question) {
      return null;
    }

    // Extract answer from first step
    const firstStep = question.steps?.[0];
    const answer = firstStep ? extractAnswerFromStep(firstStep) : '';

    return {
      id: question.id,
      knowledgePoint: question.knowledgePoint,
      templateId: question.templateId || '',
      difficultyLevel: question.difficultyLevel,
      content: {
        question: question.content.description || '',
        answer: answer,
        explanation: question.content.context,
      },
      params: question.params,
    };
  } catch (error) {
    console.error(`Failed to generate template question for ${knowledgePointId}:`, error);
    return null;
  }
}

/**
 * Generate multiple template-based questions
 *
 * @param knowledgePointId - Knowledge point identifier
 * @param count - Number of questions to generate
 * @param baseDifficulty - Base difficulty level
 * @returns Array of generated questions
 */
export async function generateTemplateQuestions(
  knowledgePointId: string,
  count: number,
  baseDifficulty: number = 2
): Promise<TemplateQuestionResult[]> {
  const questions: TemplateQuestionResult[] = [];

  for (let i = 0; i < count; i++) {
    // Vary difficulty slightly for variety
    const difficulty = Math.min(5, Math.max(1, baseDifficulty + Math.floor(Math.random() * 2) - 1));
    const question = await generateTemplateQuestion(knowledgePointId, difficulty);

    if (question) {
      questions.push(question);
    }
  }

  return questions;
}

/**
 * Check if a knowledge point has a template available
 */
export function hasTemplate(knowledgePointId: string): boolean {
  return getTemplateIdForKnowledgePoint(knowledgePointId) !== null;
}

/**
 * Get template question for recommendation
 *
 * This function is called when the recommendation engine
 * needs a fallback question or when students should receive
 * dynamically generated questions.
 */
export async function getTemplateQuestionForRecommendation(
  knowledgePointId: string,
  targetDifficulty: number
): Promise<TemplateQuestionResult | null> {
  // Map target difficulty (0-10 scale from IRT) to template difficulty (1-5 scale)
  const templateDifficulty = Math.max(1, Math.min(5, Math.round((targetDifficulty / 10) * 5)));

  return generateTemplateQuestion(knowledgePointId, templateDifficulty);
}