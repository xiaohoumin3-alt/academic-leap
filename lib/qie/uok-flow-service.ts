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

    if (action.type !== 'recommend' && action.type !== 'recommend_question') {
      return null;
    }

    // Get student mastery for this topic
    const explanation = this.uok.explain({ studentId });
    if (explanation.type !== 'student') {
      return null;
    }

    // FIX Layer2: Iterate through weak topics until finding one with available questions.
    // This prevents returning null when the top-weakest topic has no SUCCESS questions.
    const weakTopicsRanked = explanation.weakTopics;

    let selectedTopic: string | null = null;
    let topicMastery = 0.5;
    let question: any | null = null;

    for (const wt of weakTopicsRanked) {
      const targetComplexity = 0.3 + (wt.mastery * 0.5);
      question = await this.findQuestionByTopic(wt.topic, targetComplexity, excludeIds);
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
   */
  private async findQuestionByTopic(
    topic: string,
    targetComplexity: number,
    excludeIds: string[]
  ): Promise<any | null> {
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

    // Filter by topic in JavaScript (not SQL) to guarantee correctness
    const filtered = questions.filter(q => {
      const kpList = this.parseKnowledgePoints(q.knowledgePoints);
      return kpList.some(kp => kp.includes(topic) || topic.includes(kp));
    });

    if (filtered.length === 0) {
      return null;
    }

    // Find best match by complexity
    const scored = filtered.map(q => {
      const effectiveComplexity = q.complexity ?? (q.difficulty ? q.difficulty / 10 : 0.5);
      return {
        question: q,
        gap: Math.abs(effectiveComplexity - targetComplexity),
      };
    });

    scored.sort((a, b) => a.gap - b.gap);

    return scored[0].question;
  }

  private getTopicMastery(explanation: any, topic: string): number {
    if (explanation.type !== 'student') return 0.5;
    return explanation.weakTopics.find((t: any) => t.topic === topic)?.mastery ?? 0.5;
  }

  private parseKnowledgePoints(kp: string | null): string[] {
    if (!kp) return [];
    try {
      const parsed = JSON.parse(kp);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return kp.split(',').map(s => s.trim()).filter(Boolean);
    }
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
