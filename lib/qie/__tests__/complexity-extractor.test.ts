// Set environment variable before importing the module
process.env.GEMINI_API_KEY = 'test-api-key';

// Mock the Google Generative AI module to avoid API key requirement
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(),
  })),
}));

import { parseSingleResponse, parseBatchResponse, clamp } from '../complexity-extractor';

describe('ComplexityExtractor - Parser', () => {
  describe('clamp', () => {
    it('should clamp within bounds', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(-0.1, 0, 1)).toBe(0);
      expect(clamp(1.5, 0, 1)).toBe(1);
    });
  });

  describe('parseSingleResponse', () => {
    it('should parse clean JSON', () => {
      const input = '{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.questionId).toBe('q1');
      expect(result.features.cognitiveLoad).toBe(0.5);
      expect(result.confidence).toBe(0.8);
    });

    it('should strip markdown code blocks', () => {
      const input = '```json\n{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}\n```';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(0.5);
    });

    it('should handle extra text before JSON', () => {
      const input = '这是一些解释文字\n{"reasoning":"test","features":{"cognitiveLoad":0.5,"reasoningDepth":0.4,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(0.5);
    });

    it('should clamp out-of-range values', () => {
      const input = '{"reasoning":"test","features":{"cognitiveLoad":1.5,"reasoningDepth":-0.2,"complexity":0.6},"confidence":0.8}';
      const result = parseSingleResponse(input, 'q1');

      expect(result.features.cognitiveLoad).toBe(1);
      expect(result.features.reasoningDepth).toBe(0);
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseSingleResponse('not json', 'q1')).toThrow();
    });
  });

  describe('parseBatchResponse', () => {
    it('should parse array response', () => {
      const input = JSON.stringify([
        { id: 'q1', features: { cognitiveLoad: 0.3, reasoningDepth: 0.2, complexity: 0.3 }, confidence: 0.9 },
        { id: 'q2', features: { cognitiveLoad: 0.7, reasoningDepth: 0.6, complexity: 0.7 }, confidence: 0.8 },
      ]);
      const result = parseBatchResponse(input);

      expect(result.size).toBe(2);
      expect(result.get('q1')?.features.cognitiveLoad).toBe(0.3);
      expect(result.get('q2')?.features.cognitiveLoad).toBe(0.7);
    });
  });
});
