/**
 * Prediction Service - Prisma 数据存储
 *
 * 使用 Prisma + SQLite 存储学生能力和预测日志
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ============================================================
// Types (Prisma 生成)
// ============================================================

interface StudentAbility {
  id: string;
  userId: string;
  nodeId: string;
  ability: number;
  sampleSize: number;
  lastUpdated: Date;
  createdAt: Date;
}

interface PredictionLog {
  id: string;
  userId: string;
  questionId: string | null;
  predicted: number;
  actual: boolean | null;
  metadata: object | null;
  createdAt: Date;
}

interface StudentHistory {
  studentId: string;
  recentAnswers: Array<{
    questionId: string;
    correct: boolean;
    timestamp: number;
    difficulty: number;
  }>;
  abilityByNode: Map<string, {
    ability: number;
    sampleSize: number;
  }>;
}

// A/B Testing types
interface ExperimentAssignmentRecord {
  id: string;
  experimentId: string;
  userId: string;
  variant: string;
  assignedAt: Date;
}

interface MetricObservationRecord {
  id: string;
  experimentId: string;
  userId: string;
  variant: string;
  metricName: string;
  value: number;
  timestamp: Date;
}

// ============================================================
// Prisma Store
// ============================================================

export class PrismaStore {
  private prisma: PrismaClient;

  constructor(databaseUrl?: string) {
    this.prisma = new PrismaClient({
      datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    });
  }

  /**
   * 获取学生能力
   */
  async getStudentAbility(userId: string, nodeId: string): Promise<{ ability: number; sampleSize: number } | null> {
    try {
      const record = await this.prisma.studentAbility.findUnique({
        where: {
          userId_nodeId: { userId, nodeId }
        }
      });

      if (record) {
        return {
          ability: record.ability,
          sampleSize: record.sampleSize
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get student ability:', error);
      return null;
    }
  }

  /**
   * 获取学生所有知识点能力
   */
  async getAllStudentAbilities(userId: string): Promise<Map<string, { ability: number; sampleSize: number }>> {
    const abilities = new Map<string, { ability: number; sampleSize: number }>();

    try {
      const records = await this.prisma.studentAbility.findMany({
        where: { userId }
      });

      for (const record of records) {
        abilities.set(record.nodeId, {
          ability: record.ability,
          sampleSize: record.sampleSize
        });
      }
    } catch (error) {
      console.error('Failed to get all student abilities:', error);
    }

    return abilities;
  }

  /**
   * 更新学生能力（指数移动平均）
   */
  async updateStudentAbility(
    userId: string,
    nodeId: string,
    correct: boolean
  ): Promise<void> {
    try {
      const actual = correct ? 1 : 0;
      // 映射到 [-2, 2] 区间
      const abilityValue = (actual - 0.5) * 4;

      // 查找现有记录
      const existing = await this.prisma.studentAbility.findUnique({
        where: { userId_nodeId: { userId, nodeId } }
      });

      if (existing) {
        // 指数移动平均更新
        const alpha = 1 / (existing.sampleSize + 1);
        const newAbility = (1 - alpha) * existing.ability + alpha * abilityValue;
        const newSampleSize = existing.sampleSize + 1;

        await this.prisma.studentAbility.update({
          where: { userId_nodeId: { userId, nodeId } },
          data: {
            ability: newAbility,
            sampleSize: newSampleSize,
            lastUpdated: new Date()
          }
        });
      } else {
        // 创建新记录
        await this.prisma.studentAbility.create({
          data: {
            userId,
            nodeId,
            ability: abilityValue,
            sampleSize: 1
          }
        });
      }
    } catch (error) {
      console.error('Failed to update student ability:', error);
    }
  }

  /**
   * 记录预测日志
   */
  async logPrediction(params: {
    userId: string;
    questionId?: string;
    predicted: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.predictionLog.create({
        data: {
          userId: params.userId,
          questionId: params.questionId || null,
          predicted: params.predicted,
          metadata: (params.metadata ?? null) as any
        }
      });
    } catch (error) {
      console.error('Failed to log prediction:', error);
    }
  }

  /**
   * 更新预测结果（后续标注实际结果）
   */
  async updatePredictionResult(
    userId: string,
    questionId: string,
    actual: boolean
  ): Promise<void> {
    try {
      // 找到最近的预测并更新
      const prediction = await this.prisma.predictionLog.findFirst({
        where: {
          userId,
          questionId,
          actual: null
        },
        orderBy: { createdAt: 'desc' }
      });

      if (prediction) {
        await this.prisma.predictionLog.update({
          where: { id: prediction.id },
          data: { actual }
        });
      }
    } catch (error) {
      console.error('Failed to update prediction result:', error);
    }
  }

  /**
   * 获取学生历史（用于能力估计）
   */
  async getStudentHistory(userId: string, days: number = 30): Promise<StudentHistory> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      // 获取最近的预测日志
      const predictions = await this.prisma.predictionLog.findMany({
        where: {
          userId,
          createdAt: { gte: since }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      // 获取所有知识点能力
      const abilities = await this.getAllStudentAbilities(userId);

      return {
        studentId: userId,
        recentAnswers: predictions.map(p => ({
          questionId: p.questionId || 'unknown',
          correct: p.actual ?? (Math.random() > 0.5), // 如果没有实际结果，使用随机值
          timestamp: p.createdAt.getTime(),
          difficulty: 0.5 // 默认难度
        })),
        abilityByNode: abilities
      };
    } catch (error) {
      console.error('Failed to get student history:', error);
      return {
        studentId: userId,
        recentAnswers: [],
        abilityByNode: new Map()
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // A/B Testing Persistence
  // ============================================================

  /**
   * 保存实验分配
   */
  async saveExperimentAssignment(params: {
    experimentId: string;
    userId: string;
    variant: string;
  }): Promise<void> {
    try {
      // 存储在PredictionLog的metadata中（复用表）
      // 未来可以创建独立的 ExperimentAssignment 表
      await this.prisma.predictionLog.create({
        data: {
          userId: params.userId,
          questionId: `experiment:${params.experimentId}`,
          predicted: params.variant === 'treatment' ? 1 : 0,
          metadata: {
            type: 'experiment_assignment',
            experimentId: params.experimentId,
            variant: params.variant,
            assignedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Failed to save experiment assignment:', error);
      throw error;
    }
  }

  /**
   * 保存指标观察
   */
  async saveMetricObservation(params: {
    experimentId: string;
    userId: string;
    variant: string;
    metricName: string;
    value: number;
  }): Promise<void> {
    try {
      await this.prisma.predictionLog.create({
        data: {
          userId: params.userId,
          questionId: `metric:${params.experimentId}:${params.metricName}`,
          predicted: params.value,
          metadata: {
            type: 'metric_observation',
            experimentId: params.experimentId,
            variant: params.variant,
            metricName: params.metricName,
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Failed to save metric observation:', error);
      throw error;
    }
  }

  /**
   * 获取实验分配记录
   */
  async getExperimentAssignment(
    experimentId: string,
    userId: string
  ): Promise<{ variant: string; assignedAt: Date } | null> {
    try {
      const records = await this.prisma.predictionLog.findMany({
        where: {
          userId,
          questionId: { startsWith: `experiment:${experimentId}` },
          metadata: {
            path: ['type'],
            equals: 'experiment_assignment'
          }
        } as any,
        orderBy: { createdAt: 'desc' },
        take: 1
      });

      if (records.length === 0) return null;

      const metadata = records[0].metadata as Record<string, unknown>;
      return {
        variant: metadata?.variant as string,
        assignedAt: records[0].createdAt
      };
    } catch (error) {
      console.error('Failed to get experiment assignment:', error);
      return null;
    }
  }

  /**
   * 获取实验指标观察
   */
  async getMetricObservations(
    experimentId: string,
    metricName?: string
  ): Promise<Array<{ userId: string; variant: string; value: number; timestamp: Date }>> {
    try {
      const questionIdPattern = metricName
        ? `metric:${experimentId}:${metricName}`
        : { startsWith: `metric:${experimentId}:` };

      const records = await this.prisma.predictionLog.findMany({
        where: {
          questionId: questionIdPattern,
          metadata: {
            path: ['type'],
            equals: 'metric_observation'
          }
        } as any,
        orderBy: { createdAt: 'asc' }
      });

      return records.map(r => {
        const metadata = r.metadata as Record<string, unknown>;
        return {
          userId: r.userId,
          variant: metadata?.variant as string,
          value: r.predicted,
          timestamp: r.createdAt
        };
      });
    } catch (error) {
      console.error('Failed to get metric observations:', error);
      return [];
    }
  }
}
