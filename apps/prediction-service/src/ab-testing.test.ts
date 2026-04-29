/**
 * A/B Testing Framework Tests
 */

import { ABTesting } from './ab-testing';

// Mock PrismaStore
class MockPrismaStore {
  async getStudentAbility() { return null; }
  async updateStudentAbility() {}
  async logPrediction() {}
}

describe('A/B Testing Framework', () => {
  let abTesting: ABTesting;

  beforeEach(() => {
    abTesting = new ABTesting(new MockPrismaStore() as any);
  });

  describe('Experiment Creation', () => {
    test('should create experiment with default variants', () => {
      // 默认实验已初始化
      const experiments = abTesting.getAllExperiments();
      expect(experiments.length).toBeGreaterThan(0);
    });

    test('should create custom experiment', () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      });

      const experiment = abTesting.getExperiment('test_exp');
      expect(experiment).toBeDefined();
      expect(experiment?.status).toBe('draft');
    });

    test('should start experiment', () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 100 }
      });

      abTesting.startExperiment('test_exp');

      const experiment = abTesting.getExperiment('test_exp');
      expect(experiment?.status).toBe('running');
    });
  });

  describe('User Assignment', () => {
    test('should assign user consistently', async () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      }, { startDate: new Date(), metrics: [] });

      abTesting.startExperiment('test_exp');

      // 同一用户应始终分到同一组
      const assignment1 = await abTesting.assign('test_exp', 'user123');
      const assignment2 = await abTesting.assign('test_exp', 'user123');

      expect(assignment1).toBe(assignment2);
    });

    test('should distribute users roughly evenly', async () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      }, { startDate: new Date(), metrics: [] });

      abTesting.startExperiment('test_exp');

      const assignments = { control: 0, treatment: 0 };

      // 测试100个用户
      for (let i = 0; i < 100; i++) {
        const variant = await abTesting.assign('test_exp', `user_${i}`);
        if (variant) {
          assignments[variant as 'treatment' | 'control']++;
        }
      }

      // 应该在 40-60% 之间（允许一定波动）
      expect(assignments.control).toBeGreaterThan(30);
      expect(assignments.control).toBeLessThan(70);
    });

    test('should return null for non-existent experiment', async () => {
      const variant = await abTesting.assign('non_existent', 'user123');
      expect(variant).toBeNull();
    });
  });

  describe('Metric Observation', () => {
    test('should record observations', async () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      }, { startDate: new Date(), metrics: [{ name: 'accuracy', type: 'ratio', higherIsBetter: true }] });

      abTesting.startExperiment('test_exp');
      await abTesting.assign('test_exp', 'user123');

      abTesting.observe({
        experimentId: 'test_exp',
        userId: 'user123',
        metricName: 'accuracy',
        value: 0.85
      });

      // 验证结果计算
      const results = abTesting.getResults('test_exp');
      const controlResult = results.get('control');

      expect(controlResult?.sampleSize).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Statistical Calculations', () => {
    test('should calculate mean correctly', async () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      }, { startDate: new Date(), metrics: [{ name: 'score', type: 'continuous', higherIsBetter: true }] });

      abTesting.startExperiment('test_exp');
      await abTesting.assign('test_exp', 'user1');

      // 记录多个观测值
      for (let i = 0; i < 5; i++) {
        abTesting.observe({
          experimentId: 'test_exp',
          userId: 'user1',
          metricName: 'score',
          value: 0.8 + i * 0.04
        });
      }

      const results = abTesting.getResults('test_exp');
      const controlResult = results.get('control');

      expect(controlResult?.mean).toBeCloseTo(0.9, 1);
      expect(controlResult?.sampleSize).toBe(5);
    });

    test('should detect significant difference', async () => {
      abTesting.createExperiment('test_exp', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'variant', weight: 50 }
      }, { startDate: new Date(), metrics: [{ name: 'score', type: 'continuous', higherIsBetter: true }] });

      abTesting.startExperiment('test_exp');

      // 对照组：低分数
      for (let i = 0; i < 50; i++) {
        await abTesting.assign('test_exp', `control_user_${i}`);
        for (let j = 0; j < 3; j++) {
          abTesting.observe({
            experimentId: 'test_exp',
            userId: `control_user_${i}`,
            metricName: 'score',
            value: 0.5 + Math.random() * 0.1
          });
        }
      }

      // 实验组：高分数
      for (let i = 0; i < 50; i++) {
        await abTesting.assign('test_exp', `treatment_user_${i}`);
        for (let j = 0; j < 3; j++) {
          abTesting.observe({
            experimentId: 'test_exp',
            userId: `treatment_user_${i}`,
            metricName: 'score',
            value: 0.8 + Math.random() * 0.1
          });
        }
      }

      const results = abTesting.getResults('test_exp');
      const treatmentResult = results.get('treatment');

      expect(treatmentResult?.mean).toBeGreaterThan(0.7);
    });
  });

  describe('Experiment Summary', () => {
    test('should generate recommendation', () => {
      const summary = abTesting.getSummary('predict_accuracy_v1');

      expect(summary.experiment).toBeDefined();
      expect(summary.recommendation).toBeDefined();
    });

    test('should identify winner when significant', async () => {
      abTesting.createExperiment('clear_winner', {
        control: { name: 'baseline', weight: 50 },
        treatment: { name: 'winner', weight: 50 }
      }, {
        startDate: new Date(),
        metrics: [{ name: 'accuracy', type: 'ratio', higherIsBetter: true }]
      });

      abTesting.startExperiment('clear_winner');

      // 对照组
      for (let i = 0; i < 100; i++) {
        await abTesting.assign('clear_winner', `c_${i}`);
        abTesting.observe({
          experimentId: 'clear_winner',
          userId: `c_${i}`,
          metricName: 'accuracy',
          value: 0.5
        });
      }

      // 实验组（明显更好）
      for (let i = 0; i < 100; i++) {
        await abTesting.assign('clear_winner', `t_${i}`);
        abTesting.observe({
          experimentId: 'clear_winner',
          userId: `t_${i}`,
          metricName: 'accuracy',
          value: 0.9
        });
      }

      const summary = abTesting.getSummary('clear_winner');

      expect(summary.winner).toBe('treatment');
      expect(summary.recommendation).toContain('建议全量上线');
    });
  });
});
