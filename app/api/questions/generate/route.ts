import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTemplateIdByKnowledgePointId, getTemplate, QuestionProtocol, StepProtocol } from '@/lib/question-engine';
import { renderQuestion } from '@/lib/question-engine/render';
import { detectProtocolVersion } from '@/lib/question-engine/migrate';
import { StepProtocolV2, AnswerMode } from '@/lib/question-engine/protocol-v2';
import { RuleBasedExtractor } from '@/lib/qie/rule-based-extractor';

// Union type for questions that may use either v1 or v2 protocol
type QuestionProtocolUnion = Omit<QuestionProtocol, 'steps'> & {
  steps: Array<StepProtocol | StepProtocolV2>;
};

// Question type enum
type QuestionType = 'calculation' | 'fill_blank';

/**
 * 生成单个题目
 */
async function generateSingleQuestion(
  knowledgePoint: string,
  difficulty: number,
  renderStyle: 'standard' | 'guided' | 'gamified' | 'story',
  questionType: QuestionType = 'calculation'
): Promise<QuestionProtocolUnion> {
  // 填空题使用 AI 直接生成，不需要模板
  if (questionType === 'fill_blank') {
    return generateFillBlankQuestion(knowledgePoint, difficulty, renderStyle);
  }

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

/**
 * 生成填空题（AI直接生成，不使用模板）
 */
async function generateFillBlankQuestion(
  knowledgePoint: string,
  difficulty: number,
  renderStyle: 'standard' | 'guided' | 'gamified' | 'story'
): Promise<QuestionProtocolUnion> {
  const { ModelAdapter } = await import('@/lib/ai/model-adapter');

  const prompt = `
请为初中生生成一道关于"${knowledgePoint}"的填空题。

要求：
1. 包含3-5个空
2. 每个空有明确的数值答案
3. 题目考察核心概念和计算
4. 使用___表示空格

请返回JSON格式：
{
  "question": "题目描述，用___表示空格，例如：已知x²=9，则x=___",
  "blanks": [
    {"position": 1, "answer": "3或-3"},
    {"position": 2, "answer": "..."}
  ]
}
`;

  const adapter = new ModelAdapter({ model: 'claude-sonnet-4.6' });
  const response = await adapter.generate(prompt, {
    responseFormat: 'json',
    maxTokens: 1500
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('生成填空题失败');
  }

  const data = parsed as {
    question: string;
    blanks?: { position: number; answer: string }[];
  };

  // 将填空题转换为步骤格式
  const steps: StepProtocolV2[] = (data.blanks || []).map((blank, index) => ({
    stepId: `s${index + 1}`,
    answerMode: AnswerMode.EXPRESSION,
    ui: {
      instruction: `第${index + 1}空`,
      hint: '',
      inputPlaceholder: '输入答案',
    },
    keyboard: {
      type: 'qwerty',
      extraKeys: [],
    },
    expectedAnswer: {
      type: 'string',
      value: blank.answer,
      tolerance: 0,
    },
  }));

  const question: QuestionProtocolUnion = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    knowledgePoint,
    templateId: 'fill_blank_ai',
    difficultyLevel: difficulty,
    params: {},
    steps,
    content: {
      title: '填空题',
      description: data.question,
      context: `知识点：${knowledgePoint}，难度：${difficulty}`,
    },
    meta: {
      version: '2.0',
      source: 'template_engine_v2',
    },
  };

  return question;
}

// POST /api/questions/generate - 使用模板引擎生成题目
export async function POST(req: NextRequest) {
  let knowledgePoint = '二次函数';  // 默认知识点
  let difficulty = 2;
  let count = 1;
  let renderStyle: 'standard' | 'guided' | 'gamified' | 'story' = 'standard';
  let questionType: QuestionType = 'calculation';

  try {
    const requestData = await req.json();
    knowledgePoint = requestData.knowledgePoint || '二次函数';
    difficulty = requestData.difficulty || 2;
    count = requestData.count || 1;
    renderStyle = requestData.renderStyle || 'standard';
    questionType = requestData.type === 'fill_blank' ? 'fill_blank' : 'calculation';

    console.log('=== 使用模板引擎生成题目 ===', { knowledgePoint, difficulty, count, renderStyle, questionType });
  } catch (e) {
    console.error('解析请求失败:', e);
  }

  // 限制生成数量
  if (count > 10) {
    count = 10;
  }

  // 填空题和模板题型使用不同的生成路径
  if (questionType === 'fill_blank') {
    try {
      const questions: QuestionProtocolUnion[] = [];

      for (let i = 0; i < count; i++) {
        const question = await generateFillBlankQuestion(
          knowledgePoint,
          difficulty,
          renderStyle
        );
        questions.push(question);
      }

      return NextResponse.json({
        success: true,
        questions: questions.map(q => ({
          id: q.id,
          templateId: q.templateId,
          knowledgePoint: q.knowledgePoint,
          difficultyLevel: q.difficultyLevel,
          params: q.params,
          steps: q.steps,
          content: q.content,
          meta: q.meta,
          type: 'fill_blank',
        })),
      });
    } catch (error) {
      console.error('生成填空题错误:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : '生成失败',
      }, { status: 500 });
    }
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

    // 提取复杂度特征 - 优先使用规则提取确保成功
    try {
      const questionsForExtraction = savedQuestions.map((q, i) => ({
        id: q.id,
        content: {
          title: questions[i].content.title || '',
          description: questions[i].content.context || questions[i].content.description || '',
        },
      }));

      // 先用规则提取（保证成功）
      const ruleExtractor = new RuleBasedExtractor();
      const ruleResults = await ruleExtractor.extractBatch(questionsForExtraction);

      // 更新每个题目的复杂度特征（使用规则提取结果）
      const updatePromises = savedQuestions.map(async (q) => {
        const result = ruleResults.get(q.id);
        if (result) {
          return prisma.question.update({
            where: { id: q.id },
            data: {
              complexity: result.features.complexity,
              cognitiveLoad: result.features.cognitiveLoad,
              reasoningDepth: result.features.reasoningDepth,
              extractionStatus: 'SUCCESS',
              featuresExtractedAt: new Date(),
            },
          });
        } else {
          return prisma.question.update({
            where: { id: q.id },
            data: {
              extractionStatus: 'FAILED',
              extractionError: 'Rule-based extraction returned no result',
            },
          });
        }
      });

      await Promise.all(updatePromises);
    } catch (extractionError) {
      console.error('复杂度特征提取失败:', extractionError);
      // 不影响主流程
    }

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