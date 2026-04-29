/**
 * Rule-based complexity extractor - fallback when LLM API unavailable
 * Uses heuristics based on question content to estimate complexity
 */

export interface QuestionContent {
  title?: string;
  description?: string;
  context?: string;
  expression?: string;
}

export interface ComplexityFeatures {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
}

export interface ExtractionResult {
  questionId: string;
  features: ComplexityFeatures;
  confidence: number;
  reasoning: string;
}

/**
 * Calculate complexity based on content heuristics
 */
function calculateHeuristics(content: QuestionContent): {
  cognitiveLoad: number;
  reasoningDepth: number;
  complexity: number;
  reasoning: string;
} {
  const text = [
    content.title,
    content.description,
    content.context,
    content.expression,
  ].filter(Boolean).join(' ');

  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const mathSymbols = (text.match(/[√∫∑πθαβγδεζηλμνξπρστυφχψω]/g) || []).length;
  const hasMultipleSteps = /则|所以|因此|首先|其次|最后|再|又/.test(text);
  const hasProof = /证明|求证|设|假设/.test(text);
  const hasWordProblem = /米|厘米|千克|小时|分钟|元|个|只|辆/.test(text);
  const hasAbstractConcept = /函数|方程|不等式|集合|映射|极限|导数|积分/.test(text);

  // Base complexity from length
  let cognitiveLoad = Math.min(0.3 + chineseChars * 0.001, 0.9);

  // Adjust for content type
  if (mathSymbols > 3) cognitiveLoad += 0.1;
  if (hasMultipleSteps) cognitiveLoad += 0.2;
  if (hasAbstractConcept) cognitiveLoad += 0.2;
  if (hasWordProblem) cognitiveLoad += 0.15;

  // Reasoning depth based on problem structure
  let reasoningDepth = 0.2;
  if (hasProof) reasoningDepth = 0.7;
  else if (hasMultipleSteps) reasoningDepth = 0.5;
  else if (mathSymbols > 2) reasoningDepth = 0.4;

  // Overall complexity (weighted average)
  const complexity = cognitiveLoad * 0.6 + reasoningDepth * 0.4;

  // Generate reasoning explanation
  const reasons: string[] = [];
  if (chineseChars < 50) reasons.push('题目简短');
  if (mathSymbols > 3) reasons.push('含数学符号');
  if (hasMultipleSteps) reasons.push('多步推理');
  if (hasProof) reasons.push('需证明');
  if (hasWordProblem) reasons.push('应用题');
  if (hasAbstractConcept) reasons.push('抽象概念');

  const reasoning = reasons.length > 0
    ? `基于规则分析: ${reasons.join('、')}`
    : '基础计算题';

  return {
    cognitiveLoad: Math.min(cognitiveLoad, 1),
    reasoningDepth: Math.min(reasoningDepth, 1),
    complexity: Math.min(complexity, 1),
    reasoning,
  };
}

/**
 * Rule-based extractor class
 */
export class RuleBasedExtractor {
  async extract(questionId: string, content: QuestionContent): Promise<ExtractionResult> {
    const features = calculateHeuristics(content);
    return {
      questionId,
      features: {
        cognitiveLoad: features.cognitiveLoad,
        reasoningDepth: features.reasoningDepth,
        complexity: features.complexity,
      },
      confidence: 0.65, // Rule-based has moderate confidence
      reasoning: features.reasoning,
    };
  }

  async extractBatch(
    items: Array<{ id: string; content: QuestionContent }>
  ): Promise<Map<string, ExtractionResult>> {
    const results = new Map<string, ExtractionResult>();
    for (const item of items) {
      const result = await this.extract(item.id, item.content);
      results.set(item.id, result);
    }
    return results;
  }
}

/**
 * Unified extractor that tries LLM first, falls back to rule-based
 */
export class HybridExtractor {
  private ruleBased = new RuleBasedExtractor();
  private llmExtractor: any = null;

  async init(useLLM: boolean) {
    if (useLLM) {
      try {
        const { ComplexityExtractor } = await import('./complexity-extractor');
        this.llmExtractor = new ComplexityExtractor();
        // Test connection with a minimal request
        console.log('LLM extractor initialized');
      } catch (error) {
        console.warn('LLM unavailable, using rule-based fallback:', error);
        this.llmExtractor = null;
      }
    }
  }

  async extract(questionId: string, content: QuestionContent): Promise<ExtractionResult> {
    if (this.llmExtractor) {
      try {
        return await this.llmExtractor.extract(questionId, content);
      } catch (error) {
        console.warn(`LLM extraction failed for ${questionId}, using rule-based:`, error);
      }
    }
    return this.ruleBased.extract(questionId, content);
  }

  async extractBatch(
    items: Array<{ id: string; content: QuestionContent }>,
    options?: { batchSize?: number; delayMs?: number; onProgress?: (current: number, total: number) => void }
  ): Promise<Map<string, ExtractionResult>> {
    if (this.llmExtractor && options?.onProgress) {
      try {
        return await this.llmExtractor.extractBatch(items, options);
      } catch (error) {
        console.warn('LLM batch extraction failed, using rule-based:', error);
      }
    }
    return this.ruleBased.extractBatch(items);
  }
}
