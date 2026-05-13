import { AgentCoordinator } from '../lib/deeptutor/coordinator'

async function main() {
  console.log('=== Test 1: Batch Processing (10 questions) ===')
  const coordinator = new AgentCoordinator()
  const result = await coordinator.generate({
    mode: 'custom',
    topic: '二次函数',
    count: 10
  })
  console.log('Requested:', result.requested)
  console.log('Template count:', result.template_count)
  console.log('Completed:', result.completed)
  console.log('Failed:', result.failed)
  console.log('')

  console.log('=== Test 2: Deduplication ===')
  const result2 = await coordinator.generate({
    mode: 'custom',
    topic: '二次函数',
    count: 5
  })
  console.log('Second request - Template count:', result2.template_count)
  console.log('Unique concentrations in second request:', new Set(result2.results.map(r => r.qa_pair.concentration)).size)
}

main().catch(console.error)
