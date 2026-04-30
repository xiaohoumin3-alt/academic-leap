/**
 * Performance Benchmark: CW-TS vs Standard Thompson Sampling
 */

import { ThompsonSamplingBandit } from '../lib/rl/bandit/thompson-sampling';
import { CWThompsonSamplingBandit } from '../lib/rl/bandit/cw-thompson-sampling';

const ITERATIONS = 10000;

console.log('=== CW-TS Performance Benchmark ===\n');

// Benchmark standard Thompson Sampling
console.log('Running standard Thompson Sampling...');
const tsStart = performance.now();
const ts = new ThompsonSamplingBandit();

for (let i = 0; i < ITERATIONS; i++) {
  ts.selectArm(2.5);
}

const tsEnd = performance.now();
const tsDuration = tsEnd - tsStart;
console.log(`Standard TS: ${tsDuration.toFixed(2)}ms for ${ITERATIONS} iterations`);
console.log(`Average per call: ${(tsDuration / ITERATIONS).toFixed(4)}ms\n`);

// Benchmark CW-TS
console.log('Running CW-TS...');
const cwtsStart = performance.now();
const cwts = new CWThompsonSamplingBandit({
  confidenceScale: 100,
  minConfidence: 0.3,
  enableCutoff: false,
  cutoffThreshold: 0.1,
});

for (let i = 0; i < ITERATIONS; i++) {
  cwts.selectArm(2.5);
}

const cwtsEnd = performance.now();
const cwtsDuration = cwtsEnd - cwtsStart;
console.log(`CW-TS: ${cwtsDuration.toFixed(2)}ms for ${ITERATIONS} iterations`);
console.log(`Average per call: ${(cwtsDuration / ITERATIONS).toFixed(4)}ms\n`);

// Calculate overhead
const overhead = ((cwtsDuration / tsDuration - 1) * 100).toFixed(1);
console.log('=== Results ===');
console.log(`CW-TS overhead: ${overhead}%`);
console.log(`Target: < 20% overhead`);

if (parseFloat(overhead) < 20) {
  console.log('✅ PASS: CW-TS overhead is within acceptable range');
} else {
  console.log('❌ FAIL: CW-TS overhead exceeds target');
}

// Memory benchmark
console.log('\n=== Memory Benchmark ===');
const tsState = ts.getState();
const cwtsState = cwts.getState();

console.log(`Standard TS state size: ${JSON.stringify(tsState).length} bytes`);
console.log(`CW-TS state size: ${JSON.stringify(cwtsState).length} bytes`);

// Confidence weight calculation benchmark
console.log('\n=== Confidence Weight Calculation Benchmark ===');
const confidenceStart = performance.now();
let totalWeight = 0;

for (let pulls = 0; pulls < 1000; pulls++) {
  totalWeight += cwts.calculateConfidenceWeight(pulls);
}

const confidenceEnd = performance.now();
console.log(`1,000 confidence calculations: ${(confidenceEnd - confidenceStart).toFixed(2)}ms`);
console.log(`Average per calculation: ${((confidenceEnd - confidenceStart) / 1000).toFixed(4)}ms`);
