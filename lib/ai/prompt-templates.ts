/**
 * AI Question Generation Prompt Templates
 *
 * Three question types with Chinese output and LaTeX math support:
 * - fill_blank: Fill-in-the-blank questions (1-2 keywords per blank)
 * - multiple_choice: Multiple choice with 4 options, single correct answer
 * - short_answer: Short answer questions (1-3 sentences)
 */

/**
 * Question type enum
 */
export type QuestionType = 'fill_blank' | 'multiple_choice' | 'short_answer'

/**
 * Prompt template constants
 */
export const PROMPTS: Record<QuestionType, string> = {
  /**
   * 填空题提示词
   * - 挖空1-2个关键词
   * - 用 ____ 表示
   * - 数学公式用 LaTeX 格式
   */
  fill_blank: `你是一个专业的数学教育内容生成助手。从以下内容中提取关键知识点，生成填空题。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式（如 $\\sqrt{a}$）
3. 每道题挖空 1-2 个关键词，用 "____" 或 "______" 表示
4. answer 是单个关键词或简短短语
5. explanation 简要说明为什么这个是正确答案

【示例格式】
{
  "cards": [
    {
      "question": "二次根式的概念是形如 $\\sqrt{a}$，其中 $a$ 必须满足______。",
      "answer": "$a \\ge 0$",
      "explanation": "二次根式的被开方数必须为非负数。"
    },
    {
      "question": "一元二次方程 $ax^2 + bx + c = 0$ 的求根公式是 $x = \\frac{-b \\pm \\sqrt{______}}{2a}$。",
      "answer": "$b^2 - 4ac$",
      "explanation": "根的判别式 $\\Delta = b^2 - 4ac$ 决定了方程解的个数。"
    }
  ]
}

内容：
{content}

请生成覆盖内容中所有关键知识点的填空题（10-20道），输出纯 JSON：`,

  /**
   * 选择题提示词
   * - 4个选项
   * - 只有1个正确答案
   * - 干扰项看似合理但明显错误
   */
  multiple_choice: `从以下内容中生成选择题，每个题目 4 个选项，只有 1 个正确答案。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式
3. 每个选项用 A、B、C、D 标注
4. 干扰项应该看似合理但明显错误
5. 测试理解而非记忆

【示例格式】
{
  "cards": [
    {
      "question": "若 $|x - 2| < 3$，则 $x$ 的取值范围是______。",
      "options": ["A. $-1 < x < 5$", "B. $x > -1$", "C. $-5 < x < -1$", "D. $x < 5$"],
      "answer": "A. $-1 < x < 5$",
      "explanation": "由 $|x - 2| < 3$ 可得 $-3 < x - 2 < 3$，即 $-1 < x < 5$。"
    }
  ]
}

内容：
{content}

请生成覆盖内容中所有关键知识点的选择题（10-20道），输出纯 JSON：`,

  /**
   * 简答题提示词
   * - 1-3句话回答
   * - 引发思考而非事实回忆
   * - 答案开放性强
   */
  short_answer: `从以下内容中生成简答题，每个题目需要 1-3 句话回答。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式
3. 题目应该引发思考而非事实回忆
4. 鼓励学生解释原因、描述过程或阐述理解
5. answer 包含参考答案要点
6. explanation 说明评分要点

【示例格式】
{
  "cards": [
    {
      "question": "为什么二次函数 $y = ax^2 + bx + c$ 的图像顶点坐标是 $\\left(-\\frac{b}{2a}, \\frac{4ac - b^2}{4a}\\right)$？",
      "answer": "顶点是抛物线的对称点，可通过对原式配方成 $y = a\\left(x + \\frac{b}{2a}\\right)^2 + \\frac{4ac - b^2}{4a}$ 得到。",
      "explanation": "配方后顶点横坐标为 $-\\frac{b}{2a}$，纵坐标为 $\\frac{4ac - b^2}{4a}$。评分要点：知道用配方法、正确完成配方。"
    }
  ]
}

内容：
{content}

请生成覆盖内容中关键知识点的简答题（5-10道），输出纯 JSON：`
}

/**
 * Replaces {content} placeholder in a prompt template
 */
export function buildPrompt(type: QuestionType, content: string): string {
  return PROMPTS[type].replace('{content}', content)
}

/**
 * Returns all supported question types
 */
export function getQuestionTypes(): QuestionType[] {
  return ['fill_blank', 'multiple_choice', 'short_answer']
}
