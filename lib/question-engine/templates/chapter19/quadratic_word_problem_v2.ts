/**
 * 一元二次方程应用题模板 v2 - 深度思考题
 *
 * 核心改进：
 * - 三段式推理链（理解→建模→求解）
 * - 认知层次评估
 * - 深度思考题标识
 * - 先实现2种场景验证：area_optimization, max_profit
 */

import {
  QuestionTemplate,
} from '../../protocol';
import {
  DIFFICULTY_CONFIG,
  generateRandomParams,
} from '../../difficulty';
import {
  StepProtocolV2,
  AnswerMode,
  QuestionProtocolV2,
} from '../../protocol-v2';

/**
 * 应用题类型（v2仅实现2种）
 */
type WordProblemTypeV2 = 'area_optimization' | 'max_profit';

/**
 * 认知层次评估
 */
interface CognitiveLevel {
  understanding: number;  // 理解题意：1-5
  modeling: number;       // 建立模型：1-5
  solving: number;        // 求解验证：1-5
}

/**
 * 深度思考题元数据
 */
interface DeepThinkingMetadata {
  isDeepThinking: true;
  deepType: 'optimization' | 'growth' | 'geometry' | 'special';
  cognitiveLevel: CognitiveLevel;
  reasoningDepth: number;  // 推理深度：0-1
}

/**
 * 计算认知层次
 *
 * 根据难度和问题类型，评估三个认知层次的等级
 */
function calculateCognitiveLevel(
  difficulty: number,
  problemType: WordProblemTypeV2
): CognitiveLevel {
  const baseLevel = Math.min(difficulty, 5);

  switch (problemType) {
    case 'area_optimization':
      // 面积优化：理解题意较难，建模中等，求解较易
      return {
        understanding: Math.min(baseLevel + 1, 5),
        modeling: baseLevel,
        solving: Math.max(baseLevel - 1, 2),
      };

    case 'max_profit':
      // 利润问题：理解题意中等，建模较难，求解中等
      return {
        understanding: baseLevel,
        modeling: Math.min(baseLevel + 1, 5),
        solving: baseLevel,
      };

    default:
      return {
        understanding: baseLevel,
        modeling: baseLevel,
        solving: baseLevel,
      };
  }
}

/**
 * 计算推理深度
 *
 * 基于认知层次的综合评估
 */
function calculateReasoningDepth(cognitiveLevel: CognitiveLevel): number {
  const { understanding, modeling, solving } = cognitiveLevel;
  // 推理深度 = (理解 + 建模 + 求解) / 15，归一化到 0-1
  return (understanding + modeling + solving) / 15;
}

/**
 * 一元二次方程应用题模板 v2
 */
export const QuadraticWordProblemTemplateV2: QuestionTemplate = {
  id: 'quadratic_word_problem_v2',
  knowledgePoint: 'quadratic_word_problem',
  weight: 5, // 深度思考题权重更高

  generateParams: (level: number) => {
    const config = DIFFICULTY_CONFIG.quadratic_word_problem[level] ||
                   DIFFICULTY_CONFIG.quadratic_word_problem[1];

    const params = generateRandomParams(config);

    // v2仅实现2种场景：area_optimization, max_profit
    const problemTypeIndex = Math.random() < 0.5 ? 1 : 2; // 1=area, 2=profit

    params.problemTypeIndex = problemTypeIndex;
    params.type = Math.floor(Math.random() * 2);
    params.level = level;

    return params;
  },

  buildSteps: (params: Record<string, number>) => {
    const problemType = params.problemTypeIndex;
    const difficulty = params.level || 3;

    if (problemType === 1) {
      // area_optimization：矩形菜园面积优化
      return buildAreaOptimizationSteps(params, difficulty);
    } else if (problemType === 2) {
      // max_profit：利润最大化
      return buildMaxProfitSteps(params, difficulty);
    }

    // 兜底（不应到达）
    return [];
  },

  render: (params: Record<string, number>) => {
    const problemType = params.problemTypeIndex;

    if (problemType === 1) {
      return renderAreaOptimization(params);
    } else if (problemType === 2) {
      return renderMaxProfit(params);
    }

    return {
      title: '应用题',
      description: '一元二次方程实际应用',
      context: '请根据题意计算',
    };
  },
};

/**
 * 面积优化问题的三段式推理链
 */
function buildAreaOptimizationSteps(
  params: Record<string, number>,
  difficulty: number
): StepProtocolV2[] {
  const perimeter = params.a;

  return [
    // 第1步：理解题意
    {
      stepId: 's1',
      answerMode: AnswerMode.MULTIPLE_CHOICE,
      ui: {
        instruction: '这个问题的核心是求什么的最值？',
        hint: '注意题目要求的是什么',
      },
      options: {
        choices: [
          { value: '周长', label: '周长' },
          { value: '面积', label: '面积' },
          { value: '对角线', label: '对角线' },
          { value: '边长', label: '边长' },
        ],
      },
      expectedAnswer: {
        type: 'choice',
        value: '面积',
      },
    },
    // 第2步：建立模型
    {
      stepId: 's2',
      answerMode: AnswerMode.MULTIPLE_CHOICE,
      ui: {
        instruction: `设矩形与墙平行的一边长为x米，则垂直于墙的边长为：`,
        hint: '篱笆总长40米，一边靠墙不需要篱笆',
      },
      options: {
        choices: [
          { value: '40-x', label: '(40-x)米' },
          { value: '40-2x', label: '(40-2x)米' },
          { value: '20-x', label: '(20-x)米' },
          { value: '40/2-x', label: '(40/2-x)米' },
        ],
      },
      expectedAnswer: {
        type: 'choice',
        value: '40-2x',
      },
    },
    // 第3步：求解验证
    {
      stepId: 's3',
      answerMode: AnswerMode.NUMBER,
      ui: {
        instruction: '要使面积最大，x应取多少米？（保留两位小数）',
        inputPlaceholder: '输入答案',
        hint: '面积函数 S = x(40-2x)，求顶点x坐标',
      },
      keyboard: {
        type: 'numeric',
      },
      expectedAnswer: {
        type: 'number',
        value: 10, // 顶点 x = -b/(2a) = -40/(2*(-2)) = 10
        tolerance: 0.01,
      },
    },
  ];
}

/**
 * 利润最大化问题的三段式推理链
 */
function buildMaxProfitSteps(
  params: Record<string, number>,
  difficulty: number
): StepProtocolV2[] {
  const basePrice = params.a;
  const baseSales = params.b;

  return [
    // 第1步：理解题意
    {
      stepId: 's1',
      answerMode: AnswerMode.MULTIPLE_CHOICE,
      ui: {
        instruction: '这个问题的优化目标是什么？',
        hint: '商家最关心的是什么',
      },
      options: {
        choices: [
          { value: '销量', label: '销量最大' },
          { value: '价格', label: '价格最高' },
          { value: '利润', label: '利润最大' },
          { value: '成本', label: '成本最低' },
        ],
      },
      expectedAnswer: {
        type: 'choice',
        value: '利润',
      },
    },
    // 第2步：建立模型
    {
      stepId: 's2',
      answerMode: AnswerMode.MULTIPLE_CHOICE,
      ui: {
        instruction: '设降价x元，则利润函数关于x的表达式是：',
        hint: '利润 = (定价 - 降价) × (原销量 + 增量)',
      },
      options: {
        choices: [
          { value: 'basePrice*baseSales - 2x^2', label: `${basePrice}×${baseSales} - 2x²` },
          { value: '(basePrice-x)(baseSales+2x)', label: `(${basePrice}-x)(${baseSales}+2x)` },
          { value: 'basePrice*baseSales + 2x', label: `${basePrice}×${baseSales} + 2x` },
          { value: 'x(2*baseSales - basePrice)', label: `x(2×${baseSales} - ${basePrice})` },
        ],
      },
      expectedAnswer: {
        type: 'choice',
        value: '(basePrice-x)(baseSales+2x)',
      },
    },
    // 第3步：求解验证
    {
      stepId: 's3',
      answerMode: AnswerMode.NUMBER,
      ui: {
        instruction: '最优定价是多少元？（保留两位小数）',
        inputPlaceholder: '输入答案',
        hint: '利润函数顶点的x坐标，最优定价 = 原价 - x',
      },
      keyboard: {
        type: 'numeric',
      },
      expectedAnswer: {
        type: 'number',
        value: basePrice + baseSales / 4, // 顶点 x = -b/(2a)
        tolerance: 0.01,
      },
    },
  ];
}

/**
 * 渲染面积优化问题
 */
function renderAreaOptimization(params: Record<string, number>) {
  const perimeter = params.a;

  return {
    title: '面积优化问题',
    description: '一元二次方程实际应用',
    context: `用 ${perimeter} 米长的篱笆围成一个矩形菜园，一边靠墙（墙长足够长，不需要篱笆）。求菜园的最大面积（结果保留两位小数）。`,
  };
}

/**
 * 渲染利润最大化问题
 */
function renderMaxProfit(params: Record<string, number>) {
  const basePrice = params.a;
  const baseSales = params.b;

  return {
    title: '最大利润问题',
    description: '一元二次方程实际应用',
    context: `某商品售价为 ${basePrice} 元时，每天可售 ${baseSales} 件。每降价 1 元，每天多售 2 件。求定价为多少时利润最大（结果保留两位小数）。`,
  };
}

/**
 * 创建深度思考题（包含元数据）
 *
 * 这个函数将模板生成的题目转换为深度思考题格式
 */
export function createDeepThinkingQuestion(
  params: Record<string, number>,
  difficulty: number
): QuestionProtocolV2 & DeepThinkingMetadata {
  // 调用原模板生成基础题目
  const template = QuadraticWordProblemTemplateV2;
  const steps = template.buildSteps(params);
  const content = template.render(params);
  const problemType = params.problemTypeIndex;

  // 计算认知层次
  const problemTypeMap: Record<number, WordProblemTypeV2> = {
    1: 'area_optimization',
    2: 'max_profit',
  };
  const cognitiveLevel = calculateCognitiveLevel(
    difficulty,
    problemTypeMap[problemType] || 'area_optimization'
  );

  // 计算推理深度
  const reasoningDepth = calculateReasoningDepth(cognitiveLevel);

  // 确定深度类型
  const deepTypeMap: Record<number, DeepThinkingMetadata['deepType']> = {
    1: 'optimization',
    2: 'optimization',
  };

  // 组装深度思考题
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    knowledgePoint: 'quadratic_word_problem',
    templateId: 'quadratic_word_problem_v2',
    difficultyLevel: difficulty,
    params,
    steps: steps as StepProtocolV2[],
    content,
    meta: {
      version: '2.0',
      source: 'template_engine_v2',
    },
    // 深度思考题元数据
    isDeepThinking: true,
    deepType: deepTypeMap[problemType] || 'special',
    cognitiveLevel,
    reasoningDepth,
  };
}
