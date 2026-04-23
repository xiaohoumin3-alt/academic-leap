/**
 * Gemini API 封装
 * 使用 Google 官方 SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY not configured');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// 使用可用的模型
const MODEL_NAME = 'models/gemma-4-31b-it';

export interface GenerateQuestionOptions {
  type: 'calculation' | 'geometry' | 'algebra';
  difficulty: number;
  knowledgePoint: string;
  count?: number;
}

export interface QuestionStep {
  stepNumber: number;
  expression: string;
  answer: string;
  hint: string;
}

export interface GeneratedQuestion {
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
  steps: QuestionStep[];
}

export interface VerifyAnswerOptions {
  questionId?: string;
  stepNumber: number;
  userAnswer: string;
  questionContext?: string;
  correctAnswer?: string;
  expression?: string;
}

export interface VerifyResult {
  isCorrect: boolean;
  feedback: string;
  hint?: string;
}

export async function generateQuestions(
  options: GenerateQuestionOptions
): Promise<GeneratedQuestion[]> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const { type, difficulty, knowledgePoint, count = 1 } = options;

  const prompt = buildGeneratePrompt(type, difficulty, knowledgePoint, count);

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return parseGeneratedQuestions(text, type, difficulty, knowledgePoint);
  } catch (error) {
    console.error('生成题目失败:', error);
    throw error;
  }
}

export async function verifyAnswer(
  options: VerifyAnswerOptions
): Promise<VerifyResult> {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const {
    stepNumber,
    userAnswer,
    questionContext,
    correctAnswer,
    expression,
  } = options;

  const prompt = buildVerifyPrompt(
    stepNumber,
    userAnswer,
    questionContext,
    correctAnswer,
    expression
  );

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return parseVerifyResult(text);
  } catch (error) {
    console.error('批改失败:', error);
    throw error;
  }
}

function buildGeneratePrompt(
  type: string,
  difficulty: number,
  knowledgePoint: string,
  count: number
): string {
  const difficultyDesc = {
    1: '非常简单，适合初学者',
    2: '简单，基础练习',
    3: '中等，需要一定思考',
    4: '较难，需要综合运用',
    5: '困难，挑战性题目',
  }[difficulty] || '中等';

  return `请生成${count}道${difficultyDesc}的${type === 'calculation' ? '计算题' : type === 'geometry' ? '几何题' : '代数题'}，知识点为"${knowledgePoint}"。

要求：
1. 每道题包含3-5个步骤，每个步骤都有明确的表达式和答案
2. 答案必须是简化后的分数或整数，不要小数
3. 每个步骤提供提示信息
4. 题目要有实际的教学意义

请严格按照以下JSON格式输出，不要包含其他文字：

[
  {
    "title": "题目标题",
    "description": "题目描述",
    "answer": "最终答案",
    "hint": "解题提示",
    "steps": [
      {
        "stepNumber": 1,
        "expression": "步骤表达式",
        "answer": "步骤答案",
        "hint": "步骤提示"
      }
    ]
  }
]`;
}

function buildVerifyPrompt(
  stepNumber: number,
  userAnswer: string,
  questionContext?: string,
  correctAnswer?: string,
  expression?: string
): string {
  return `请批改学生的第${stepNumber}步答案。

题目内容：${questionContext || '无'}
步骤表达式：${expression || '无'}
正确答案：${correctAnswer || '无'}
学生答案：${userAnswer}

请判断学生答案是否正确，并给出反馈。请严格按照以下JSON格式输出：

{
  "isCorrect": true/false,
  "feedback": "反馈内容",
  "hint": "提示信息（可选）"
}`;
}

function parseGeneratedQuestions(
  text: string,
  type: string,
  difficulty: number,
  knowledgePoint: string
): GeneratedQuestion[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('无法解析生成的题目');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return parsed.map((q: any) => ({
      type,
      difficulty,
      content: {
        title: q.title || '练习题',
        description: q.description || '',
        context: q.context || '',
      },
      answer: q.answer || '',
      hint: q.hint || '',
      knowledgePoints: [knowledgePoint],
      steps: q.steps || [],
    }));
  } catch (error) {
    console.error('解析题目失败:', error);
    throw new Error('题目格式错误');
  }
}

function parseVerifyResult(text: string): VerifyResult {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析批改结果');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      isCorrect: parsed.isCorrect || false,
      feedback: parsed.feedback || '',
      hint: parsed.hint,
    };
  } catch (error) {
    console.error('解析批改结果失败:', error);
    throw new Error('批改结果格式错误');
  }
}
