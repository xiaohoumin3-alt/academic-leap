/**
 * IdeaAgent 单元测试
 */

import dotenv from 'dotenv'
import path from 'path'
import { IdeaAgent } from '../lib/deeptutor/idea-agent'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  console.log('Testing IdeaAgent...\n')

  const agent = new IdeaAgent()

  const templates = await agent.process({
    topic: '一元二次方程的求解',
    preference: '高中数学，侧重基础概念',
    knowledgeContext: '一元二次方程是形如 ax² + bx + c = 0 的方程',
    existingConcentrations: [],
    numIdeas: 5
  })

  console.log(`Generated ${templates.length} templates:\n`)

  templates.forEach((t, i) => {
    console.log(`${i + 1}. [${t.question_type}] ${t.difficulty} - ${t.concentration}`)
    if (t.rationale) {
      console.log(`   Rationale: ${t.rationale}`)
    }
  })

  // 验证
  if (templates.length !== 5) {
    throw new Error(`Expected 5 templates, got ${templates.length}`)
  }

  console.log('\n✅ IdeaAgent test passed')
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
