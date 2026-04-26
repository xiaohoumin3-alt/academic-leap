import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTemplateIdByKnowledgePointId, getTemplate, QuestionProtocol, StepProtocol } from '@/lib/question-engine';
import { renderQuestion } from '@/lib/question-engine/render';
import { detectProtocolVersion } from '@/lib/question-engine/migrate';
import { StepProtocolV2 } from '@/lib/question-engine/protocol-v2';

// Union type for questions that may use either v1 or v2 protocol
type QuestionProtocolUnion = Omit<QuestionProtocol, 'steps'> & {
  steps: Array<StepProtocol | StepProtocolV2>;
};

/**
 * 生成单个题目
 */
async function generateSingleQuestion(
  knowledgePoint: string,
  difficulty: number,
  renderStyle: 'standard' | 'guided' | 'gamified' | 'story'
): Promise<QuestionProtocolUnion> {
  // 1. 根据知识点获取模板ID
  const templateId = await getTemplateIdByKnowledgePointId(knowledgePoint);

  if (!templateId) {
    throw new Error(`该知识点 "${knowledgePoint}" 暂未配置题目模板，请联系管理员`);
  }

  // 2. 获取模板实例
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`模板 "${templateId}" 不存在`);
  }

  // 3. 生成参数
  const params = template.generateParams(difficulty);

  // 4. 构建步骤
  const steps = template.buildSteps(params);

  // 5. 渲染内容
  const content = template.render(params);

  // 6. 组装题目协议
  const question: QuestionProtocol = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    knowledgePoint,
    templateId,
    difficultyLevel: difficulty,
    params,
    steps: steps as StepProtocol[],  // Template may return v1 or v2, cast for compatibility
    content,
    meta: {
      version: '1.0',
      source: 'template_engine',
    },
  };

  // 7. AI增强渲染（可选）
  const renderedQuestion = await renderQuestion(question, renderStyle);
  return renderedQuestion as QuestionProtocolUnion;
}

// POST /api/questions/generate - 使用模板引擎生成题目
export async function POST(req: NextRequest) {
  let knowledgePoint = '二次函数';  // 默认知识点
  let difficulty = 2;
  let count = 1;
  let renderStyle: 'standard' | 'guided' | 'gamified' | 'story' = 'standard';

  try {
    const requestData = await req.json();
    knowledgePoint = requestData.knowledgePoint || '二次函数';
    difficulty = requestData.difficulty || 2;
    count = requestData.count || 1;
    renderStyle = requestData.renderStyle || 'standard';

    console.log('=== 使用模板引擎生成题目 ===', { knowledgePoint, difficulty, count, renderStyle });
  } catch (e) {
    console.error('解析请求失败:', e);
  }

  // 限制生成数量
  if (count > 10) {
    count = 10;
  }

  try {
    // 生成题目（数据库驱动）
    const questions: QuestionProtocolUnion[] = [];

    for (let i = 0; i < count; i++) {
      const question = await generateSingleQuestion(
        knowledgePoint,
        difficulty,
        renderStyle
      );
      questions.push(question);
    }

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: `知识点 "${knowledgePoint}" 暂未配置题目模板，请联系管理员`,
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
            knowledgePoints: JSON.stringify([knowledgePoint]), // 直接使用中文知识点
            isAI: renderStyle !== 'standard', // 非标准风格使用了AI
            templateId: q.templateId,
            params: JSON.stringify(q.params),
            stepTypes: JSON.stringify(q.steps.map(s => 'type' in s ? s.type : (s as StepProtocolV2).answerMode)),
          },
        });

        // 创建 QuestionStep 并获取返回的 id
        // 检测协议版本
        const isV2Protocol = q.steps.length > 0 && detectProtocolVersion(q.steps[0]) === 'v2';

        const createdSteps = await Promise.all(
          q.steps.map(async (step) => {
            const stepNumber = parseInt(step.stepId.replace('s', ''));
            const ui = (step as any).ui || {};

            // v2 协议：保存完整 expectedAnswer
            const stepAnswer = isV2Protocol && 'expectedAnswer' in step
              ? JSON.stringify({
                  expectedAnswer: (step as StepProtocolV2).expectedAnswer,
                })
              : JSON.stringify({
                  instruction: ui.instruction || '',
                  inputTarget: ui.inputTarget || '',
                  inputHint: ui.inputHint || '',
                  inputType: (step as StepProtocol).inputType,
                  keyboard: (step as StepProtocol).keyboard,
                  tolerance: (step as StepProtocol).tolerance,
                  type: (step as StepProtocol).type,
                });

            const created = await prisma.questionStep.create({
              data: {
                questionId: question.id,
                stepNumber,
                expression: ui.instruction || '',
                answer: stepAnswer,
                hint: ui.inputHint || '',
                type: isV2Protocol ? 'v2' : ((step as StepProtocol).type as string),
                inputType: isV2Protocol ? 'numeric' : ((step as StepProtocol).inputType || 'numeric'),
                keyboard: isV2Protocol ? 'numeric' : ((step as StepProtocol).keyboard || 'numeric'),
                tolerance: isV2Protocol ? undefined : (step as StepProtocol).tolerance,
              },
            });

            return {
              ...step,
              id: created.id,
              stepNumber,
              ui,
              isV2: isV2Protocol,
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
        knowledgePoint: questions[i].knowledgePoint,
        difficultyLevel: questions[i].difficultyLevel,
        params: questions[i].params,
        steps: q.stepsWithIds,  // 返回带数据库 id 的步骤
        content: questions[i].content,
        meta: questions[i].meta,
      })),
    });
  } catch (error) {
    console.error('生成题目错误:', error);

    // 区分不同类型的错误
    const errorMessage = error instanceof Error ? error.message : '生成失败';

    if (errorMessage.includes('暂未配置题目模板')) {
      return NextResponse.json({
        success: false,
        error: errorMessage,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}