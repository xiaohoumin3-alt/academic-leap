/**
 * UOK Flow Service - Complete recommendation + learning + feedback loop
 */

import { UOK } from './uok';
import { prisma } from '@/lib/prisma';
import { experimentTracker } from './experiment-tracker';

export interface RecommendationWithProbability {
  questionId: string;
  questionData: any;
  topic: string;
  rationale: {
    currentMastery: number;
    targetComplexity: number;
    complexityGap: number;
    reason: string;
  };
  beforeProbability: number; // ML prediction BEFORE answering
}

export interface FeedbackResult {
  beforeProbability: number;
  randomProbability: number; // NEW: what random would have predicted
  masteryBefore: number;
  masteryAfter: number;
  nextTargetComplexity: number;
  isCorrect: boolean;
  topic: string;
}

/**
 * Complete UOK-powered recommendation flow
 */
export class UOKFlowService {
  private uok: UOK;

  constructor() {
    this.uok = new UOK();
  }

  /**
   * Step 1: Get recommendation with ML prediction
   *
   * Returns question + rationale + probability prediction
   */
  async getRecommendation(studentId: string, excludeIds: string[] = []): Promise<RecommendationWithProbability | null> {
    // Ensure student state is loaded
    await this.uok.getOrCreateStudentWithState(studentId);

    // Get recommendation action
    const action = this.uok.act('next_question', studentId);
    console.log('[UOK getRecommendation] action.type:', action.type, 'action:', JSON.stringify(action));

    if (action.type !== 'recommend' && action.type !== 'recommend_question') {
      console.log('[UOK getRecommendation] Early return: action.type not recommend');
      return null;
    }

    // Get student mastery for this topic
    const explanation = this.uok.explain({ studentId });
    console.log('[UOK getRecommendation] explanation.type:', explanation.type);
    if (explanation.type !== 'student') {
      console.log('[UOK getRecommendation] Early return: explanation.type not student');
      return null;
    }

    // FIX Layer2: Iterate through weak topics until finding one with available questions.
    // This prevents returning null when the top-weakest topic has no SUCCESS questions.
    const weakTopicsRanked = explanation.weakTopics;
    console.log('[UOK getRecommendation] weakTopicsRanked:', JSON.stringify(weakTopicsRanked));
    console.log('[UOK getRecommendation] excludeIds:', excludeIds);

    let selectedTopic: string | null = null;
    let topicMastery = 0.5;
    let question: any | null = null;

    for (const wt of weakTopicsRanked) {
      const targetComplexity = 0.3 + (wt.mastery * 0.5);
      console.log('[UOK getRecommendation] Trying topic:', wt.topic, 'targetComplexity:', targetComplexity);
      question = await this.findQuestionByTopic(wt.topic, targetComplexity, excludeIds);
      console.log('[UOK getRecommendation] Question found for topic', wt.topic, ':', question ? 'YES' : 'NO');
      if (question) {
        selectedTopic = wt.topic;
        topicMastery = wt.mastery;
        break;
      }
    }

    if (!question || !selectedTopic) {
      return null;
    }

    // Get ML prediction for this student-question pair
    const beforeProbability = this.getPrediction(studentId, question.id, topicMastery);

    return {
      questionId: question.id,
      questionData: question,
      topic: selectedTopic,
      rationale: {
        currentMastery: topicMastery,
        targetComplexity: 0.3 + (topicMastery * 0.5),
        complexityGap: Math.abs((question.complexity ?? 0.5) - (0.3 + topicMastery * 0.5)),
        reason: `最弱知识点 "${selectedTopic}" → 复杂度匹配`,
      },
      beforeProbability,
    };
  }

  /**
   * Step 2: Submit answer and get feedback
   *
   * Returns before/after comparison for feedback display
   */
  async submitAnswer(
    studentId: string,
    questionId: string,
    isCorrect: boolean
  ): Promise<FeedbackResult> {
    // Get BEFORE state
    const beforeExplanation = this.uok.explain({ studentId });
    if (beforeExplanation.type !== 'student') {
      throw new Error('Student not found');
    }

    // Get question to determine topic
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { knowledgePoints: true },
    });

    if (!question) {
      throw new Error('Question not found');
    }

    const topics = this.parseKnowledgePoints(question.knowledgePoints);
    const topic = topics[0] ?? 'unknown';

    const masteryBefore = this.getTopicMastery(beforeExplanation, topic);

    // Encode question if not already done
    this.uok.encodeQuestion({
      id: questionId,
      content: '',
      topics,
    });

    // Get BEFORE prediction (UOK-recommended question)
    const beforeProbability = this.uok.encodeAnswer(studentId, questionId, isCorrect);

    // SIMULATE: What if we had used random?
    // Get a random question from same topic and calculate its probability
    const randomResult = await this.simulateRandomPrediction(studentId, topic, masteryBefore);

    // Save state
    await this.uok.saveStudentState(studentId);

    // Get AFTER state
    const afterExplanation = this.uok.explain({ studentId });
    if (afterExplanation.type !== 'student') {
      throw new Error('Failed to get after state');
    }

    const masteryAfter = this.getTopicMastery(afterExplanation, topic);

    // Calculate next target complexity
    const nextTargetComplexity = 0.3 + (masteryAfter * 0.5);

    // 🔬 Record experiment data
    const currentQuestion = await prisma.question.findUnique({
      where: { id: questionId },
      select: { complexity: true },
    });

    experimentTracker.record({
      timestamp: Date.now(),
      questionId,
      topic,
      uokPrediction: beforeProbability,
      uokComplexity: currentQuestion?.complexity ?? 0.5,
      randomPrediction: randomResult.probability,
      randomComplexity: randomResult.complexity,
      isCorrect,
      masteryBefore,
      masteryAfter,
    });

    return {
      beforeProbability,
      randomProbability: randomResult.probability,
      masteryBefore,
      masteryAfter,
      nextTargetComplexity,
      isCorrect,
      topic,
    };
  }

  /**
   * Simulate what probability would be with a random question
   *
   * This is the "control group" - what would happen without UOK
   */
  private async simulateRandomPrediction(
    studentId: string,
    topic: string,
    mastery: number
  ): Promise<{ probability: number; complexity: number }> {
    // Get random questions from same topic
    const questions = await prisma.question.findMany({
      where: {
        extractionStatus: 'SUCCESS',
        complexity: { not: null },
      },
      select: {
        id: true,
        complexity: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        knowledgePoints: true,
      },
      take: 50,
    });

    // Filter by topic
    const topicQuestions = questions.filter(q => {
      const kpList = this.parseKnowledgePoints(q.knowledgePoints as any);
      return kpList.some(kp => kp.includes(topic) || topic.includes(kp));
    });

    if (topicQuestions.length === 0) {
      // Fallback: use mastery as random probability
      return { probability: mastery, complexity: mastery };
    }

    // Pick a random question (simulating Python backend behavior)
    const randomIndex = Math.floor(Math.random() * topicQuestions.length);
    const randomQuestion = topicQuestions[randomIndex];

    // Calculate probability for this random question
    try {
      const probability = this.uok.predict(studentId, randomQuestion.id, {
        difficulty: mastery,
        complexity: randomQuestion.complexity ?? mastery,
      });
      return {
        probability,
        complexity: randomQuestion.complexity ?? mastery,
      };
    } catch {
      // Fallback if prediction fails
      return { probability: mastery, complexity: mastery };
    }
  }

  /**
   * Get current ML prediction for a student-question pair
   */
  private getPrediction(studentId: string, questionId: string, mastery: number): number {
    // Use UOK predict if question is encoded
    try {
      return this.uok.predict(studentId, questionId, {
        difficulty: mastery,
        complexity: mastery,
      });
    } catch {
      // Fallback: use mastery as probability
      return mastery;
    }
  }

  /**
   * Find question by topic with complexity matching
   *
   * IMPORTANT: Handle knowledge point granularity mismatch:
   * - Questions may use parent KP names: "勾股定理"
   * - UserKnowledge may use child KP IDs: "kp17-2-folding" (勾股定理折叠问题)
   * - Solution: Try exact match first, then fallback to parent KP matching
   */
  private async findQuestionByTopic(
    topic: string,
    targetComplexity: number,
    excludeIds: string[]
  ): Promise<any | null> {
    console.log('[findQuestionByTopic] START - topic:', topic, 'targetComplexity:', targetComplexity, 'excludeIds:', excludeIds.length);

    // FIX Layer0: topic is knowledgePoint ID (e.g., kp16-1-definition),
    // but question.knowledgePoints stores topic NAME (e.g., "二次根式的定义").
    // Need to map ID -> name before matching.

    // Get topic name from KnowledgePoint table
    let topicName = topic; // fallback to ID if not found
    const kpRecord = await prisma.knowledgePoint.findUnique({
      where: { id: topic },
      select: { name: true, chapterId: true },
    });
    if (kpRecord?.name) {
      topicName = kpRecord.name;
    }
    console.log('[findQuestionByTopic] topic ID -> name:', topic, '->', topicName);

    // FIX Layer1: Do NOT use take:N + JS filter.
    // take:N samples N rows randomly; if the topic's questions are not among
    // those rows, the result is empty even though questions exist.
    // FIX: Query ALL SUCCESS questions, then filter by topic in JavaScript.
    // With ~1000 SUCCESS questions this is acceptable (<10ms in SQLite).
    const where: any = { extractionStatus: 'SUCCESS' };
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const questions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        content: true,
        difficulty: true,
        type: true,
        answer: true,
        knowledgePoints: true,
        cognitiveLoad: true,
        reasoningDepth: true,
        complexity: true,
      },
      orderBy: { id: 'asc' },
    });
    console.log('[findQuestionByTopic] Total SUCCESS questions:', questions.length);

    // Filter by topic NAME in JavaScript (not SQL) to guarantee correctness
    // Support both ID match (legacy data) and name match
    // IMPORTANT: Use partial matching because topic names may differ:
    // - UserKnowledge has "勾股定理折叠问题"
    // - Question has "勾股定理"
    // Both should match!
    const filtered = questions.filter(q => {
      const kpList = this.parseKnowledgePoints(q.knowledgePoints);
      return kpList.some(kp => {
        // Direct name match (primary)
        if (kp.includes(topicName) || topicName.includes(kp)) return true;
        // ID match (fallback for legacy data)
        if (kp.includes(topic) || topic.includes(kp)) return true;
        // Partial match: check if either string contains the other's key parts
        // This handles "勾股定理" matching "勾股定理折叠问题"
        const shorter = kp.length < topicName.length ? kp : topicName;
        const longer = kp.length < topicName.length ? topicName : kp;
        // If the shorter string is at least 3 chars and is a substring of the longer
        if (shorter.length >= 3 && longer.includes(shorter)) return true;
        return false;
      });
    });
    console.log('[findQuestionByTopic] Filtered questions for topic', topicName, ':', filtered.length);
    if (filtered.length > 0) {
      console.log('[findQuestionByTopic] Sample question KPs:', filtered.slice(0, 3).map(q => ({ id: q.id, kps: q.knowledgePoints })));
    }

    if (filtered.length === 0) {
      // FALLBACK: Try matching against parent knowledge points
      // If topic is "勾股定理折叠问题", try matching questions with "勾股定理"
      const parentTopicName = this.extractParentTopic(topicName);
      console.log('[findQuestionByTopic] No direct match, trying parent topic:', parentTopicName);
      if (parentTopicName && parentTopicName !== topicName) {
        const parentFiltered = questions.filter(q => {
          const kpList = this.parseKnowledgePoints(q.knowledgePoints);
          return kpList.some(kp => {
            if (kp.includes(parentTopicName) || parentTopicName.includes(kp)) return true;
            const shorter = kp.length < parentTopicName.length ? kp : parentTopicName;
            const longer = kp.length < parentTopicName.length ? parentTopicName : kp;
            if (shorter.length >= 3 && longer.includes(shorter)) return true;
            return false;
          });
        });
        console.log('[findQuestionByTopic] Parent filtered questions:', parentFiltered.length);
        if (parentFiltered.length > 0) {
          // Use parent-filtered questions
          parentFiltered.sort((a, b) => {
            const aComplex = a.complexity ?? (a.difficulty ? a.difficulty / 10 : 0.5);
            const bComplex = b.complexity ?? (b.difficulty ? b.difficulty / 10 : 0.5);
            return Math.abs(aComplex - targetComplexity) - Math.abs(bComplex - targetComplexity);
          });
          console.log('[findQuestionByTopic] Returning parent match question:', parentFiltered[0].id);
          return parentFiltered[0];
        }
      }
      console.log('[findQuestionByTopic] No questions found, returning null');
      return null;
    }

    // FIX Layer1: Use difficulty as fallback for missing complexity
    // The questions table has difficulty (1-3) but complexity is NULL
    // effectiveComplexity = complexity ?? (difficulty / 10)
    const getEffectiveComplexity = (q: typeof questions[0]): number => {
      if (q.complexity !== null && q.complexity !== undefined) {
        return q.complexity;
      }
      // Fallback: difficulty is 1-10 scale, normalize to 0-1
      return q.difficulty ? q.difficulty / 10 : 0.5;
    };

    const scored = filtered.map(q => {
      const effectiveComplexity = getEffectiveComplexity(q);
      return {
        question: q,
        gap: Math.abs(effectiveComplexity - targetComplexity),
      };
    });

    scored.sort((a, b) => a.gap - b.gap);

    console.log('[findQuestionByTopic] Returning matched question:', scored[0].question.id, 'gap:', scored[0].gap);
    return scored[0].question;
  }

  /**
   * Extract parent topic name from child topic
   * Examples:
   * - "勾股定理折叠问题" -> "勾股定理"
   * - "二次根式的乘法法则" -> "二次根式"
   * - "平行四边形判定" -> "平行四边形"
   */
  private extractParentTopic(topicName: string): string | null {
    // Common parent-child patterns in Chinese math
    const patterns = [
      { suffix: '折叠问题', parent: '勾股定理' },
      { suffix: '逆定理', parent: '勾股定理' },
      { suffix: '应用题', parent: '勾股定理' },
      { suffix: '的乘法法则', parent: '二次根式' },
      { suffix: '的除法法则', parent: '二次根式' },
      { suffix: '的加减运算', parent: '二次根式' },
      { suffix: '的定义', parent: '' },  // Keep prefix
      { suffix: '的性质', parent: '' },  // Keep prefix
      { suffix: '的识别', parent: '' },  // Keep prefix
      { suffix: '判定', parent: '' },     // Keep prefix
      { suffix: '性质', parent: '' },     // Keep prefix
    ];

    for (const pattern of patterns) {
      if (topicName.endsWith(pattern.suffix)) {
        if (pattern.parent) {
          return pattern.parent;
        }
        return topicName.substring(0, topicName.length - pattern.suffix.length);
      }
    }

    // Generic fallback: extract first meaningful part
    // "勾股定理折叠问题" -> "勾股定理" (remove trailing descriptive words)
    const descriptiveWords = ['问题', '应用', '方法', '法则', '定义', '性质', '判定', '识别'];
    for (const word of descriptiveWords) {
      if (topicName.endsWith(word)) {
        return topicName.substring(0, topicName.length - word.length);
      }
    }

    return null;
  }

  private getTopicMastery(explanation: any, topic: string): number {
    if (explanation.type !== 'student') return 0.5;
    return explanation.weakTopics.find((t: any) => t.topic === topic)?.mastery ?? 0.5;
  }

  private parseKnowledgePoints(kp: unknown): string[] {
    if (!kp) return [];

    if (Array.isArray(kp)) {
      return kp.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          return (item as { id?: string; name?: string }).id || (item as { id?: string; name?: string }).name || '';
        }
        return String(item);
      }).filter(Boolean);
    }

    if (typeof kp === 'string') {
      try {
        const parsed = JSON.parse(kp);
        if (Array.isArray(parsed)) {
          return parsed.map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
              return (item as { id?: string; name?: string }).id || (item as { id?: string; name?: string }).name || '';
            }
            return String(item);
          }).filter(Boolean);
        }
      } catch { /* ignore */ }
    }

    if (typeof kp === 'object' && kp !== null) {
      const obj = kp as { id?: string; name?: string };
      return [obj.id || obj.name || ''].filter(Boolean);
    }

    return [];
  }
}

// Singleton instance
let flowServiceInstance: UOKFlowService | null = null;

export function getUOKFlowService(): UOKFlowService {
  if (!flowServiceInstance) {
    flowServiceInstance = new UOKFlowService();
  }
  return flowServiceInstance;
}
