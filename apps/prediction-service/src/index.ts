/**
 * Prediction Service v1.0
 *
 * ⭐ Layer 1 Core - 生产决策的唯一依据
 *
 * 功能：
 * - 答题正确率预测
 * - 难度推荐
 * - 批量预测
 *
 * 部署：
 * - Docker: apps/prediction-service/Dockerfile
 * - Port: 3001
 * - Health: /health
 *
 * 运行：
 * ```bash
 * cd apps/prediction-service
 * npm start
 * ```
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';

// ============================================================
// Types
// ============================================================

interface PredictionRequest {
  studentId: string;
  questionId?: string;
  questionFeatures?: {
    difficulty: number;
    discrimination: number;
    knowledgeNodes: string[];
  };
  count?: number; // 批量预测数量
}

interface PredictionResponse {
  studentId: string;
  predictions: Array<{
    questionId: string;
    probability: number;
    confidence: number;
  }>;
  metadata: {
    modelVersion: string;
    timestamp: number;
    latency: number;
  };
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

// ============================================================
// Prediction Model (IRT-based)
// ============================================================

class PredictionModel {
  private version = '1.0.0';

  /**
   * 核心预测函数
   *
   * P(correct) = sigmoid(ability - difficulty)
   *
   * 其中：
   * - ability: 学生能力（从历史估计）
   * - difficulty: 题目难度
   */
  predict(
    studentHistory: StudentHistory,
    questionFeatures: { difficulty: number; knowledgeNodes: string[] }
  ): { probability: number; confidence: number } {
    // 1. 估计学生能力
    const ability = this.estimateAbility(studentHistory, questionFeatures.knowledgeNodes);

    // 2. IRT 预测
    const theta = ability.ability;
    const beta = questionFeatures.difficulty;

    // P(correct) = 1 / (1 + exp(-(theta - beta)))
    const logit = theta - beta;
    const probability = 1 / (1 + Math.exp(-logit));

    // 3. 置信度（基于样本量）
    const confidence = Math.min(0.95, 0.5 + ability.sampleSize * 0.045);

    return {
      probability: Math.max(0.05, Math.min(0.95, probability)),
      confidence
    };
  }

  /**
   * 能力估计
   */
  private estimateAbility(
    studentHistory: StudentHistory,
    knowledgeNodes: string[]
  ): { ability: number; sampleSize: number } {
    // 找到相关知识点的能力估计
    let totalAbility = 0;
    let totalWeight = 0;
    let totalSamples = 0;

    for (const node of knowledgeNodes) {
      const nodeAbility = studentHistory.abilityByNode.get(node);
      if (nodeAbility && nodeAbility.sampleSize > 0) {
        const weight = Math.min(1, nodeAbility.sampleSize / 5); // 5题达到满权重
        totalAbility += nodeAbility.ability * weight;
        totalWeight += weight;
        totalSamples += nodeAbility.sampleSize;
      }
    }

    // 如果没有相关知识点估计，使用整体平均
    if (totalWeight === 0) {
      const recentCorrect = studentHistory.recentAnswers.slice(-20)
        .filter(a => a.correct).length;
      const recentTotal = Math.min(20, studentHistory.recentAnswers.length);

      // 映射到 [-2, 2] 区间（IRT 标准尺度）
      const rawRate = recentTotal > 0 ? recentCorrect / recentTotal : 0.5;
      const ability = (rawRate - 0.5) * 4;

      return {
        ability: Math.max(-2, Math.min(2, ability)),
        sampleSize: recentTotal
      };
    }

    return {
      ability: totalAbility / totalWeight,
      sampleSize: Math.round(totalSamples / knowledgeNodes.length)
    };
  }

  getVersion(): string {
    return this.version;
  }
}

// ============================================================
// Feature Store (Mock - 实际连接 Redis/DB)
// ============================================================

class FeatureStore {
  private studentHistories = new Map<string, StudentHistory>();

  async getStudentHistory(studentId: string): Promise<StudentHistory> {
    // 实际实现：从 Redis/Postgres 读取
    let history = this.studentHistories.get(studentId);

    if (!history) {
      // 初始化空历史
      history = {
        studentId,
        recentAnswers: [],
        abilityByNode: new Map()
      };
      this.studentHistories.set(studentId, history);
    }

    return history;
  }

  async updateAnswer(
    studentId: string,
    questionId: string,
    correct: boolean,
    difficulty: number,
    knowledgeNodes: string[]
  ): Promise<void> {
    const history = await this.getStudentHistory(studentId);

    // 更新最近答案
    history.recentAnswers.push({
      questionId,
      correct,
      timestamp: Date.now(),
      difficulty
    });

    // 只保留最近100题
    if (history.recentAnswers.length > 100) {
      history.recentAnswers = history.recentAnswers.slice(-100);
    }

    // 更新知识点能力
    for (const node of knowledgeNodes) {
      let nodeAbility = history.abilityByNode.get(node);

      if (!nodeAbility) {
        nodeAbility = { ability: 0, sampleSize: 0 };
        history.abilityByNode.set(node, nodeAbility);
      }

      // 指数移动平均
      const alpha = 1 / (nodeAbility.sampleSize + 1);
      const correctValue = correct ? 1 : 0;
      // 映射到 [-2, 2]
      const abilityValue = (correctValue - 0.5) * 4;

      nodeAbility.ability = (1 - alpha) * nodeAbility.ability + alpha * abilityValue;
      nodeAbility.sampleSize++;
    }
  }

  // 批量预热（用于测试）
  async warmup(): Promise<void> {
    // 模拟3个学生的历史数据
    const students = [
      { id: 'stu1', baseAbility: 1.0 },  // 强
      { id: 'stu2', baseAbility: 0.0 },  // 中
      { id: 'stu3', baseAbility: -1.0 }  // 弱
    ];

    for (const { id, baseAbility } of students) {
      const nodes = ['algebra', 'geometry', 'statistics'];

      for (let i = 0; i < 20; i++) {
        const difficulty = (i % 5) * 0.2 - 0.4; // -0.4 to 0.4
        const prob = 1 / (1 + Math.exp(-(baseAbility - difficulty)));
        const correct = Math.random() < prob;

        await this.updateAnswer(id, `q_${i}`, correct, difficulty, nodes);
      }
    }
  }
}

// ============================================================
// Service
// ============================================================

class PredictionService {
  private fastify: FastifyInstance;
  private model: PredictionModel;
  private featureStore: FeatureStore;

  constructor() {
    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info'
      }
    });

    this.model = new PredictionModel();
    this.featureStore = new FeatureStore();

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // CORS
    this.fastify.register(cors, {
      origin: true
    });

    // Health check
    this.fastify.get('/health', async () => ({
      status: 'ok',
      model: this.model.getVersion(),
      timestamp: Date.now()
    }));

    // Predict (single question)
    this.fastify.post('/predict', {
      schema: {
        body: {
          type: 'object',
          required: ['studentId'],
          properties: {
            studentId: { type: 'string' },
            questionId: { type: 'string' },
            questionFeatures: {
              type: 'object',
              properties: {
                difficulty: { type: 'number', minimum: 0, maximum: 1 },
                discrimination: { type: 'number' },
                knowledgeNodes: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: PredictionRequest }>, reply: FastifyReply) => {
      const startTime = Date.now();

      const { studentId, questionId = 'unknown', questionFeatures } = request.body;

      // 默认题目特征
      const features = questionFeatures || {
        difficulty: 0.5,
        discrimination: 0.8,
        knowledgeNodes: ['general']
      };

      // 获取学生历史
      const history = await this.featureStore.getStudentHistory(studentId);

      // 预测
      const { probability, confidence } = this.model.predict(history, features);

      const latency = Date.now() - startTime;

      return {
        studentId,
        predictions: [{
          questionId,
          probability,
          confidence
        }],
        metadata: {
          modelVersion: this.model.getVersion(),
          timestamp: Date.now(),
          latency
        }
      };
    });

    // Batch predict
    this.fastify.post('/predict/batch', {
      schema: {
        body: {
          type: 'object',
          required: ['studentId', 'count'],
          properties: {
            studentId: { type: 'string' },
            count: { type: 'number', minimum: 1, maximum: 100 }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: PredictionRequest }>, reply: FastifyReply) => {
      const startTime = Date.now();

      const { studentId, count = 10 } = request.body;

      const history = await this.featureStore.getStudentHistory(studentId);

      // 生成不同难度的预测
      const predictions = [];
      for (let i = 0; i < count; i++) {
        const difficulty = i / (count - 1);
        const { probability, confidence } = this.model.predict(history, {
          difficulty,
          knowledgeNodes: ['general']
        });

        predictions.push({
          questionId: `generated_${i}`,
          probability,
          confidence
        });
      }

      const latency = Date.now() - startTime;

      return {
        studentId,
        predictions,
        metadata: {
          modelVersion: this.model.getVersion(),
          timestamp: Date.now(),
          latency
        }
      };
    });

    // Record answer (feedback loop)
    this.fastify.post('/feedback', {
      schema: {
        body: {
          type: 'object',
          required: ['studentId', 'questionId', 'correct'],
          properties: {
            studentId: { type: 'string' },
            questionId: { type: 'string' },
            correct: { type: 'boolean' },
            difficulty: { type: 'number' },
            knowledgeNodes: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }, async (request: FastifyRequest<{ Body: { studentId: string; questionId: string; correct: boolean; difficulty?: number; knowledgeNodes?: string[] } }>, reply: FastifyReply) => {
      const { studentId, questionId, correct, difficulty = 0.5, knowledgeNodes = ['general'] } = request.body;

      await this.featureStore.updateAnswer(
        studentId,
        questionId,
        correct,
        difficulty,
        knowledgeNodes
      );

      return { recorded: true, timestamp: Date.now() };
    });

    // Get student profile
    this.fastify.get('/students/:studentId', async (request: FastifyRequest<{ Params: { studentId: string } }>, reply: FastifyReply) => {
      const { studentId } = request.params;
      const history = await this.featureStore.getStudentHistory(studentId);

      const abilities = Array.from(history.abilityByNode.entries()).map(([node, data]) => ({
        node,
        ability: data.ability,
        sampleSize: data.sampleSize
      }));

      return {
        studentId,
        abilities,
        totalAnswers: history.recentAnswers.length,
        recentCorrectRate: history.recentAnswers.length > 0
          ? history.recentAnswers.slice(-20).filter(a => a.correct).length / Math.min(20, history.recentAnswers.length)
          : 0.5
      };
    });
  }

  async start(port: number = 3001): Promise<void> {
    // 预热数据
    await this.featureStore.warmup();

    try {
      await this.fastify.listen({ port, host: '0.0.0.0' });
      console.log(`🚀 Prediction Service listening on port ${port}`);
      console.log(`📊 Model version: ${this.model.getVersion()}`);
      console.log(`🔍 Health check: http://localhost:${port}/health`);
    } catch (err) {
      this.fastify.log.error(err);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.fastify.close();
  }
}

// ============================================================
// Main
// ============================================================

if (require.main === module) {
  const service = new PredictionService();

  const port = parseInt(process.env.PORT || '3001', 10);
  service.start(port);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await service.stop();
    process.exit(0);
  });
}

export { PredictionService, PredictionModel, FeatureStore };
