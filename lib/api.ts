/**
 * API 客户端
 * 封装所有后端API调用
 */

const API_BASE = '/api';

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

/**
 * 认证相关API
 */
export const authApi = {
  /**
   * 用户注册
   */
  async register(data: { email: string; password: string; name?: string; grade?: number }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ id: string; email: string }>>;
  },

  /**
   * 获取当前会话
   */
  async getSession() {
    const res = await fetch(`${API_BASE}/auth/session`);
    return res.json() as Promise<ApiResponse<{ user: { id: string; email: string; name?: string } }>>;
  },
};

/**
 * 用户相关API
 */
export const userApi = {
  /**
   * 获取用户资料
   */
  async getProfile() {
    const res = await fetch(`${API_BASE}/user/profile`);
    return res.json() as Promise<ApiResponse<{ id: string; email: string; name?: string; grade?: number; targetScore?: number }>>;
  },

  /**
   * 更新用户资料
   */
  async updateProfile(data: { name?: string; grade?: number; targetScore?: number }) {
    const res = await fetch(`${API_BASE}/user/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse>;
  },

  /**
   * 获取学习统计
   */
  async getStats() {
    const res = await fetch(`${API_BASE}/user/stats`);
    return res.json() as Promise<ApiResponse<{
      totalAttempts: number;
      averageScore: number;
      totalMinutes: number;
      completionRate: number;
    }>>;
  },

  /**
   * 获取用户学习设置
   */
  async getSettings() {
    const res = await fetch(`${API_BASE}/user/settings`);
    return res.json() as Promise<ApiResponse<UserSettings & { selectedTextbook?: { id: string; name: string; year: string } }>>;
  },

  /**
   * 更新用户学习设置
   */
  async updateSettings(data: UserSettings) {
    const res = await fetch(`${API_BASE}/user/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<UserSettings>>;
  },

  /**
   * 获取知识点树
   */
  async getKnowledgeTree(expand = false) {
    const res = await fetch(`${API_BASE}/user/knowledge-tree?expand=${expand}`);
    return res.json() as Promise<ApiResponse<KnowledgeTreeResponse>>;
  },

  /**
   * 勾选/取消知识点
   */
  async toggleKnowledge(data: { nodeId: string; nodeType: 'chapter' | 'point'; enabled: boolean; cascade?: boolean }) {
    const res = await fetch(`${API_BASE}/user/knowledge/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ affectedCount: number }>>;
  },

  /**
   * 智能推荐
   */
  async recommend(overwrite = false) {
    const res = await fetch(`${API_BASE}/user/knowledge/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overwrite }),
    });
    return res.json() as Promise<ApiResponse<{
      recommendedChapterId: string;
      recommendedChapterName: string;
      progress: number;
      enabledCount: number;
      executed: boolean;
    }>>;
  },

  /**
   * 获取进度计算
   */
  async getProgress() {
    const res = await fetch(`${API_BASE}/user/progress`);
    return res.json() as Promise<ApiResponse<{
      currentChapter: { id: string; chapterNumber: number; chapterName: string } | null;
      progress: number;
      completedChapters: number;
      totalChapters: number;
      enabledKnowledgeCount: number;
      totalKnowledgeCount: number;
    }>>;
  },
};

/**
 * 题目相关API
 */
export const questionsApi = {
  /**
   * 获取题目列表
   */
  async list(params?: { type?: string; difficulty?: number; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.difficulty) searchParams.set('difficulty', params.difficulty.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const res = await fetch(`${API_BASE}/questions?${searchParams}`);
    return res.json() as Promise<ApiResponse<{ questions: Question[] }>>;
  },

  /**
   * 获取单题详情
   */
  async get(id: string) {
    const res = await fetch(`${API_BASE}/questions/${id}`);
    return res.json() as Promise<ApiResponse<Question>>;
  },

  /**
   * AI生成新题目
   */
  async generate(data: { type: string; difficulty: number; knowledgePoint: string; count?: number }) {
    const res = await fetch(`${API_BASE}/questions/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ questions: Question[] }>>;
  },

  /**
   * AI批改答案
   */
  async verify(data: { questionId?: string; stepNumber: number; userAnswer: string; duration: number }) {
    const res = await fetch(`${API_BASE}/questions/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ isCorrect: boolean; feedback: string; behaviorTag: string }>>;
  },
};

/**
 * 练习相关API
 */
export const practiceApi = {
  /**
   * 开始练习
   */
  async start(data: { mode: 'training' | 'diagnostic'; questionId?: string }) {
    const res = await fetch(`${API_BASE}/practice/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ attemptId: string }>>;
  },

  /**
   * 提交单步答案
   */
  async submit(data: { attemptId: string; stepNumber: number; userAnswer: string; isCorrect: boolean; duration: number; questionStepId?: string | null }) {
    const res = await fetch(`${API_BASE}/practice/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ attemptStep: { id: string } }>>;
  },

  /**
   * 完成练习
   */
  async finish(data: { attemptId: string; score: number; duration: number }) {
    const res = await fetch(`${API_BASE}/practice/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<ApiResponse<{ attempt: { id: string; score: number } }>>;
  },

  /**
   * 获取练习历史
   */
  async getHistory(limit?: number) {
    const searchParams = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_BASE}/practice/history${searchParams}`);
    return res.json() as Promise<ApiResponse<{ attempts: Attempt[] }>>;
  },
};

/**
 * 学习分析API
 */
export const analyticsApi = {
  /**
   * 获取概览数据
   */
  async getOverview() {
    const res = await fetch(`${API_BASE}/analytics/overview`);
    return res.json() as Promise<ApiResponse<{
      overview: {
        totalAttempts: number;
        completedAttempts: number;
        averageScore: number;
        lowestScore: number;
        totalMinutes: number;
        completionRate: number;
        dataReliability: 'high' | 'medium' | 'low';
        volatilityRange: number;
        initialAssessmentCompleted?: boolean;
        initialAssessmentScore?: number;
        // Calibration fields
        needsCalibration: boolean;
        calibratedStartingScore: number | null;
        startingScoreCalibrated: boolean;
        // Stats for "My" page
        totalQuestions: number;
        correctRate: number;
      };
      dailyData: Array<{ date: string; count: number; avgScore: number }>;
      topKnowledge: Array<{ knowledgePoint: string; mastery: number }>;
    }>>;
  },

  /**
   * 获取知识点掌握
   */
  async getKnowledge() {
    const res = await fetch(`${API_BASE}/analytics/knowledge`);
    return res.json() as Promise<ApiResponse<{
      knowledge: Array<{ knowledgePoint: string; mastery: number; practiceCount: number; lastPractice: string; recentAccuracy: number }>;
      summary: { total: number; mastered: number; learning: number; weak: number };
    }>>;
  },

  /**
   * 获取学习时间线
   */
  async getTimeline(days?: number) {
    const searchParams = days ? `?days=${days}` : '';
    const res = await fetch(`${API_BASE}/analytics/timeline${searchParams}`);
    return res.json() as Promise<ApiResponse<{
      timeline: Array<{ date: string; count: number; avgScore: number; totalMinutes: number; accuracy: number }>;
      summary: { totalAttempts: number; avgScore: number; totalMinutes: number; overallAccuracy: number; currentStreak: number; maxStreak: number };
    }>>;
  },

  /**
   * 获取AI建议
   */
  async getRecommendations() {
    const res = await fetch(`${API_BASE}/analytics/recommendations`);
    return res.json() as Promise<ApiResponse<{
      recommendations: Array<{ type: string; title: string; description: string; priority: number }>;
      todayPractice: Array<{ knowledgePoint: string; suggestedCount: number; reason: string }>;
      insights: { weakPoints: string[]; strongPoints: string[]; avgScore: number; speedLevel: string };
    }>>;
  },
};

/**
 * 用户设置类型定义
 */
export interface UserSettings {
  selectedGrade?: number;
  selectedSubject?: string;
  selectedTextbookId?: string;
  studyProgress?: number;
}

export interface KnowledgeTreeNode {
  id: string;
  chapterNumber?: number;
  chapterName?: string;
  name?: string;
  type?: 'chapter' | 'point';
  enabled: boolean;
  conceptId?: string;
  conceptName?: string;
  knowledgePoints?: KnowledgeTreeNode[];
}

export interface KnowledgeTreeResponse {
  textbook: {
    id: string;
    name: string;
    grade: number;
    subject: string;
  };
  chapters: KnowledgeTreeNode[];
  enabledCount: number;
  totalCount: number;
}

/**
 * 类型定义
 */
export interface Question {
  id: string;
  type: string;
  difficulty: number;
  content: {
    title: string;
    description: string;
    context: string;
  };
  answer: string;
  hint: string;
  knowledgePoints: string[];
  steps?: QuestionStep[];
  isAI?: boolean;
}

export interface QuestionStep {
  id?: string;
  questionId?: string;
  stepNumber: number;
  expression: string;
  answer: string;
  hint: string;
  instruction?: string;
  inputTarget?: string;
  inputHint?: string;
  ui?: { instruction?: string; inputTarget?: string; inputHint?: string };
  keyboard?: 'numeric' | 'coordinate' | 'fraction' | 'full';
}

export interface Attempt {
  id: string;
  userId: string;
  mode: string;
  score: number;
  duration: number;
  startedAt: string;
  completedAt: string | null;
  steps?: AttemptStep[];
}

export interface AttemptStep {
  id: string;
  attemptId: string;
  stepNumber: number;
  userAnswer: string;
  isCorrect: boolean;
  duration: number;
  submittedAt: string;
}
