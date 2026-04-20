/**
 * 真实后端API客户端
 * 对接 Python FastAPI 后端
 */

// 开发环境使用本地，生产环境使用Railway
const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://academic-leap-backend.up.railway.app';

interface ApiResponse<T = any> {
  detail?: string;
  [key: string]: any;
}

/**
 * 真实后端API - 对接核心功能
 */
export const realApi = {
  // ==================== 用户 ====================
  /**
   * 创建新用户
   */
  async createUser(name: string, grade?: number) {
    const res = await fetch(`${API_BASE}/api/assessments/users?name=${encodeURIComponent(name)}${grade ? `&grade=${grade}` : ''}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('创建用户失败');
    return res.json() as Promise<{ id: string; name: string; grade?: number; created_at: string }>;
  },

  /**
   * 获取用户能力数据
   */
  async getAbilities(userId: string) {
    const res = await fetch(`${API_BASE}/api/questions/abilities/${userId}`);
    if (!res.ok) throw new Error('获取能力数据失败');
    return res.json() as Promise<Array<{
      user_id: string;
      knowledge_id: number;
      knowledge_name: string;
      level: number;
      stable_pass_count: number;
      last_updated: string;
    }>>;
  },

  // ==================== 题目 ====================
  /**
   * 获取下一题
   */
  async getNextQuestion(userId: string, knowledgeId: number = 1) {
    const res = await fetch(`${API_BASE}/api/questions/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        knowledge_id: knowledgeId,
      }),
    });
    if (!res.ok) throw new Error('获取题目失败');
    return res.json() as Promise<{
      question_id: string;
      content: string;
      level: number;
      input_type: string;
    }>;
  },

  // ==================== 答案 ====================
  /**
   * 提交答案
   */
  async submitAnswer(userId: string, questionId: string, answer: string, timeUsed: number) {
    const res = await fetch(`${API_BASE}/api/answers/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        question_id: questionId,
        answer,
        time_used: timeUsed,
      }),
    });
    if (!res.ok) throw new Error('提交答案失败');
    return res.json() as Promise<{
      is_correct: boolean;
      new_level: number;
      feedback: string;
      correct_answer?: string;
    }>;
  },

  /**
   * 获取估分
   */
  async getEstimateScore(userId: string) {
    const res = await fetch(`${API_BASE}/api/answers/estimate-score/${userId}`);
    if (!res.ok) throw new Error('获取估分失败');
    return res.json() as Promise<{
      score: number;
      range: string;
      breakdown: Array<{ knowledge: string; score: number }>;
    }>;
  },

  // ==================== 测评 ====================
  /**
   * 开始测评
   */
  async startAssessment(userId: string) {
    const res = await fetch(`${API_BASE}/api/assessments/start?user_id=${userId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('开始测评失败');
    return res.json() as Promise<{
      assessment_id: string;
      questions: Array<{
        question_id: string;
        content: string;
        level: number;
        knowledge_id: number;
        knowledge_name: string;
        input_type: string;
      }>;
    }>;
  },

  /**
   * 获取测评历史
   */
  async getAssessmentHistory(userId: string) {
    const res = await fetch(`${API_BASE}/api/assessments/history/${userId}`);
    if (!res.ok) throw new Error('获取测评历史失败');
    return res.json() as Promise<Array<{
      id: string;
      score_estimate: number | null;
      score_range: string | null;
      created_at: string;
    }>>;
  },

  // ==================== 知识点 ====================
  /**
   * 知识点列表（硬编码）
   */
  getKnowledgePoints() {
    return [
      { id: 1, name: '一元一次方程', subject: '数学', score_weight: 30 },
      { id: 2, name: '有理数运算', subject: '数学', score_weight: 25 },
      { id: 3, name: '三角形角度', subject: '数学', score_weight: 20 },
    ];
  },
};

/**
 * 兼容旧API - 适配前端现有组件
 */
export const userApi = {
  async getStats() {
    // 返回模拟统计，真实数据需要从后端获取
    return {
      totalAttempts: 0,
      averageScore: 75,
      totalMinutes: 0,
      completionRate: 0,
    };
  },
};

export const analyticsApi = {
  async getOverview() {
    return {
      overview: {
        totalAttempts: 0,
        completedAttempts: 0,
        averageScore: 75,
        totalMinutes: 0,
        completionRate: 0,
      },
      dailyData: [],
      topKnowledge: [],
    };
  },

  async getRecommendations() {
    return {
      recommendations: [],
      todayPractice: [
        { knowledgePoint: '一元一次方程', suggestedCount: 20, reason: '二次函数强化训练' },
        { knowledgePoint: '代数基础', suggestedCount: 15, reason: '方程求解强化' },
      ],
      insights: {
        weakPoints: ['函数极值问题', '三角函数', '数列求和'],
        strongPoints: [],
        avgScore: 75,
        speedLevel: 'normal',
      },
    };
  },
};

export default realApi;
