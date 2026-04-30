#!/usr/bin/env tsx
import { CWThompsonSamplingBandit } from '../lib/rl/bandit/cw-thompson-sampling';
import { HealthMonitor } from '../lib/rl/health/monitor';
import { decideDegradation } from '../lib/rl/health/controller';

async function testNormalLearner() {
  const bandit = new CWThompsonSamplingBandit({
    explorationRate: 0.1,
    confidenceThreshold: 0.8,
    minConfidence: 0.3,
  }, {
    bucketSize: 0.5,
    minDeltaC: 0,
    maxDeltaC: 10,
    priorAlpha: 1,
    priorBeta: 1,
  });
  
  const healthMonitor = new HealthMonitor();
  let theta = 0;
  const thetaHistory: number[] = [];
  const rewardHistory: number[] = [];
  
  console.log('=== 正常学习学生测试 (1000题) ===\n');
  
  for (let i = 1; i <= 1000; i++) {
    // 选择臂
    const deltaC = parseFloat(bandit.selectArm(theta));
    
    // IRT 概率计算
    const prob = 1 / (1 + Math.exp(-(theta - (deltaC - 5) / 1.7)));
    const correct = Math.random() < prob;
    
    // 更新 bandit
    bandit.update(deltaC.toFixed(1), correct);
    
    // 简单 theta 更新（模拟学生学习）
    const learningRate = 0.01;
    theta += correct ? learningRate : -learningRate * 0.5;
    theta = Math.max(-3, Math.min(3, theta));
    
    // 记录
    thetaHistory.push(theta);
    rewardHistory.push(correct ? 1 : 0);
    
    // 健康监控
    healthMonitor.recordResponse({
      theta,
      deltaC,
      correct,
      timestamp: Date.now(),
    });
    
    if (i % 200 === 0) {
      const health = healthMonitor.check();
      const avgReward = rewardHistory.slice(-50).reduce((a, b) => a + b, 0) / 50;
      console.log(`题 ${i}: theta=${theta.toFixed(2)}, avg_reward=${avgReward.toFixed(3)}, health=${health.level}`);
    }
  }
  
  // 计算 LE
  const le = rewardHistory.slice(800).reduce((a, b) => a + b, 0) / 200 - 
              rewardHistory.slice(0, 200).reduce((a, b) => a + b, 0) / 200;
  
  console.log(`\n=== 最终结果 ===`);
  console.log(`LE (学习提升): ${le.toFixed(4)}`);
  console.log(`最终 theta: ${theta.toFixed(2)}`);
  console.log(`最终准确率: ${rewardHistory.slice(-100).reduce((a, b) => a + b, 0) / 100}`);
}

testNormalLearner().catch(console.error);
