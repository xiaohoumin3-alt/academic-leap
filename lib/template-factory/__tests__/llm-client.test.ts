import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LLMClient } from '../utils/llm-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new LLMClient({
      model: 'gemini-2.5-flash',
      apiKey: 'test-key',
    });
  });

  it('should generate completion', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"result": "success"}' }]
          }
        }]
      }),
    } as Response);

    const result = await client.generate('Test prompt', {
      responseFormat: 'json'
    });

    expect(result.content).toBe('{"result": "success"}');
    expect(result.parsed).toEqual({ result: 'success' });
  });

  it('should handle Gemini API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    } as Response);

    await expect(client.generate('Test')).rejects.toThrow();
  });

  it('should calculate token usage', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Response' }] }
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
        }
      }),
    } as Response);

    const result = await client.generate('Test');
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
  });

  it('should generate with OpenAI model', async () => {
    const openaiClient = new LLMClient({
      model: 'gpt-4',
      apiKey: 'openai-key',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: 'OpenAI response' }
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
        }
      }),
    } as Response);

    const result = await openaiClient.generate('Test prompt');
    expect(result.content).toBe('OpenAI response');
    expect(result.usage.promptTokens).toBe(15);
  });

  it('should use environment variable for API key when not provided', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'env-key';

    const envClient = new LLMClient({
      model: 'gemini-2.5-flash',
      apiKey: '',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Response' }] }
        }],
      }),
    } as Response);

    await envClient.generate('Test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toContain('key=env-key');

    process.env.GEMINI_API_KEY = originalKey;
  });

  it('should throw error when API key is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const noKeyClient = new LLMClient({
      model: 'gemini-2.5-flash',
      apiKey: '',
    });

    await expect(noKeyClient.generate('Test')).rejects.toThrow('GEMINI_API_KEY not configured');

    process.env.GEMINI_API_KEY = originalKey;
  });

  it('should pass custom options to Gemini API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: 'Response' }] }
        }],
      }),
    } as Response);

    await client.generate('Test', {
      responseFormat: 'json',
      maxTokens: 1000,
      temperature: 0.5,
    });

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    expect(body.generationConfig.maxOutputTokens).toBe(1000);
    expect(body.generationConfig.temperature).toBe(0.5);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('should expose model property', () => {
    expect(client.model).toBe('gemini-2.5-flash');
  });
});
