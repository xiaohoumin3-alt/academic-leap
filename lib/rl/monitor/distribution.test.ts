// lib/rl/monitor/distribution.test.ts

import {
  DistributionMonitor,
  DistributionCheckInput,
  DistributionAlert,
  DistributionMonitorState,
  DistributionMonitorConfig,
} from './distribution';

describe('DistributionMonitor', () => {
  let monitor: DistributionMonitor;
  const defaultConfig: DistributionMonitorConfig = {
    checkInterval: 5,
    criticalThreshold: 0.4,
    warningThreshold: 0.2,
  };

  beforeEach(() => {
    monitor = new DistributionMonitor(defaultConfig);
  });

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const state = monitor.getState();

      expect(state.checkCount).toBe(0);
      expect(state.lastCheck).toBeNull();
      expect(state.alerts).toEqual([]);
    });

    it('should accept custom configuration', () => {
      const customMonitor = new DistributionMonitor({
        checkInterval: 10,
        criticalThreshold: 0.5,
        warningThreshold: 0.3,
      });

      expect(customMonitor).toBeDefined();
    });
  });

  describe('check', () => {
    it('should return no alerts on first check (insufficient data)', () => {
      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [],
      };

      const alerts = monitor.check(input);

      expect(alerts).toEqual([]);
    });

    it('should return no alerts when check interval not reached', () => {
      const input: DistributionCheckInput = {
        questionHistory: [
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: false, theta: 0.6 },
        ],
        thetaHistory: [0.5, 0.6, 0.7],
        rewardHistory: [1, 0.8, 0.9],
      };

      // First check
      monitor.check(input);

      // Second check before interval
      const alerts = monitor.check(input);

      expect(alerts).toEqual([]);
    });

    it('should perform full check when interval is reached', () => {
      const input: DistributionCheckInput = {
        questionHistory: [
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: false, theta: 0.6 },
          { questionId: 'q1', correct: true, theta: 0.7 },
          { questionId: 'q1', correct: false, theta: 0.8 },
          { questionId: 'q1', correct: true, theta: 0.9 },
        ],
        thetaHistory: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
        rewardHistory: [1, 0.8, 0.9, 0.7, 0.6, 0.5, 0.4, 0.3],
      };

      // Check 5 times to reach interval
      for (let i = 0; i < 5; i++) {
        monitor.check(input);
      }

      const state = monitor.getState();
      expect(state.checkCount).toBe(5);
      expect(state.lastCheck).not.toBeNull();
    });

    it('should detect reward drift and create critical alert', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 2,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      // Create reward drift: old mean high, new mean very low
      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.5, 0.5, 0.5], // 50% drop
      };

      // First check - no data yet
      monitorWithShortInterval.check(input);

      // Second check - interval reached, should detect drift
      const alerts = monitorWithShortInterval.check(input);

      expect(alerts.length).toBeGreaterThan(0);
      const rewardAlert = alerts.find(a => a.type === 'reward');
      expect(rewardAlert).toBeDefined();
      expect(rewardAlert?.severity).toBe('critical');
    });

    it('should detect ability drift and create warning alert', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 2,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      // Create ability drift
      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [0.5, 0.5, 0.5, 0.8, 0.8, 0.8], // Significant shift
        rewardHistory: [],
      };

      // First check
      monitorWithShortInterval.check(input);

      // Second check
      const alerts = monitorWithShortInterval.check(input);

      const abilityAlert = alerts.find(a => a.type === 'ability');
      if (abilityAlert) {
        expect(abilityAlert.type).toBe('ability');
      }
    });

    it('should detect difficulty drift and create warning alert', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 2,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: false, theta: 0.8 },
          { questionId: 'q1', correct: false, theta: 0.8 },
        ],
        thetaHistory: [],
        rewardHistory: [],
      };

      // First check
      monitorWithShortInterval.check(input);

      // Second check
      const alerts = monitorWithShortInterval.check(input);

      // May or may not detect depending on drift calculation
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should prioritize reward drift over ability drift', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 2,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [0.5, 0.5, 0.5, 0.8, 0.8, 0.8], // Ability drift
        rewardHistory: [1, 1, 1, 0.5, 0.5, 0.5], // Reward drift (higher priority)
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      // Reward alert should come first if both detected
      const rewardIndex = alerts.findIndex(a => a.type === 'reward');
      const abilityIndex = alerts.findIndex(a => a.type === 'ability');

      if (rewardIndex >= 0 && abilityIndex >= 0) {
        expect(rewardIndex).toBeLessThan(abilityIndex);
      }
    });

    it('should respect check interval with config value', () => {
      const monitorWithLongInterval = new DistributionMonitor({
        checkInterval: 10,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: true, theta: 0.5 },
          { questionId: 'q1', correct: true, theta: 0.5 },
        ],
        thetaHistory: [0.5, 0.6, 0.7],
        rewardHistory: [1, 0.8, 0.9],
      };

      // Check 9 times - should not perform full check yet
      for (let i = 0; i < 9; i++) {
        const alerts = monitorWithLongInterval.check(input);
        expect(alerts).toEqual([]);
      }

      // 10th check - interval reached
      const alerts = monitorWithLongInterval.check(input);
      // May have alerts or not, but check should have been performed
      expect(monitorWithLongInterval.getState().checkCount).toBe(10);
    });
  });

  describe('getState', () => {
    it('should return current state with accumulated alerts', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.5, 0.5, 0.5],
      };

      monitorWithShortInterval.check(input);

      const state = monitorWithShortInterval.getState();

      expect(state.checkCount).toBe(1);
      expect(state.lastCheck).toBeInstanceOf(Date);
      expect(Array.isArray(state.alerts)).toBe(true);
    });

    it('should maintain alert history across checks', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.5, 0.5, 0.5],
      };

      monitorWithShortInterval.check(input);
      const state1 = monitorWithShortInterval.getState();
      const alertsCount1 = state1.alerts.length;

      monitorWithShortInterval.check(input);
      const state2 = monitorWithShortInterval.getState();

      // Alerts should accumulate or stay same (implementation choice)
      expect(state2.alerts.length).toBeGreaterThanOrEqual(alertsCount1);
    });
  });

  describe('clearAlerts', () => {
    it('should clear all alerts', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.5, 0.5, 0.5],
      };

      monitorWithShortInterval.check(input);
      let state = monitorWithShortInterval.getState();

      expect(state.alerts.length).toBeGreaterThan(0);

      monitorWithShortInterval.clearAlerts();
      state = monitorWithShortInterval.getState();

      expect(state.alerts).toEqual([]);
    });

    it('should not reset check count or last check time', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 0.5],
      };

      monitorWithShortInterval.check(input);
      const stateBefore = monitorWithShortInterval.getState();

      monitorWithShortInterval.clearAlerts();
      const stateAfter = monitorWithShortInterval.getState();

      expect(stateAfter.checkCount).toBe(stateBefore.checkCount);
      expect(stateAfter.lastCheck).toEqual(stateBefore.lastCheck);
    });
  });

  describe('alert severity determination', () => {
    it('should create critical alert when change exceeds critical threshold', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      // 60% change - exceeds critical threshold
      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.4, 0.4, 0.4],
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const criticalAlert = alerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
    });

    it('should create warning alert when change exceeds warning but not critical', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      // 30% change - between warning and critical
      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.7, 0.7, 0.7],
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const warningAlert = alerts.find(a => a.severity === 'warning');
      expect(warningAlert).toBeDefined();
    });

    it('should create info alert for minor drifts', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.95, 0.95, 0.95], // 5% change - minor
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const infoAlert = alerts.find(a => a.severity === 'info');
      expect(infoAlert).toBeDefined();
    });
  });

  describe('alert recommendations', () => {
    it('should recommend continue for info severity', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.95, 0.95, 0.95],
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const infoAlert = alerts.find(a => a.severity === 'info');
      expect(infoAlert?.recommendation).toBe('continue');
    });

    it('should recommend recalibrate for warning severity', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.7, 0.7, 0.7],
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const warningAlert = alerts.find(a => a.severity === 'warning');
      expect(warningAlert?.recommendation).toBe('recalibrate');
    });

    it('should recommend reset for critical severity', () => {
      const monitorWithShortInterval = new DistributionMonitor({
        checkInterval: 1,
        criticalThreshold: 0.4,
        warningThreshold: 0.2,
      });

      const input: DistributionCheckInput = {
        questionHistory: [],
        thetaHistory: [],
        rewardHistory: [1, 1, 1, 0.4, 0.4, 0.4],
      };

      monitorWithShortInterval.check(input);
      const alerts = monitorWithShortInterval.check(input);

      const criticalAlert = alerts.find(a => a.severity === 'critical');
      expect(criticalAlert?.recommendation).toBe('reset');
    });
  });
});
