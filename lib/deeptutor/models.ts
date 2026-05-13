/**
 * DeepTutor 题目生成模块类型系统
 * 独立于现有 GeneratedQuestionType (fill_blank | multiple_choice | short_answer)
 */

export type DeepTutorQuestionType = 'choice' | 'written' | 'calculation';
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * 题目模板（由 IdeaAgent 生成）
 */
export interface QuestionTemplate {
  question_id: string;
  concentration: string;
  question_type: DeepTutorQuestionType;
  difficulty: Difficulty;
  source: 'custom';
  rationale?: string;
}

/**
 * 问答对（由 Generator 生成）
 */
export interface QAPair {
  question_id: string;
  question: string;
  question_type: DeepTutorQuestionType;
  options?: Record<string, string>;
  correct_answer: string;
  explanation: string;
  concentration: string;
  difficulty: Difficulty;
}

/**
 * 生成请求
 */
export interface GenerationRequest {
  mode: 'custom';
  topic: string;
  preference?: string;
  knowledgeContext?: string;
  count: number;
  difficulty?: Difficulty;
  questionType?: DeepTutorQuestionType;
}

/**
 * 生成结果
 */
export interface GenerationResult {
  success: boolean;
  error?: string;
  source: 'topic';
  requested: number;
  template_count: number;
  completed: number;
  failed: number;
  results: Array<{
    template: QuestionTemplate;
    qa_pair: QAPair;
    success: boolean;
  }>;
}

/**
 * IdeaAgent 响应格式
 */
export interface IdeaAgentResponse {
  ideas: Array<{
    idea_id: string;
    concentration: string;
    question_type: DeepTutorQuestionType;
    difficulty: Difficulty;
    rationale: string;
  }>;
}

/**
 * Generator 响应格式
 */
export interface GeneratorResponse {
  question_type: DeepTutorQuestionType;
  question: string;
  options: Record<string, string> | null;
  correct_answer: string;
  explanation: string;
}
