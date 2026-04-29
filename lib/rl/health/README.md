# RL健康监控模块

## 概述

本模块实现RL自适应引擎的安全壳保护层，提供健康监控、失效检测、自动降级和伪收敛检测功能。

## 架构

```
HealthMonitor (健康监控)
    ↓
FailureDetector (失效检测)
    ↓
DegradationController (降级控制)
    ↓
RuleEngine (规则引擎兜底)
```

## 使用方法

### 基本使用

```typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';

const monitor = new HealthMonitor();

// 记录答题
monitor.recordResponse({
  theta: 0.5,
  deltaC: 3,
  correct: true,
  timestamp: Date.now(),
});

// 检查健康状态
const status = monitor.check();
if (status.level === 'danger') {
  // 切换到规则引擎
}
```

### API集成

在 `app/api/rl/next-question/route.ts` 中：

```typescript
import { HealthMonitor } from '@/lib/rl/health/monitor';
import { decideDegradation } from '@/lib/rl/health/controller';
import { ruleEngineRecommendation } from '@/lib/rl/fallback/rule-engine';

const healthMonitor = new HealthMonitor();

const healthStatus = healthMonitor.check();
const action = decideDegradation(healthStatus);

if (action.type === 'switch_to_rule') {
  difficulty = ruleEngineRecommendation(theta);
} else {
  difficulty = banditRecommendation(theta);
}
```

## 健康指标

| 指标 | 说明 | 目标值 |
|------|------|--------|
| LE | 学习有效性 | > 0.15 |
| CS | 收敛稳定性 | > 0.85 |
| DFI | 数据完整度 | > 0.99 |
| labelNoiseRate | 标签噪声率 | < 0.10 |
| feedbackDelaySteps | 反馈延迟步数 | < 5 |

## 降级行动

| 状态 | 行动 |
|------|------|
| healthy | 继续RL |
| warning | 增大exploration |
| danger | 切换规则引擎 |
| collapsed | 停止RL |

## 测试

```bash
# 单元测试
npx jest lib/rl/health/__tests__/ --verbose

# E2E测试
pnpm test:e2e e2e/rl-safety-shell.spec.ts
```
