/**
 * AI Question Generation Prompt Templates
 * 三种题型：填空题、选择题、简答题
 */

export type QuestionType = 'fill_blank' | 'multiple_choice' | 'short_answer'

export const PROMPTS: Record<QuestionType, string> = {
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
      "question": "勾股定理：在直角三角形中，$a^2 + b^2 = $______。",
      "answer": "$c^2$",
      "explanation": "直角三角形两直角边的平方和等于斜边的平方。"
    }
  ]
}

内容：
{content}

请生成覆盖内容中所有关键知识点的填空题（10-20道），输出纯 JSON：`,

  multiple_choice: `从以下内容中生成选择题，每个题目 4 个选项，只有 1 个正确答案。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式
3. options 是选项数组，包含 A/B/C/D 前缀
4. answer 是正确选项（如 "B"）或带选项文字的完整答案
5. explanation 简要说明为什么正确

【示例格式】
{
  "cards": [
    {
      "question": "下列哪个数是二次根式？",
      "options": ["A. $\\sqrt{-4}$", "B. $\\sqrt{4}$", "C. $\\sqrt{0}$", "D. 以上都是"],
      "answer": "D. 以上都是",
      "explanation": "-4 无法开根号（负数），4 和 0 都可以，所以选 D。"
    }
  ]
}

内容：
{content}

请生成 10-15 道选择题，输出纯 JSON：`,

  short_answer: `从以下内容中生成简答题，每个题目需要 1-3 句话回答。

【格式要求】
1. 必须输出纯 JSON，不要包含任何 markdown 代码块、注释或解释
2. question 使用中文，数学公式用 LaTeX 格式
3. answer 是参考答案要点
4. explanation 是评分要点说明

【示例格式】
{
  "cards": [
    {
      "question": "为什么二次根式的被开方数必须是非负数？",
      "answer": "因为任何实数的平方都是非负数，所以只有非负数才有实数平方根。",
      "explanation": "评分要点：(1) 提到实数平方的非负性 (2) 逻辑推导正确"
    }
  ]
}

内容：
{content}

请生成 8-12 道简答题，输出纯 JSON：`,
}
