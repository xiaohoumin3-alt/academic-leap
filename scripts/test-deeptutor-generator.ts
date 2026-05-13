/**
 * Generator 单元测试
 */

import dotenv from 'dotenv'
import path from 'path'
import { Generator } from '../lib/deeptutor/generator'
import type { QuestionTemplate } from '../lib/deeptutor/models'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  console.log('Testing Generator...\n')

  const generator = new Generator()

  const template: QuestionTemplate = {
    question_id: 'q_test_1',
    concentration: '一元二次方程配方法的基本步骤',
    question_type: 'choice',
    difficulty: 'easy',
    source: 'custom',
    rationale: '考察最基础的配方法'
  }

  const qaPair = await generator.process({
    template,
    topic: '一元二次方程的求解',
    knowledgeContext: '配方法是将方程化为 (x + p)² = q 的形式',
    previousQuestions: []
  })

  console.log('Generated QAPair:\n')
  console.log(`Question: ${qaPair.question}`)
  console.log(`Type: ${qaPair.question_type}`)
  console.log(`Options:`, qaPair.options)
  console.log(`Correct Answer: ${qaPair.correct_answer}`)
  console.log(`Explanation: ${qaPair.explanation}`)

  // 验证
  if (qaPair.question_type !== 'choice') {
    throw new Error(`Expected choice, got ${qaPair.question_type}`)
  }

  if (!qaPair.options || Object.keys(qaPair.options).length !== 4) {
    throw new Error('Expected 4 options')
  }

  if (!['A', 'B', 'C', 'D'].includes(qaPair.correct_answer)) {
    throw new Error(`Expected A/B/C/D, got ${qaPair.correct_answer}`)
  }

  console.log('\n✅ Generator test passed')
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
