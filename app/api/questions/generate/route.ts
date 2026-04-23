import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateQuestions as engineGenerateQuestions, QuestionProtocol } from '@/lib/question-engine';

// 知识点映射（模板返回英文，数据库需要中文）
const INTERNAL_TO_KNOWLEDGE: Record<string, string> = {
  'quadratic_function': '二次函数',
  'pythagoras_theorem': '勾股定理',
  'probability': '概率统计',
  'linear_equation': '一元一次方程',
};

// 模板引擎使用中文键查找
const KNOWLEDGE_TO_TEMPLATES: Record<string, string[]> = {
  '二次函数': ['quadratic_vertex', 'quadratic_evaluate'],
  '勾股定理': ['pythagoras'],
  '概率统计': ['probability'],
  '一元一次方程': ['linear_equation'],
};

/**
 * 将模板返回的英文知识点转为中文（用于数据库存储）
 */
function mapToChinese(knowledgePoint: string): string {
  return INTERNAL_TO_KNOWLEDGE[knowledgePoint] || knowledgePoint;
}

// POST /api/questions/generate - 使用模板引擎生成题目
export async function POST(req: NextRequest) {
  let knowledgePoint = '二次函数';  // 使用中文知识点名称
  let difficulty = 2;
  let count = 1;
  let renderStyle: 'standard' | 'guided' | 'gamified' | 'story' = 'standard';

  try {
    const requestData = await req.json();
    // 直接使用中文知识点名称，不转换（模板引擎期望中文）
    knowledgePoint = requestData.knowledgePoint || '二次函数';
    difficulty = requestData.difficulty || 2;
    count = requestData.count || 1;
    renderStyle = requestData.renderStyle || 'standard';

    console.log('=== 使用模板引擎生成题目 ===', { knowledgePoint, difficulty, count, renderStyle });
  } catch (e) {
    console.error('解析请求失败:', e);
  }

  try {
    // 使用模板引擎生成题目
    const questions = await engineGenerateQuestions(
      knowledgePoint,
      count,
      difficulty,
      renderStyle
    );

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到匹配的题目模板',
      }, { status: 400 });
    }

    // 保存到数据库
    const savedQuestions = await Promise.all(
      questions.map(async (q) => {
        const question = await prisma.question.create({
          data: {
            type: 'calculation',
            difficulty,
            content: JSON.stringify(q.content),
            answer: '', // 答案在步骤中
            hint: q.content.context || '',
            knowledgePoints: JSON.stringify([mapToChinese(q.knowledgePoint)]),
            isAI: renderStyle !== 'standard', // 非标准风格使用了AI
            templateId: q.templateId,
            params: JSON.stringify(q.params),
            stepTypes: JSON.stringify(q.steps.map(s => s.type)),
          },
        });

        // 创建 QuestionStep 并获取返回的 id
        const createdSteps = await Promise.all(
          q.steps.map(async (step) => {
            const stepNumber = parseInt(step.stepId.replace('s', ''));
            const created = await prisma.questionStep.create({
              data: {
                questionId: question.id,
                stepNumber,
                expression: step.ui.instruction,
                answer: '',
                hint: step.ui.inputHint,
                type: step.type,
                inputType: step.inputType,
                keyboard: step.keyboard,
                tolerance: step.tolerance,
              },
            });
            // 返回带 id 的步骤信息，用于前端提交时关联
            return {
              ...step,
              id: created.id,
              stepNumber,
            };
          })
        );

        return { ...question, stepsWithIds: createdSteps };
      })
    );

    return NextResponse.json({
      success: true,
      questions: savedQuestions.map((q, i) => ({
        id: q.id,
        templateId: questions[i].templateId,
        knowledgePoint: mapToChinese(questions[i].knowledgePoint),  // 转为中文
        difficultyLevel: questions[i].difficultyLevel,
        params: questions[i].params,
        steps: q.stepsWithIds,  // 返回带数据库 id 的步骤
        content: questions[i].content,
        meta: questions[i].meta,
      })),
    });
  } catch (error) {
    console.error('生成题目错误:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '生成失败',
    }, { status: 500 });
  }
}
