/**
 * A/B Testing Framework Verification
 */

import { ABTesting } from './ab-testing';

// Mock PrismaStore
class MockPrismaStore {
  async getStudentAbility() { return null; }
  async updateStudentAbility() {}
  async logPrediction() {}
  async saveExperimentAssignment() { /* mock */ }
  async saveMetricObservation() { /* mock */ }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     A/B Testing Framework Verification              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message}`);
      failed++;
    }
  };

  // Initialize
  const abTesting = new ABTesting(new MockPrismaStore() as any);

  // Test 1: Default experiments exist
  console.log('Test 1: Default Experiments');
  const experiments = abTesting.getAllExperiments();
  assert(experiments.length >= 2, `Found ${experiments.length} default experiments`);
  console.log('');

  // Test 2: Custom experiment creation
  console.log('Test 2: Custom Experiment Creation');
  abTesting.createExperiment('test_exp', {
    control: { name: 'baseline', weight: 50 },
    treatment: { name: 'variant', weight: 50 }
  });
  const customExp = abTesting.getExperiment('test_exp');
  assert(customExp !== undefined, 'Custom experiment created');
  assert(customExp?.status === 'draft', 'Initial status is draft');
  console.log('');

  // Test 3: Start experiment
  console.log('Test 3: Experiment Lifecycle');
  abTesting.startExperiment('test_exp');
  assert(abTesting.getExperiment('test_exp')?.status === 'running', 'Experiment started');

  abTesting.pauseExperiment('test_exp');
  assert(abTesting.getExperiment('test_exp')?.status === 'paused', 'Experiment paused');

  abTesting.startExperiment('test_exp');
  abTesting.completeExperiment('test_exp');
  assert(abTesting.getExperiment('test_exp')?.status === 'completed', 'Experiment completed');
  console.log('');

  // Test 4: User assignment consistency
  console.log('Test 4: User Assignment Consistency');
  abTesting.createExperiment('consistency_test', {
    control: { name: 'baseline', weight: 50 },
    treatment: { name: 'variant', weight: 50 }
  }, { startDate: new Date(), metrics: [] });
  abTesting.startExperiment('consistency_test');

  const assignment1 = await abTesting.assign('consistency_test', 'user123');
  const assignment2 = await abTesting.assign('consistency_test', 'user123');
  assert(assignment1 === assignment2, 'Same user always gets same variant');
  console.log('');

  // Test 5: Distribution check
  console.log('Test 5: Variant Distribution');
  const distribution = { control: 0, treatment: 0 };
  for (let i = 0; i < 100; i++) {
    const variant = await abTesting.assign('consistency_test', `user_${i}`);
    if (variant) distribution[variant as keyof typeof distribution]++;
  }
  assert(
    distribution.control >= 30 && distribution.control <= 70,
    `Distribution roughly even: control=${distribution.control}, treatment=${distribution.treatment}`
  );
  console.log('');

  // Test 6: Metric observation
  console.log('Test 6: Metric Recording');
  // Use a fresh abTesting instance for observation test
  const abTestingObs = new ABTesting(new MockPrismaStore() as any);
  abTestingObs.createExperiment('observe_test', {
    control: { name: 'baseline', weight: 50 },
    treatment: { name: 'variant', weight: 50 }
  }, { startDate: new Date(), metrics: [{ name: 'accuracy', type: 'ratio', higherIsBetter: true }] });
  abTestingObs.startExperiment('observe_test');

  await abTestingObs.assign('observe_test', 'user_1');
  await abTestingObs.observe({
    experimentId: 'observe_test',
    userId: 'user_1',
    metricName: 'accuracy',
    value: 0.85
  });

  const results = abTestingObs.getResults('observe_test');
  const anyResult = results.get('control') || results.get('treatment');
  assert(anyResult !== undefined, 'Results computed');
  assert(anyResult!.sampleSize >= 1, 'Sample size tracked');
  console.log('');

  // Test 7: Statistical calculations
  console.log('Test 7: Statistical Calculations');
  const abTesting2 = new ABTesting(new MockPrismaStore() as any);
  abTesting2.createExperiment('stats_test', {
    control: { name: 'baseline', weight: 50 },
    treatment: { name: 'variant', weight: 50 }
  }, {
    startDate: new Date(),
    metrics: [{ name: 'score', type: 'continuous', higherIsBetter: true }]
  });
  abTesting2.startExperiment('stats_test');

  // Add observations
  for (let i = 0; i < 10; i++) {
    await abTesting2.assign('stats_test', `u${i}`);
    for (let j = 0; j < 3; j++) {
      await abTesting2.observe({
        experimentId: 'stats_test',
        userId: `u${i}`,
        metricName: 'score',
        value: 0.5 + Math.random() * 0.4
      });
    }
  }

  const statsResults = abTesting2.getResults('stats_test');
  const hasMean = Array.from(statsResults.values()).every(r => r.mean > 0);
  const hasCI = Array.from(statsResults.values()).every(r => r.confidenceInterval.length === 2);
  assert(hasMean, 'Mean calculated for all variants');
  assert(hasCI, 'Confidence intervals computed');
  console.log('');

  // Test 8: Summary generation
  console.log('Test 8: Summary & Recommendations');
  const summary = abTesting.getSummary('predict_accuracy_v1');
  assert(summary.experiment !== undefined, 'Summary has experiment');
  assert(summary.recommendation.length > 0, 'Recommendation generated');
  console.log(`  Recommendation: ${summary.recommendation}`);
  console.log('');

  // Summary
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                    Results                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    console.log('✅ All tests passed! A/B Testing framework is working correctly.\n');
    return 0;
  } else {
    console.log('❌ Some tests failed.\n');
    return 1;
  }
}

runTests().then(code => process.exit(code));
