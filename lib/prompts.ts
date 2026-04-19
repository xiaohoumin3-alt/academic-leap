/**
 * Prompt 模板集合
 * 用于Gemini AI的各种任务
 */

export const PROMPTS = {
  /**
   * 题目生成Prompt模板
   */
  questionGeneration: {
    calculation: (difficulty: number, knowledgePoint: string, count: number) => `
请生成${count}道${getDifficultyDesc(difficulty)}的数学计算题，知识点为"${knowledgePoint}"。

要求：
1. 每道题包含3-5个步骤，每个步骤都有明确的表达式和答案
2. 答案必须是简化后的分数或整数，不要小数
3. 每个步骤提供提示信息
4. 题目要有实际的教学意义，难度循序渐进

输出格式(JSON)：
[
  {
    "title": "题目标题",
    "description": "题目描述",
    "context": "题目背景",
    "answer": "最终答案",
    "hint": "整体提示",
    "steps": [
      {
        "stepNumber": 1,
        "expression": "表达式",
        "answer": "答案",
        "hint": "步骤提示"
      }
    ]
  }
]
    `,

    algebra: (difficulty: number, knowledgePoint: string, count: number) => `
请生成${count}道${getDifficultyDesc(difficulty)}的代数题，知识点为"${knowledgePoint}"。

要求：
1. 涉及方程、不等式或函数
2. 包含完整的解题步骤
3. 每步有清晰的逻辑说明
4. 答案要精确

输出格式(JSON)：同上
    `,

    geometry: (difficulty: number, knowledgePoint: string, count: number) => `
请生成${count}道${getDifficultyDesc(difficulty)}的几何题，知识点为"${knowledgePoint}"。

要求：
1. 涉及图形、面积、体积或角度计算
2. 描述要清晰，便于理解图形
3. 解题步骤要有几何推理过程
4. 答案要精确（保留π或使用小数）

输出格式(JSON)：同上
    `,
  },

  /**
   * 答案批改Prompt模板
   */
  answerVerification: `
批改数学答案时请遵循以下原则：

1. 等价判断：
   - 分数：1/2 = 2/4 = 3/6
   - 带分数：5/2 = 2 1/2
   - 根式：√4 = 2
   - 小数与分数：0.5 = 1/2

2. 常见错误类型：
   - 计算错误：结果不正确
   - 约分错误：分数未化简
   - 符号错误：正负号错误
   - 单位错误：单位遗漏或错误

3. 反馈要求：
   - 正确：简短鼓励
   - 错误：指出具体问题，给出提示
   - 部分正确：肯定正确部分，指出需要改进

输出格式：
{
  "isCorrect": true/false,
  "feedback": "具体反馈内容"
}
  `,

  /**
   * 学习建议Prompt模板
   */
  learningRecommendation: `
基于以下学习数据，给出个性化的学习建议：

数据维度：
- 知识点掌握度
- 练习正确率
- 解题速度
- 最近练习记录

建议应包括：
1. 优势分析
2. 薄弱环节
3. 练习建议
4. 学习计划
  `,

  /**
   * 错题分析Prompt模板
   */
  errorAnalysis: `
分析以下错题，找出错误原因和改进方向：

分析维度：
1. 错误类型（概念/计算/审题）
2. 知识漏洞
3. 改进建议
4. 相关练习推荐
  `,
};

/**
 * 获取难度描述
 */
function getDifficultyDesc(difficulty: number): string {
  const descriptions = {
    1: '非常简单，适合初学者',
    2: '简单，基础练习',
    3: '中等，需要一定思考',
    4: '较难，需要综合运用',
    5: '困难，挑战性题目',
  };
  return descriptions[difficulty as keyof typeof descriptions] || '中等';
}

/**
 * 获取知识点提示
 */
export function getKnowledgePointHint(knowledgePoint: string): string {
  const hints: Record<string, string> = {
    '分数运算': '注意约分和通分',
    '方程求解': '注意移项变号',
    '几何计算': '注意公式运用和单位',
    '函数图像': '注意关键点和变化趋势',
  };
  return hints[knowledgePoint] || '仔细审题，按步骤计算';
}

/**
 * 获取错误类型分析
 */
export function analyzeErrorType(userAnswer: string, correctAnswer: string): string {
  if (!userAnswer.trim()) return '未作答';

  // 简单的数值比较（实际可用AI分析）
  try {
    const userNum = eval(userAnswer.replace(/[^0-9.\/\-+*()]/g, ''));
    const correctNum = eval(correctAnswer.replace(/[^0-9.\/\-+*()]/g, ''));

    if (Math.abs(userNum - correctNum) < 0.001) {
      return '格式问题';
    }
  } catch {
    // 忽略计算错误
  }

  return '计算错误';
}
