/**
 * API 集成测试
 * 测试 /api/questions/deeptutor/generate 端点
 */

import { POST } from './route'
import { NextRequest } from 'next/server'

// Mock coordinator
jest.mock('@/lib/deeptutor/coordinator', () => ({
  AgentCoordinator: jest.fn().mockImplementation(() => ({
    generate: jest.fn()
  }))
}))

import { AgentCoordinator } from '@/lib/deeptutor/coordinator'

describe('POST /api/questions/deeptutor/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate questions successfully', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      success: true,
      requested: 5,
      template_count: 5,
      completed: 5,
      failed: 0,
      results: []
    })

    ;(AgentCoordinator as jest.MockedClass<typeof AgentCoordinator>).mockImplementation(() => ({
      generate: mockGenerate
    } as any))

    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '一元二次方程的求解',
        preference: '高中数学',
        knowledgeContext: '一元二次方程',
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockGenerate).toHaveBeenCalledWith({
      mode: 'custom',
      topic: '一元二次方程的求解',
      preference: '高中数学',
      knowledgeContext: '一元二次方程',
      count: 5
    })
  })

  it('should validate required topic field', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        count: 5
        // 缺少 topic
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('topic is required')
  })

  it('should validate mode is custom', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'auto', // 无效的 mode
        topic: '测试',
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Invalid mode. Only "custom" is supported in v1.')
  })

  it('should validate count range', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '测试',
        count: 100 // 超过 MAX_QUESTIONS
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('count must be between 1 and 50')
  })

  it('should validate topic length', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: 'x'.repeat(201), // 超过 MAX_TOPIC_LENGTH
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('topic exceeds maximum length of 200')
  })

  it('should validate preference length', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '测试',
        preference: 'x'.repeat(501), // 超过 MAX_PREFERENCE_LENGTH
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('preference exceeds maximum length of 500')
  })

  it('should validate knowledgeContext length', async () => {
    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '测试',
        knowledgeContext: 'x'.repeat(1001), // 超过 MAX_CONTEXT_LENGTH
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBe('knowledgeContext exceeds maximum length of 1000')
  })

  it('should handle coordinator errors gracefully', async () => {
    const mockGenerate = jest.fn().mockRejectedValue(new Error('LLM API 错误'))

    ;(AgentCoordinator as jest.MockedClass<typeof AgentCoordinator>).mockImplementation(() => ({
      generate: mockGenerate
    } as any))

    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '测试',
        count: 5
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toBe('Failed to generate questions')
  })

  it('should pass optional parameters to coordinator', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      success: true,
      requested: 3,
      template_count: 3,
      completed: 3,
      failed: 0,
      results: []
    })

    ;(AgentCoordinator as jest.MockedClass<typeof AgentCoordinator>).mockImplementation(() => ({
      generate: mockGenerate
    } as any))

    const request = new NextRequest('http://localhost/api/questions/deeptutor/generate', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'custom',
        topic: '测试',
        preference: '高中数学',
        knowledgeContext: '上下文',
        count: 3,
        difficulty: 'hard',
        questionType: 'written'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockGenerate).toHaveBeenCalledWith({
      mode: 'custom',
      topic: '测试',
      preference: '高中数学',
      knowledgeContext: '上下文',
      count: 3,
      difficulty: 'hard',
      questionType: 'written'
    })
  })
})
