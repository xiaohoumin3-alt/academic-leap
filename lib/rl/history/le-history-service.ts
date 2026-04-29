// lib/rl/history/le-history-service.ts

export interface LEHistoryEntry {
  questionId: string;
  correct: boolean;
  timestamp: Date;
}

export interface LEHistoryData {
  correct: number;
  total: number;
  history: LEHistoryEntry[];
}

export interface LEHistoryService {
  getAccuracy(userId: string, knowledgePointId: string): number | Promise<number>;
  updateAccuracy(userId: string, knowledgePointId: string, correct: boolean): number | Promise<number>;
  getHistory(userId: string, knowledgePointId: string, window?: number): LEHistoryEntry[] | Promise<LEHistoryEntry[]>;
}

export class InMemoryLEHistoryService implements LEHistoryService {
  private cache: Map<string, LEHistoryData> = new Map();

  private key(userId: string, kpId: string): string {
    return `${userId}:${kpId}`;
  }

  getAccuracy(userId: string, knowledgePointId: string): number {
    const data = this.cache.get(this.key(userId, knowledgePointId));
    if (!data || data.total === 0) return 0.5; // Prior
    return data.correct / data.total;
  }

  updateAccuracy(
    userId: string,
    knowledgePointId: string,
    correct: boolean
  ): number {
    const key = this.key(userId, knowledgePointId);
    const data = this.cache.get(key) ?? this.createEmpty();

    data.correct += correct ? 1 : 0;
    data.total += 1;
    data.history.push({
      questionId: crypto.randomUUID(),
      correct,
      timestamp: new Date()
    });

    this.cache.set(key, data);
    return data.correct / data.total;
  }

  getHistory(
    userId: string,
    knowledgePointId: string,
    window: number = 100
  ): LEHistoryEntry[] {
    const data = this.cache.get(this.key(userId, knowledgePointId));
    if (!data) return [];
    return data.history.slice(-window);
  }

  private createEmpty(): LEHistoryData {
    return {
      correct: 0,
      total: 0,
      history: []
    };
  }
}

// Prisma-based implementation for production
export class PrismaLEHistoryService implements LEHistoryService {
  constructor(private prisma: any) {}

  async getAccuracy(userId: string, knowledgePointId: string): Promise<number> {
    const state = await this.prisma.lEKnowledgePointState.findUnique({
      where: {
        userId_knowledgePointId: {
          userId,
          knowledgePointId
        }
      }
    });

    if (!state || state.total === 0) return 0.5;
    return state.correct / state.total;
  }

  async updateAccuracy(
    userId: string,
    knowledgePointId: string,
    correct: boolean
  ): Promise<number> {
    const state = await this.prisma.lEKnowledgePointState.upsert({
      where: {
        userId_knowledgePointId: {
          userId,
          knowledgePointId
        }
      },
      create: {
        userId,
        knowledgePointId,
        correct: correct ? 1 : 0,
        total: 1,
        accuracy: correct ? 1 : 0
      },
      update: {
        correct: { increment: correct ? 1 : 0 },
        total: { increment: 1 },
        accuracy: {},
        lastUpdatedAt: new Date()
      }
    });

    // Recalculate accuracy
    const updated = await this.prisma.lEKnowledgePointState.findUnique({
      where: { id: state.id }
    });

    if (!updated) throw new Error('Failed to update state');

    const newAccuracy = updated.correct / updated.total;
    await this.prisma.lEKnowledgePointState.update({
      where: { id: state.id },
      data: { accuracy: newAccuracy }
    });

    return newAccuracy;
  }

  async getHistory(
    userId: string,
    knowledgePointId: string,
    window: number = 100
  ): Promise<LEHistoryEntry[]> {
    // This would require a separate history table
    // For MVP, return empty array
    return [];
  }
}
