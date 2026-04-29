// lib/rl/history/le-history-service.test.ts

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryLEHistoryService } from './le-history-service';

describe('InMemoryLEHistoryService', () => {
  let service: InMemoryLEHistoryService;

  beforeEach(() => {
    service = new InMemoryLEHistoryService();
  });

  it('should return prior accuracy for unknown user-kp pair', () => {
    const accuracy = service.getAccuracy('user1', 'kp1');
    expect(accuracy).toBe(0.5);
  });

  it('should update accuracy on correct response', () => {
    const newAccuracy = service.updateAccuracy('user1', 'kp1', true);
    expect(newAccuracy).toBe(1);

    const accuracy = service.getAccuracy('user1', 'kp1');
    expect(accuracy).toBe(1);
  });

  it('should update accuracy on incorrect response', () => {
    const newAccuracy = service.updateAccuracy('user1', 'kp1', false);
    expect(newAccuracy).toBe(0);

    const accuracy = service.getAccuracy('user1', 'kp1');
    expect(accuracy).toBe(0);
  });

  it('should calculate rolling accuracy', () => {
    service.updateAccuracy('user1', 'kp1', true);
    service.updateAccuracy('user1', 'kp1', true);
    service.updateAccuracy('user1', 'kp1', false);

    const accuracy = service.getAccuracy('user1', 'kp1');
    expect(accuracy).toBeCloseTo(0.667, 2);
  });

  it('should track history', () => {
    service.updateAccuracy('user1', 'kp1', true);
    service.updateAccuracy('user1', 'kp1', false);

    const history = service.getHistory('user1', 'kp1');
    expect(history).toHaveLength(2);
    expect(history[0].correct).toBe(true);
    expect(history[1].correct).toBe(false);
  });

  it('should respect window parameter', () => {
    for (let i = 0; i < 150; i++) {
      service.updateAccuracy('user1', 'kp1', i % 2 === 0);
    }

    const history = service.getHistory('user1', 'kp1', 50);
    expect(history).toHaveLength(50);
  });
});
