/**
 * DeepTutor 端到端测试
 */

import dotenv from 'dotenv'
import path from 'path'
import { AgentCoordinator } from '../lib/deeptutor/coordinator'
import type { GenerationRequest } from '../lib/deeptutor/models'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

async function main() {
  console.log('Testing DeepTutor End-to-End...\n')

  const request: GenerationRequest = {
    mode: 'custom',
    topic: '一元二次方程的求解',
    preference: '高中数学，侧重基础概念',
    knowledgeContext: '一元二次方程是形如 ax² + bx + c = 0 的方程',
    count: 5
  }

  console.log('Request:', JSON.stringify(request, null, 2))
  console.log('\nGenerating...\n')

  const coordinator = new AgentCoordinator()
  const result = await coordinator.generate(request)

  console.log('Result:', JSON.stringify(result, null, 2))

  // 验证
  if (!result.success) {
    throw new Error(`Generation failed: ${result.error}`)
  }

  if (result.completed !== request.count) {
    throw new Error(`Expected ${request.count} completed, got ${result.completed}`)
  }

  console.log('\n✅ End-to-end test passed')
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
