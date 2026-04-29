# 收敛系统测试脚本

## 概述

这是学力跃迁项目的**收敛系统 v1.0**测试套件，用于验证系统是否达到可交付标准。

## 三个核心指标

| 指标 | 全称 | 目标 | 说明 |
|------|------|------|------|
| **DFI** | Data Flow Integrity | ≥ 0.99 | 数据链完整度 |
| **LE** | Learning Effectiveness | > 0.15 | 预测有效性 |
| **CS** | Convergence Stability | ≥ 0.85 | 稳定收敛性 |

## 使用方法

### 单独运行测试

```bash
# DFI 测试（数据链完整度）
pnpm test:dfi [样本大小]

# LE 测试（预测有效性）
pnpm test:le [窗口大小] [最小样本]

# CS 测试（稳定收敛性）
pnpm test:cs [最小推荐次数]
```

### 运行完整收敛测试

```bash
# 完整测试（带详细报告）
pnpm test:convergence

# JSON 输出（用于 CI/CD）
pnpm test:convergence:json
```

### 示例

```bash
# 测试最近 100 次练习的数据完整性
pnpm test:dfi 100

# 测试最近 100 次会话的学习效果
pnpm test:le 100 10

# 测试至少有 5 次推荐的知识点稳定性
pnpm test:cs 5
```

## 输出解读

### ✅ 通过

```
✅ 系统已收敛 - 可以 merge/deploy
数据是通的 + 学生真的变好了 + 系统不乱变
```

### ❌ 失败

```
🚫 系统未收敛 - 阻断 merge/deploy
失败指标: DFI, LE
```

## CI 门禁

测试会在以下情况自动运行：
- 创建 Pull Request
- 推送到 main/develop 分支
- 手动触发 workflow

任何指标失败都会：
- ❌ 阻断 PR merge
- ❌ 阻断 deploy
- 📝 在 PR 中评论测试结果

## 技术细节

### DFI 计算

```
DFI = trace_complete_events / total_events
```

检查每个 `Attempt` 是否有：
- `AttemptStep` (作答记录)
- `UserKnowledge` 更新 (诊断)
- `LearningPath`/`PathAdjustment` (推荐)

### LE 计算

```
LE = P(correct | after_recommendation) - P(correct | before)
```

对比推荐前后的同类题正确率变化。

### CS 计算

```
CS = 1 - variance(recommendation_distribution)
CS = similarity(top_k_recommendations across runs)
```

取两种方法的平均值。

## 故障排查

### DFI 失败

检查数据流是否有断链：
- `AttemptStep` 是否正确创建
- `UserKnowledge` 是否更新
- `LearningPath` 是否生成

### LE 失败

检查推荐是否有效：
- 推荐的题目难度是否合适
- 学生是否有足够练习量
- 计算窗口是否合理

### CS 失败

检查推荐是否稳定：
- AI 生成推荐是否有随机性过高
- 知识点状态是否频繁变化
- Top-K 推荐是否一致
