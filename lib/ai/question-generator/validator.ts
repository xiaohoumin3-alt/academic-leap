/**
 * Question Validator
 *
 * Validates generated questions for mathematical correctness,
 * appropriateness, and quality.
 */

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export interface QuestionToValidate {
  question: string;
  answer: string;
  explanation?: string;
  knowledgePoint: string;
}

export interface QuestionType {
  type: 'multiple-choice' | 'fill-blank' | 'true-false' | 'short-answer' | 'matching';
  options?: string[];
  correctAnswer?: string;
}

// ============================================================================
// Validation State
// ============================================================================

interface ValidationContext {
  errors: string[];
  warnings: string[];
  confidence: number;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a generated question for mathematical correctness
 */
export async function validateQuestion(
  question: QuestionToValidate
): Promise<ValidationResult> {
  const ctx: ValidationContext = {
    errors: [],
    warnings: [],
    confidence: 1.0
  };

  // 1. Required field validation
  validateRequiredFields(question, ctx);

  // 2. Detect question type
  const questionType = detectQuestionType(question);

  // 3. Type-specific validation
  switch (questionType.type) {
    case 'fill-blank':
      validateFillBlankQuestion(question, ctx);
      break;
    case 'multiple-choice':
      validateMultipleChoiceQuestion(question, ctx);
      break;
    case 'true-false':
      validateTrueFalseQuestion(question, ctx);
      break;
    case 'short-answer':
      validateShortAnswerQuestion(question, ctx);
      break;
    default:
      ctx.warnings.push(`Unknown question type, performing basic validation only`);
      validateBasicMath(question, ctx);
  }

  // 4. Mathematical correctness verification
  await verifyMathematicalCorrectness(question, ctx);

  // 5. Quality checks
  validateQuality(question, ctx);

  // Calculate final confidence based on issues found
  ctx.confidence = calculateConfidence(ctx);

  return {
    isValid: ctx.errors.length === 0,
    errors: ctx.errors,
    warnings: ctx.warnings,
    confidence: ctx.confidence
  };
}

// ============================================================================
// Required Field Validation
// ============================================================================

function validateRequiredFields(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  if (!question.question || question.question.trim().length === 0) {
    ctx.errors.push('Question text is required');
  }

  if (!question.answer || question.answer.trim().length === 0) {
    ctx.errors.push('Answer is required');
  }

  if (!question.knowledgePoint || question.knowledgePoint.trim().length === 0) {
    ctx.warnings.push('Knowledge point should be specified');
  }
}

// ============================================================================
// Question Type Detection
// ============================================================================

function detectQuestionType(question: QuestionToValidate): QuestionType {
  const q = question.question.toLowerCase();
  const a = question.answer.toLowerCase();

  // Multiple choice: has options A, B, C, D or similar
  if (/选项|选择|option|\([a-d]\)|\([A-D]\)/i.test(q) ||
      (/^[A-D][.\s]/.test(a) || /^(选项|Option)?\s*[A-D]/i.test(a))) {
    return { type: 'multiple-choice' };
  }

  // True/False
  if (/判断|对错|true\s*false|正确|错误/i.test(q) ||
      /^(true|false|对|错|正确|错误|yes|no)$/i.test(a)) {
    return { type: 'true-false' };
  }

  // Fill blank: contains "?" or "____" or "=" with unknown
  if (/\?|____|\s*=\s*\?|填空|计算/i.test(q)) {
    return { type: 'fill-blank' };
  }

  // Default to short answer
  return { type: 'short-answer' };
}

// ============================================================================
// Fill-in-the-Blank Validation
// ============================================================================

function validateFillBlankQuestion(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  // Extract the expression to solve
  const expressionMatch = question.question.match(/(.+?)\s*=\s*\?|(.+?)\?/);
  if (!expressionMatch) {
    ctx.warnings.push('Cannot extract mathematical expression from question');
    return;
  }

  const expression = (expressionMatch[1] || expressionMatch[2] || '').trim();

  // Validate mathematical expression
  validateMathExpression(expression, ctx);

  // Validate answer format
  const answerValue = extractNumericAnswer(question.answer);
  if (answerValue === null) {
    ctx.warnings.push('Answer does not appear to be a valid number');
  }

  // Check for division by zero
  if (expression.includes('/ 0') || expression.includes('/0')) {
    ctx.errors.push('Division by zero detected in expression');
  }

  // Check for negative under square root
  const sqrtMatch = expression.match(/sqrt\s*\(\s*(-?\d+)\s*\)|√\s*(-?\d+)/);
  if (sqrtMatch) {
    const value = parseFloat(sqrtMatch[1] || sqrtMatch[2] || '0');
    if (value < 0) {
      ctx.errors.push('Square root of negative number detected');
    }
  }
}

// ============================================================================
// Multiple Choice Validation
// ============================================================================

function validateMultipleChoiceQuestion(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  // Extract options from question (look for A, B, C, D pattern)
  const optionsPattern = /(?:选项?\s*)?([A-D])[.、\s]\s*([^\n]+)/g;
  const options: string[] = [];
  let match;

  while ((match = optionsPattern.exec(question.question)) !== null) {
    options.push(match[2].trim());
  }

  if (options.length < 2) {
    ctx.errors.push('Multiple choice questions must have at least 2 options');
    return;
  }

  // Validate answer format (should be A, B, C, or D)
  const answerMatch = question.answer.match(/^[A-D]$/i);
  if (!answerMatch) {
    ctx.warnings.push('Answer should be a single letter (A, B, C, or D)');
  }

  // Check if options are unique
  const uniqueOptions = new Set(options.map(o => o.toLowerCase()));
  if (uniqueOptions.size !== options.length) {
    ctx.errors.push('Multiple choice options must be unique');
  }
}

// ============================================================================
// True/False Validation
// ============================================================================

function validateTrueFalseQuestion(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  const normalizedAnswer = question.answer.trim().toLowerCase();
  const validAnswers = ['true', 'false', 'yes', 'no', '对', '错', '正确', '错误', '√', '\xd7'];

  if (!validAnswers.some(v => normalizedAnswer === v.toLowerCase())) {
    ctx.errors.push('True/False answer must be true/false, yes/no, or similar binary response');
  }
}

// ============================================================================
// Short Answer Validation
// ============================================================================

function validateShortAnswerQuestion(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  if (question.answer.length > 200) {
    ctx.warnings.push('Short answer is unusually long');
  }

  // Check if answer contains explanation mixed with answer
  if (/\n|因为|所以|because|since/i.test(question.answer)) {
    ctx.warnings.push('Answer should be concise; use explanation field for reasoning');
  }
}

// ============================================================================
// Mathematical Expression Validation
// ============================================================================

function validateMathExpression(
  expression: string,
  ctx: ValidationContext
): void {
  // Check for malformed operators
  if (/[+\-*/^]{2,}/.test(expression.replace(/\s/g, ''))) {
    ctx.errors.push('Malformed operators in expression');
  }

  // Check for unbalanced parentheses
  let parenCount = 0;
  for (const char of expression) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      ctx.errors.push('Unbalanced parentheses in expression');
      break;
    }
  }
  if (parenCount !== 0) {
    ctx.errors.push('Unbalanced parentheses in expression');
  }

  // Check for invalid characters
  const validChars = /^[\d\s+\-*/^().√\xd7÷%=,?？？]+$/;
  if (!validChars.test(expression)) {
    ctx.warnings.push('Expression contains potentially invalid characters');
  }
}

// ============================================================================
// Basic Math Validation
// ============================================================================

function validateBasicMath(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  // Extract numbers and operations
  const numbers = question.question.match(/-?\d+\.?\d*/g) || [];

  if (numbers.length === 0) {
    ctx.warnings.push('No numeric values detected in question');
  }

  // Check for reasonable number ranges
  for (const numStr of numbers) {
    const num = parseFloat(numStr);
    if (Math.abs(num) > 1000000) {
      ctx.warnings.push(`Unusually large number detected: ${num}`);
    }
    if (numStr.includes('.') && numStr.split('.')[1]?.length > 4) {
      ctx.warnings.push(`Number has excessive decimal places: ${numStr}`);
    }
  }
}

// ============================================================================
// Mathematical Correctness Verification
// ============================================================================

async function verifyMathematicalCorrectness(
  question: QuestionToValidate,
  ctx: ValidationContext
): Promise<void> {
  // Extract and evaluate simple arithmetic expressions
  const expressionMatch = question.question.match(/(\d+)\s*([\+\-\*×\/÷])\s*(\d+)/);
  if (expressionMatch) {
    const num1 = parseFloat(expressionMatch[1]);
    const operator = expressionMatch[2];
    const num2 = parseFloat(expressionMatch[3]);

    let expected: number;
    switch (operator) {
      case '+':
        expected = num1 + num2;
        break;
      case '-':
        expected = num1 - num2;
        break;
      case '*':
      case '×':
        expected = num1 * num2;
        break;
      case '/':
      case '÷':
        if (num2 === 0) {
          ctx.errors.push('Division by zero');
          return;
        }
        expected = num1 / num2;
        break;
      default:
        return;
    }

    // Check if answer matches expected result (with tolerance for floating point)
    const answerValue = extractNumericAnswer(question.answer);
    if (answerValue !== null) {
      const tolerance = Math.max(Math.abs(expected) * 0.01, 0.001);
      if (Math.abs(answerValue - expected) > tolerance) {
        ctx.errors.push(`Mathematical error: expected ${expected}, got ${answerValue}`);
        ctx.confidence -= 0.5;
      }
    }
  }
}

// ============================================================================
// Quality Validation
// ============================================================================

function validateQuality(
  question: QuestionToValidate,
  ctx: ValidationContext
): void {
  // Check question clarity
  if (question.question.length < 5) {
    ctx.warnings.push('Question text is too short');
  }

  if (question.question.length > 500) {
    ctx.warnings.push('Question text is unusually long');
  }

  // Check for ambiguous language
  const ambiguousPatterns = [
    /大约|大概|可能|也许|approximately|maybe/i
  ];
  for (const pattern of ambiguousPatterns) {
    if (pattern.test(question.question)) {
      ctx.warnings.push('Question contains ambiguous language');
      break;
    }
  }

  // Check answer completeness
  if (question.answer.length === 0) {
    ctx.errors.push('Answer is empty');
  }

  // Check for trivial questions
  if (/^1\s*\+\s*1\s*=|^0\s*\+\s*\d+|^1\s*\*\s*\d+/.test(question.question)) {
    ctx.warnings.push('Question may be too trivial');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract numeric value from answer string
 */
function extractNumericAnswer(answer: string): number | null {
  // Try direct number parsing
  const directMatch = answer.match(/^(-?\d+\.?\d*)/);
  if (directMatch) {
    return parseFloat(directMatch[1]);
  }

  // Try fraction format (e.g., "3/4")
  const fractionMatch = answer.match(/^(-?\d+)\s*\/\s*(-?\d+)/);
  if (fractionMatch) {
    const numerator = parseFloat(fractionMatch[1]);
    const denominator = parseFloat(fractionMatch[2]);
    if (denominator !== 0) {
      return numerator / denominator;
    }
  }

  // Try mixed number (e.g., "1 1/2")
  const mixedMatch = answer.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    if (denominator !== 0) {
      return whole + (numerator / denominator);
    }
  }

  return null;
}

/**
 * Calculate confidence score based on validation issues
 */
function calculateConfidence(ctx: ValidationContext): number {
  let confidence = 1.0;

  // Each error reduces confidence significantly
  confidence -= ctx.errors.length * 0.3;

  // Each warning reduces confidence slightly
  confidence -= ctx.warnings.length * 0.1;

  return Math.max(0, Math.min(1, confidence));
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Batch validate multiple questions
 */
export async function validateQuestions(
  questions: QuestionToValidate[]
): Promise<ValidationResult[]> {
  return Promise.all(questions.map(q => validateQuestion(q)));
}
