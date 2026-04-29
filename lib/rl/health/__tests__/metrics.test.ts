// lib/rl/health/__tests__/metrics.test.ts

import { calculateLE, calculateCS, calculateLabelNoiseRate, calculateDFI } from '../metrics';
import type { ResponseRecord } from '../types';

describe('HealthMetrics', () => {
  describe('calculateLE', () => {
    it('should calculate LE from theta history', () => {
      const responses: ResponseRecord[] = [
        { theta: -1.0, deltaC: 2, correct: false, timestamp: Date.now() - 1000 },
        { theta: -0.8, deltaC: 2, correct: true, timestamp: Date.now() - 800 },
        { theta: -0.5, deltaC: 3, correct: true, timestamp: Date.now() - 600 },
        { theta: -0.2, deltaC: 3, correct: true, timestamp: Date.now() - 400 },
        { theta: 0.0, deltaC: 3, correct: true, timestamp: Date.now() - 200 },
        { theta: 0.3, deltaC: 4, correct: true, timestamp: Date.now() },
      ];

      const le = calculateLE(responses);

      // theta从-1.0提升到0.3，提升1.3
      expect(le).toBeGreaterThan(1.0);
      expect(le).toBeLessThan(2.0);
    });

    it('should return 0 for empty history', () => {
      const le = calculateLE([]);
      expect(le).toBe(0);
    });

    it('should return 0 for single response', () => {
      const responses: ResponseRecord[] = [
        { theta: 0, deltaC: 3, correct: true, timestamp: Date.now() },
      ];
      const le = calculateLE(responses);
      expect(le).toBe(0);
    });
  });

  describe('calculateCS', () => {
    it('should calculate CS from recommendation history', () => {
      const recommendations = [
        { deltaC: 3.0, timestamp: Date.now() - 400 },
        { deltaC: 3.1, timestamp: Date.now() - 300 },
        { deltaC: 3.0, timestamp: Date.now() - 200 },
        { deltaC: 2.9, timestamp: Date.now() - 100 },
        { deltaC: 3.0, timestamp: Date.now() },
      ];

      const cs = calculateCS(recommendations);

      // 方差很小，CS应该接近1
      expect(cs).toBeGreaterThan(0.9);
    });

    it('should return 0 for empty history', () => {
      const cs = calculateCS([]);
      expect(cs).toBe(0);
    });

    it('should detect unstable recommendations', () => {
      const recommendations = [
        { deltaC: 1.0, timestamp: Date.now() - 400 },
        { deltaC: 5.0, timestamp: Date.now() - 300 },
        { deltaC: 2.0, timestamp: Date.now() - 200 },
        { deltaC: 4.0, timestamp: Date.now() - 100 },
        { deltaC: 3.0, timestamp: Date.now() },
      ];

      const cs = calculateCS(recommendations);

      // 方差很大，CS应该较低
      expect(cs).toBeLessThan(0.7);
    });
  });

  describe('calculateLabelNoiseRate', () => {
    it('should calculate label noise rate', () => {
      const responses: ResponseRecord[] = [
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() - 400 },
        { theta: 0.5, deltaC: 3, correct: false, timestamp: Date.now() - 300 },
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() - 200 },
        { theta: 0.5, deltaC: 3, correct: false, timestamp: Date.now() - 100 },
        { theta: 0.5, deltaC: 3, correct: true, timestamp: Date.now() },
      ];

      const noiseRate = calculateLabelNoiseRate(responses);
      // theta=0.5, deltaC=3: expected=false (0.5 < 1.5)
      // 3 cases where correct=true (mismatch/noise), 2 cases where correct=false (match)
      expect(noiseRate).toBe(0.6);
    });

    it('should return 0 for empty history', () => {
      const noiseRate = calculateLabelNoiseRate([]);
      expect(noiseRate).toBe(0);
    });

    it('should handle low theta correctly', () => {
      const responses: ResponseRecord[] = [
        { theta: -1.0, deltaC: 4, correct: false, timestamp: Date.now() },
      ];

      const noiseRate = calculateLabelNoiseRate(responses);
      expect(noiseRate).toBe(0);
    });
  });

  describe('calculateDFI', () => {
    it('should calculate DFI correctly', () => {
      const dfi = calculateDFI(100, 95);
      expect(dfi).toBe(0.95);
    });

    it('should return 1 for zero total events', () => {
      const dfi = calculateDFI(0, 0);
      expect(dfi).toBe(1);
    });

    it('should handle partial completion', () => {
      const dfi = calculateDFI(10, 5);
      expect(dfi).toBe(0.5);
    });
  });
});
